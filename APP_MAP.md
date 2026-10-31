# 🗺️ HappyTool Light Master Map (`APP_MAP.md`)

Welcome to the architectural map of **HappyTool Light** (Diet Electron Standalone Log Analyzer).

---

## 🏗️ 1. High-Level Architecture
- **Frontend**: React 19 + TypeScript + Tailwind CSS + Vite (`index.tsx` -> `App.tsx` -> `LogExtractor.tsx` / `CliApp.tsx`)
- **Workers & Engine**: Rust WebAssembly (`happy_filter_bg.wasm`) + 7 Dedicated Web Workers (`workers/`) + `SharedArrayBuffer`
- **Desktop Shell**: Electron Main Process (`electron/main.cjs`, `electron/preload.cjs`, `electron/cli.cjs`)
- **Backend Server**: Lightweight Node.js Socket.IO Server (`server/index.cjs`, `server/services/serialService.cjs`)

---

## 📂 2. Detailed Sub-Maps

| Map File | Scope & Contents |
| :--- | :--- |
| [**UI_COMPONENTS.md**](./docs/maps/UI_COMPONENTS.md) | `LogExtractor`, `LogSession`, `LogViewer` (52 files), `LogArchive` (20 files), Modals, Hooks, and Workers. |
| [**BACKEND_SERVICES.md**](./docs/maps/BACKEND_SERVICES.md) | Electron IPC (`readFileSegment` 15s pooling, `SharedArrayBuffer` COOP/COEP) & Socket.IO (`SDB`, `SSH`, `Serial`, 20ms Log Batching). |
| [**STANDARD_GUIDES.md**](./docs/maps/STANDARD_GUIDES.md) | Coding standards, performance rules, and references to `important/` specifications. |
