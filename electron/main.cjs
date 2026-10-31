const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');

console.log('[TIME] Main process started:', new Date().toISOString());

// --- CLI Mode userData Isolation ---
const isCliMode = process.env.HAPPYTOOL_CLI_MODE === '1';
const originalUserDataPath = app.getPath('userData');
if (isCliMode) {
    const cliUserDataPath = path.join(originalUserDataPath, 'happytool_cli_profile');
    app.setPath('userData', cliUserDataPath);
}

app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'app',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            bypassCSP: true,
            allowServiceWorkers: true
        }
    }
]);

const { startServer } = require('../server/index.cjs');

let mainWindow;
let startupState = {
    progress: 10,
    message: 'Initializing Application...',
    logs: [],
    isComplete: false
};
let isSplashReady = false;

function updateStartupStatus(progress, message, log) {
    if (progress !== undefined) startupState.progress = progress;
    if (message) startupState.message = message;
    if (log) {
        startupState.logs.push(log);
        if (startupState.logs.length > 50) startupState.logs.shift();
    }

    if (mainWindow && !mainWindow.isDestroyed() && isSplashReady) {
        if (progress !== undefined) mainWindow.webContents.send('loading-progress', { progress, message });
        if (log) mainWindow.webContents.send('loading-log', log);
    }
}

const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
    try {
        if (fs.existsSync(windowStatePath)) {
            const data = fs.readFileSync(windowStatePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Failed to load window state:', e);
    }
    return { width: 1400, height: 900, isMaximized: false };
}

function saveWindowState(win) {
    if (!win) return;
    try {
        const isMaximized = win.isMaximized();
        const bounds = win.getBounds();
        const state = {
            width: bounds.width,
            height: bounds.height,
            x: bounds.x,
            y: bounds.y,
            isMaximized: isMaximized
        };
        fs.writeFileSync(windowStatePath, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save window state:', e);
    }
}

function createWindow() {
    console.log('[TIME] createWindow() called');
    const state = loadWindowState();

    mainWindow = new BrowserWindow({
        width: state.width || 1400,
        height: state.height || 900,
        x: state.x,
        y: state.y,
        minWidth: 650,
        minHeight: 600,
        backgroundColor: '#0f172a',
        frame: true,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
        },
        icon: path.join(__dirname, '../build/icon.png'),
        show: !isCliMode
    });

    if (state.isMaximized && !isCliMode) {
        mainWindow.maximize();
    }

    const startUrl = process.env.ELECTRON_START_URL || (!app.isPackaged ? 'http://localhost:3000' : 'app://./index.html');
    const finalUrl = isCliMode
        ? `${startUrl}${startUrl.includes('?') ? '&' : '?'}mode=cli`
        : startUrl;

    console.log('[TIME] Loading URL:', finalUrl);
    mainWindow.loadURL(finalUrl);

    let saveTimeout;
    const debouncedSave = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                saveWindowState(mainWindow);
            }
        }, 500);
    };

    mainWindow.on('resize', debouncedSave);
    mainWindow.on('move', debouncedSave);

    mainWindow.on('close', () => {
        clearTimeout(saveTimeout);
        saveWindowState(mainWindow);
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12' && input.type === 'keyDown') {
            mainWindow.webContents.toggleDevTools();
            event.preventDefault();
        }
    });
}

app.on('ready', () => {
    console.log('[TIME] app.on("ready") fired');
    const mime = require('mime-types');
    protocol.handle('app', async (request) => {
        const urlObj = new URL(request.url);
        let url = urlObj.pathname;

        if (url === '/' || url === '') url = '/index.html';

        try {
            url = decodeURIComponent(url);
        } catch (e) { }

        const filePath = path.normalize(path.join(__dirname, '../dist', url));
        try {
            const response = await net.fetch('file:///' + filePath.replace(/\\/g, '/'));
            const contentType = mime.lookup(filePath) || 'application/octet-stream';

            const headers = new Headers(response.headers);
            headers.set('Cross-Origin-Opener-Policy', 'same-origin');
            headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
            headers.set('Content-Type', contentType);
            headers.set('Access-Control-Allow-Origin', '*');

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: headers
            });
        } catch (error) {
            console.error('[PROTOCOL ERROR] Failed to fetch:', filePath, error);
            return new Response('File Not Found', { status: 404 });
        }
    });

    createWindow();

    setTimeout(() => {
        console.log('[TIME] Deferring startServer() inside setTimeout...');
        updateStartupStatus(30, 'Starting Internal Server...', 'Initializing Express & Socket.io...');

        startServer(app.getPath('userData')).then(() => {
            console.log('[TIME] startServer() promise resolved.');
            updateStartupStatus(90, 'Finalizing UI...', 'Server started on port 3003');

            setTimeout(() => {
                startupState.isComplete = true;
                startupState.progress = 100;
                startupState.message = 'Ready!';
                if (mainWindow && !mainWindow.isDestroyed() && isSplashReady) {
                    mainWindow.webContents.send('loading-complete');
                }
            }, 300);
        }).catch(err => {
            console.error('[CRITICAL] Failed to start server:', err);
            updateStartupStatus(90, 'Server Error (Proceeding...)', `Error: ${err.message}`);
            setTimeout(() => {
                startupState.isComplete = true;
                if (mainWindow && !mainWindow.isDestroyed() && isSplashReady) {
                    mainWindow.webContents.send('loading-complete');
                }
            }, 2000);
        });
    }, 100);
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});

