const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { program } = require('commander');

let hiddenWindow = null;

let chalk;
(async () => {
    chalk = (await import('chalk')).default;
})();

function createHiddenWindow() {
    return new Promise((resolve) => {
        hiddenWindow = new BrowserWindow({
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: false,
                preload: path.join(__dirname, 'preload.cjs')
            }
        });

        hiddenWindow.webContents.on('console-message', (event, level, message) => {
            if (message.startsWith('[CLI]')) {
                const msg = message.replace('[CLI]', '').trim();
                console.log(chalk ? chalk.blue(msg) : msg);
            } else if (level >= 2) {
                console.error(chalk ? chalk.red(`[Renderer Error] ${message}`) : `[Renderer Error] ${message}`);
            }
        });

        const useDevServer = !app.isPackaged && process.env.NODE_ENV !== 'production';

        let isLoaded = false;
        ipcMain.once('cli-ready', () => {
            isLoaded = true;
            resolve(hiddenWindow);
        });

        setTimeout(() => {
            if (!isLoaded) {
                console.warn(chalk ? chalk.yellow('[CLI] Connection timeout. Falling back to local files...') : '[CLI] Connection timeout. Falling back to local files...');
                hiddenWindow.loadURL('app://./index.html?mode=cli');
            }
        }, 5000);

        if (useDevServer) {
            const devUrl = 'http://127.0.0.1:3000?mode=cli';
            hiddenWindow.loadURL(devUrl).catch(() => {
                hiddenWindow.loadURL('app://./index.html?mode=cli');
            });
        } else {
            hiddenWindow.loadURL('app://./index.html?mode=cli');
        }
    });
}

function logInfo(msg) { console.log(chalk ? chalk.greenBright(msg) : msg); }
function logError(msg) { console.error(chalk ? chalk.redBright.bold(msg) : msg); }

async function runCli(args) {
    ipcMain.on('cli-stdout', (event, msg) => {
        process.stdout.write(msg);
    });

    ipcMain.on('cli-stderr', (event, msg) => {
        process.stderr.write(chalk ? chalk.red(msg) : msg);
    });

    ipcMain.on('cli-exit', (event, code) => {
        app.exit(code || 0);
    });

    program
        .name('HappyTool CLI')
        .description('Headless Command Line Interface for HappyTool Light')
        .version(app.getVersion());

    program.command('log-extractor')
        .description('Extract logs using a saved HappyTool mission/filter')
        .requiredOption('-f, --filter <name>', 'Name of the saved filter/mission')
        .requiredOption('-i, --input <path>', 'Path to the input log file')
        .option('-o, --output <path>', 'Path to save the output text file')
        .action(async (options) => {
            logInfo(`Starting Log Extractor CLI...`);
            logInfo(`Filter: ${options.filter}`);
            logInfo(`Input: ${options.input}`);
            if (options.output) logInfo(`Output: ${options.output}`);

            await createHiddenWindow();
            hiddenWindow.webContents.send('cli-run-command', {
                command: 'log-extractor',
                payload: {
                    filterName: options.filter,
                    inputPath: path.resolve(options.input),
                    outputPath: options.output ? path.resolve(options.output) : null,
                    cwd: process.cwd()
                }
            });
        });

    program.command('analyze-diff')
        .description('Analyze difference between two log files')
        .requiredOption('-f, --filter <name>', 'Name of the saved filter/mission')
        .requiredOption('-l, --left <path>', 'Path to the left (baseline) log file')
        .requiredOption('-r, --right <path>', 'Path to the right (target) log file')
        .option('-o, --output <path>', 'Path to save the output JSON summary')
        .action(async (options) => {
            logInfo(`Starting Analyze Diff CLI...`);
            logInfo(`Filter: ${options.filter}`);
            logInfo(`Left Log: ${options.left}`);
            logInfo(`Right Log: ${options.right}`);
            if (options.output) logInfo(`Output: ${options.output}`);

            await createHiddenWindow();
            hiddenWindow.webContents.send('cli-run-command', {
                command: 'analyze-diff',
                payload: {
                    filterName: options.filter,
                    leftPath: path.resolve(options.left),
                    rightPath: path.resolve(options.right),
                    outputPath: options.output ? path.resolve(options.output) : null,
                    cwd: process.cwd()
                }
            });
        });

    program.on('command:*', function () {
        logError('Invalid command: ' + program.args.join(' '));
        logError('See --help for a list of available commands.');
        app.exit(1);
    });

    try {
        program.parse(args, { from: 'user' });
    } catch (err) {
        logError(err.message);
        app.exit(1);
    }
}

module.exports = { runCli };
