# ⚙️ Backend & Electron Services Map (`BACKEND_SERVICES.md`)

## 1. Electron Main & Preload (`electron/`)
| File | Key Responsibilities |
| :--- | :--- |
| `electron/main.cjs` | Window lifecycle, `app://` custom protocol with `Cross-Origin-Opener-Policy: same-origin` & `Cross-Origin-Embedder-Policy: require-corp` (`SharedArrayBuffer` support), 15-second pooled `readFileSegment` zero-copy file reader, `getFileSize`, `saveFileDirect`, `appendFileDirect`, `run-sdb-command`, and CLI profile isolation. |
| `electron/preload.cjs` | ContextBridge exposing `window.electronAPI` for file system, zoom, clipboard, settings sync, and CLI IPC. |
| `electron/cli.cjs` | Commander-based CLI entry point supporting `log-extractor` and `analyze-diff`. |

## 2. Lightweight Socket.IO Server (`server/`)
| File | Key Responsibilities |
| :--- | :--- |
| `server/index.cjs` | Port `3003` Socket.IO server with 20ms `StringDecoder` log batching (`handleLogData` / `flushLogs`), SDB connection & `192.168.250.250` auto-recovery (`connect_sdb`, `sdb_write`, `sdb_clear`, `list_sdb_devices`, `connect_sdb_remote`), SSH shell streaming (`connect_ssh`, `ssh_write`, `ssh_clear`, `ssh_auth_response`), and Test Scroll simulator (`start_scroll_stream`, `stop_scroll_stream`). |
| `server/services/serialService.cjs` | Native `serialport` manager for UART/Serial live log streaming and special signals (`break`, `ctrl+c`, `ctrl+z`, `ctrl+d`). |