// --- IPC Handlers ---

ipcMain.handle('get-startup-status', () => {
    return startupState;
});

ipcMain.on('splash-ready', () => {
    isSplashReady = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('loading-progress', {
            progress: startupState.progress,
            message: startupState.message
        });
        startupState.logs.forEach(log => {
            mainWindow.webContents.send('loading-log', log);
        });
        if (startupState.isComplete) {
            mainWindow.webContents.send('loading-complete');
        }
    }
});

ipcMain.handle('readFile', async (event, filePath) => {
    try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        return data;
    } catch (error) {
        console.error('Failed to read file:', filePath, error);
        throw error;
    }
});

ipcMain.handle('getFileSize', async (event, filePath) => {
    try {
        const stats = await fs.promises.stat(filePath);
        return stats.size;
    } catch (error) {
        console.error('Failed to get file size:', filePath, error);
        throw error;
    }
});

// Zero-Copy Segment Read with 15s File Handle Pooling
const openFileHandles = new Map();

async function getPooledFileHandle(filePath) {
    const existing = openFileHandles.get(filePath);
    if (existing) {
        clearTimeout(existing.timer);
        existing.timer = setTimeout(() => closePooledHandle(filePath), 15000);
        return existing.handle;
    }

    const handle = await fs.promises.open(filePath, 'r');
    const timer = setTimeout(() => closePooledHandle(filePath), 15000);
    openFileHandles.set(filePath, { handle, timer });
    return handle;
}

async function closePooledHandle(filePath) {
    const entry = openFileHandles.get(filePath);
    if (entry) {
        openFileHandles.delete(filePath);
        clearTimeout(entry.timer);
        try {
            await entry.handle.close();
        } catch (err) {
            console.error(`Failed to close pooled file handle for ${filePath}:`, err);
        }
    }
}

ipcMain.handle('readFileSegment', async (event, { path: filePath, start, end }) => {
    try {
        const length = end - start;
        if (length <= 0) return new Uint8Array(0);

        const fileHandle = await getPooledFileHandle(filePath);
        const buffer = Buffer.allocUnsafe(length);
        const { bytesRead } = await fileHandle.read(buffer, 0, length, start);
        return new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead);
    } catch (error) {
        await closePooledHandle(filePath);
        console.error('Failed to read file segment:', filePath, error);
        throw error;
    }
});

const activeStreams = new Map();

ipcMain.handle('streamReadFile', async (event, { filePath, requestId, options = {} }) => {
    try {
        if (activeStreams.has(requestId)) {
            activeStreams.get(requestId).destroy();
            activeStreams.delete(requestId);
        }

        const stream = fs.createReadStream(filePath, {
            highWaterMark: 256 * 1024,
            start: options.start || 0
        });

        activeStreams.set(requestId, stream);

        stream.on('data', (chunk) => {
            if (!event.sender.isDestroyed()) {
                event.sender.send('file-chunk', { chunk, requestId });
            } else {
                stream.destroy();
                activeStreams.delete(requestId);
            }
        });

        stream.on('end', () => {
            if (!event.sender.isDestroyed()) {
                event.sender.send('file-stream-complete', { requestId });
            }
            activeStreams.delete(requestId);
        });

        stream.on('error', (error) => {
            console.error('Stream read error:', error);
            if (!event.sender.isDestroyed()) {
                event.sender.send('file-stream-error', { error: error.message, requestId });
            }
            activeStreams.delete(requestId);
        });

        return { status: 'started', requestId };
    } catch (error) {
        console.error('Failed to initiate file stream:', filePath, error);
        throw error;
    }
});

