# HappyTool Light — 계획 2 (Diet Electron) 세부 실행 계획서

## 1. 목표 및 원칙
- **목표 1**: 기존 `happytool_electron`의 24개 플러그인 중 **Log Extractor (`Log Analyzer`)** 하나만 단독 앱으로 이식
- **목표 2**: 1:1 무결성 이식 (기능 및 UI 100% 동일, 700줄 제한 리팩토링 조건 예외 적용하여 사이드 이펙트 차단)
- **목표 3**: 성능 요구사항 100% 보존 (Rust WASM 엔진, `SharedArrayBuffer`, 7종 멀티워커, 60fps HyperLogCanvas, 15초 파일 핸들 풀링 `readFileSegment`, 20ms 백엔드 로그 배칭)

## 2. 단계별 실행 계획
- **Phase 1**: 프로젝트 베이스 및 `package.json` 의존성 다이어트 (`rag_analyzer` 230MB 및 타 플러그인 전용 패키지 제거)
- **Phase 2**: Log Extractor 코어 자산 1:1 무결성 복사 (Zero-Modification Lift & Shift)
- **Phase 3**: 프론트엔드 진입점 (`App.tsx`, `CliApp.tsx`, `SettingsModal.tsx`, `useCliHandlers.ts`) 슬림화
- **Phase 4**: Electron Main (`main.cjs`, `preload.cjs`, `cli.cjs`) 및 Backend (`server/index.cjs`) 정밀 다이어트
- **Phase 5**: 기존 UT 및 성능 벤치마크 45개 전량 이식 및 기계적 검증 (`tsc`, `vitest`, `vite build`)
