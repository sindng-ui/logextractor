const { contextBridge, ipcRenderer, webFrame, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // --- File System API ---
    readFile: (filePath) => ipcRenderer.invoke('readFile', filePath),
    getFileSize: (filePath) => ipcRenderer.invoke('getFileSize', filePath),
    readFileSegment: ({ path, start, end }) => ipcRenderer.invoke('readFileSegment', { path, start, end }),
    streamReadFile: (filePath, requestId, options) => ipcRenderer.invoke('streamReadFile', { filePath, requestId, options }),
    cancelStream: (requestId) => ipcRenderer.invoke('cancelStream', { requestId }),

    onFileChunk: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('file-chunk', subscription);
        return () => ipcRenderer.removeListener('file-chunk', subscription);
    },
    onFileStreamComplete: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('file-stream-complete', subscription);
        return () => ipcRenderer.removeListener('file-stream-complete', subscription);
    },
    onFileStreamError: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('file-stream-error', subscription);
        return () => ipcRenderer.removeListener('file-stream-error', subscription);
    },

    // --- Zoom API ---
    setZoomFactor: (factor) => webFrame.setZoomFactor(factor),
    getZoomFactor: () => webFrame.getZoomFactor(),

    // --- Export / Utility API ---
    copyToClipboard: (text) => ipcRenderer.invoke('copyToClipboard', text),
    saveFile: (content) => ipcRenderer.invoke('saveFile', content),
    saveFileDirect: (data, filePath) => ipcRenderer.invoke('saveFileDirect', { data, filePath }),
    appendFileDirect: (data, filePath) => ipcRenderer.invoke('appendFileDirect', { data, filePath }),
    openExternal: (url) => ipcRenderer.invoke('openExternal', url),
    getAppPath: () => ipcRenderer.invoke('getAppPath'),

    // --- Window Control API ---
    toggleFullscreen: (flag) => ipcRenderer.invoke('toggle-fullscreen', flag),

    // --- Startup Events ---
    getStartupStatus: () => ipcRenderer.invoke('get-startup-status'),
    splashReady: () => ipcRenderer.send('splash-ready'),
    on: (channel, callback) => {
        const validChannels = ['loading-progress', 'loading-log', 'loading-complete'];
        if (validChannels.includes(channel)) {
            const subscription = (event, ...args) => callback(...args);
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription);
        }
    },
    off: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback);
    },

    // --- File Path Helper ---
    getFilePath: (file) => {
        if (webUtils && webUtils.getPathForFile) {
            return webUtils.getPathForFile(file);
        }
        return file.path || '';
    },

    // --- CLI IPC ---
    onCliCommand: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('cli-run-command', subscription);
        ipcRenderer.on('cli-command', subscription);
        return () => {
            ipcRenderer.removeListener('cli-run-command', subscription);
            ipcRenderer.removeListener('cli-command', subscription);
        };
    },
    cliReady: () => ipcRenderer.send('cli-ready'),
    cliStdout: (msg) => ipcRenderer.send('cli-stdout', msg),
    cliStderr: (msg) => ipcRenderer.send('cli-stderr', msg),
    cliExit: (code) => ipcRenderer.send('cli-exit', code),

    // --- Settings Sync ---
    saveSettingsToFile: (settings) => ipcRenderer.invoke('save-settings-file', settings),
    getCliSettings: () => ipcRenderer.invoke('get-cli-settings'),

    // --- SDB Helper ---
    runSdbCommand: (cmd) => ipcRenderer.invoke('run-sdb-command', cmd),
});