ipcMain.handle('cancelStream', async (event, { requestId }) => {
    if (activeStreams.has(requestId)) {
        activeStreams.get(requestId).destroy();
        activeStreams.delete(requestId);
        return { status: 'cancelled', requestId };
    }
    return { status: 'not_found', requestId };
});

ipcMain.handle('copyToClipboard', async (event, text) => {
    const { clipboard } = require('electron');
    clipboard.writeText(text);
    return { status: 'success' };
});

ipcMain.handle('saveFile', async (event, content) => {
    const { dialog } = require('electron');
    const { canceled, filePath } = await dialog.showSaveDialog({
        filters: [{ name: 'Log Files', extensions: ['log', 'txt'] }]
    });

    if (canceled || !filePath) return { status: 'canceled' };

    try {
        await fs.promises.writeFile(filePath, content, 'utf8');
        return { status: 'success', filePath };
    } catch (e) {
        console.error('Save failed:', e);
        throw e;
    }
});

ipcMain.handle('saveFileDirect', async (event, { data, filePath }) => {
    try {
        await fs.promises.writeFile(filePath, Buffer.from(data));
        return { status: 'success', filePath };
    } catch (e) {
        console.error('Direct Save failed:', e);
        return { status: 'error', error: e.message };
    }
});

ipcMain.handle('appendFileDirect', async (event, { data, filePath }) => {
    try {
        await fs.promises.appendFile(filePath, Buffer.from(data));
        return { status: 'success', filePath };
    } catch (e) {
        console.error('Direct Append failed:', e);
        return { status: 'error', error: e.message };
    }
});

ipcMain.handle('openExternal', async (event, target) => {
    const { shell } = require('electron');
    try {
        const isWebUrl = target.startsWith('http://') || target.startsWith('https://') || target.startsWith('mailto:');
        const isFileProtocol = target.startsWith('file://');

        if (isWebUrl || isFileProtocol) {
            await shell.openExternal(target);
        } else {
            const path = require('path');
            const normalizedPath = path.normalize(target);
            const error = await shell.openPath(normalizedPath);
            if (error) {
                throw new Error(error);
            }
        }
        return { status: 'success' };
    } catch (e) {
        console.error('Failed to open external/path:', target, e);
        return { status: 'error', error: e.message };
    }
});

ipcMain.handle('getAppPath', async () => {
    if (app.isPackaged) {
        return path.dirname(app.getPath('exe'));
    } else {
        return app.getAppPath();
    }
});

ipcMain.handle('toggle-fullscreen', async (event, flag) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (typeof flag === 'boolean') {
        mainWindow.setFullScreen(flag);
    } else {
        const isFull = mainWindow.isFullScreen();
        mainWindow.setFullScreen(!isFull);
    }
    return mainWindow.isFullScreen();
});

// --- Settings File Persistence (for CLI Sharing) ---
const settingsFilePath = path.join(originalUserDataPath, 'happytool-settings.json');

ipcMain.handle('save-settings-file', async (event, settings) => {
    try {
        await fs.promises.writeFile(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');
        return { status: 'success' };
    } catch (err) {
        console.error('Failed to save settings file:', err);
        throw err;
    }
});

ipcMain.handle('get-cli-settings', async () => {
    try {
        if (fs.existsSync(settingsFilePath)) {
            const data = await fs.promises.readFile(settingsFilePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Failed to read settings file for CLI:', err);
    }
    return null;
});

// --- SDB Command Execution ---
const { exec } = require('child_process');
ipcMain.handle('run-sdb-command', async (event, cmd) => {
    return new Promise((resolve) => {
        exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
            if (error) {
                resolve({ error: true, message: stderr || error.message });
            } else {
                resolve({ stdout: stdout.trim() });
            }
        });
    });
});

// --- Headless CLI Mode Handling ---
if (isCliMode) {
    let cliPayload = null;
    try {
        if (process.env.HAPPYTOOL_CLI_PAYLOAD) {
            cliPayload = JSON.parse(process.env.HAPPYTOOL_CLI_PAYLOAD);
        }
    } catch (e) {
        console.error('Failed to parse CLI payload:', e);
        app.exit(1);
    }

    ipcMain.on('cli-ready', (event) => {
        if (cliPayload) {
            event.sender.send('cli-command', cliPayload);
        } else {
            console.error('No CLI command payload provided.');
            app.exit(1);
        }
    });

    ipcMain.on('cli-stdout', (event, msg) => {
        process.stdout.write(msg + '\n');
    });

    ipcMain.on('cli-stderr', (event, msg) => {
        process.stderr.write(msg + '\n');
    });

    ipcMain.on('cli-exit', (event, code) => {
        app.exit(code || 0);
    });
}
