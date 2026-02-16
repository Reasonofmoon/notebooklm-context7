# Antigravity Handoff: NotebookLM Context7 Coder

이 문서는 Antigravity가 바로 이어서 구현/운영할 수 있도록 현재 앱 상태를 전달하기 위한 핸드오프 문서입니다.

## 1) 프로젝트 위치

- Workspace 루트: `C:\Users\sound\Documents\MoonWorkspace`
- 앱 루트: `C:\Users\sound\Documents\MoonWorkspace\projects\notebooklm-context7-chrome`
- 확장(Chrome MV3): `C:\Users\sound\Documents\MoonWorkspace\projects\notebooklm-context7-chrome\extension`
- 브리지(Express): `C:\Users\sound\Documents\MoonWorkspace\projects\notebooklm-context7-chrome\bridge`
- 운영 가이드(한국어): `C:\Users\sound\Documents\MoonWorkspace\projects\notebooklm-context7-chrome\docs\guide-ko.md`

## 2) 앱 목적

`Repomix + NotebookLM(nlm CLI)` 기반으로 문서를 먼저 주입(Context7)하고, 문서 근거 중심으로 코딩 질의를 수행하는 로컬 Chrome 앱입니다.

## 3) 현재 구현 상태 (완료)

- 브리지 API 확장 완료
  - 인증, 노트북 생성/목록, 소스 추가/목록, Context7 일괄 주입, 질의, 마인드맵, Repomix 패키징, One-Click Bootstrap
- 확장 UI 확장 완료
  - Auth Check, List/Create Notebook, Package Only, One-Click Bootstrap, List Sources, Create Mindmap, Query, Copy Result
- 실사용 이슈 대응 완료
  - `*.ts` 파일 업로드 실패 시 자동 fallback:
    - 실패한 코드 파일을 `.md`로 래핑해 재업로드
    - 래핑 파일 위치: `C:\Users\sound\Documents\MoonWorkspace\.context7-wrapped`
- query 응답 가독성 개선
  - `data`, `answer`, `returnedConversationId`, `sourcesUsed` 필드 파싱 반환

## 4) 핵심 코드 파일

- 브리지 서버: `projects/notebooklm-context7-chrome/bridge/src/server.js`
  - REST API 전체 구현
  - CLI 실행 래퍼(`nlm`, `repomix`)
  - Context7 업로드/검증/에러 처리
  - `*.ts` -> `.md` fallback 업로드 로직 포함
- 확장 UI 마크업: `projects/notebooklm-context7-chrome/extension/popup.html`
- 확장 UI 로직: `projects/notebooklm-context7-chrome/extension/popup.js`
- 확장 스타일: `projects/notebooklm-context7-chrome/extension/popup.css`
- 확장 권한: `projects/notebooklm-context7-chrome/extension/manifest.json`
- 문서:
  - `projects/notebooklm-context7-chrome/README.md`
  - `projects/notebooklm-context7-chrome/docs/guide-ko.md`
  - `projects/notebooklm-context7-chrome/docs/flow.md`

## 5) 브리지 API 계약

기본 URL: `http://localhost:4317`

- `GET /api/health`
- `POST /api/auth/check`
- `POST /api/notebook/list`
- `POST /api/notebook/create`
- `POST /api/source/list`
- `POST /api/source/add`
- `POST /api/context7/ingest`
- `POST /api/query`
- `POST /api/mindmap/create`
- `POST /api/repomix/package`
- `POST /api/flow/bootstrap`

`/api/flow/bootstrap`은 아래를 순차 수행:
1. 노트북 생성(필요 시)
2. Repomix 패키징
3. repomix 산출물 소스 등록
4. Context7 소스 일괄 등록

## 6) 실행 방법

### 브리지

```powershell
cd C:\Users\sound\Documents\MoonWorkspace\projects\notebooklm-context7-chrome\bridge
npm install
npm start
```

### 확장

1. `chrome://extensions`
2. 개발자 모드 ON
3. 압축해제된 확장 로드
4. 폴더 선택: `...\projects\notebooklm-context7-chrome\extension`

### 인증

```powershell
nlm login
nlm login --check
```

## 7) 최근 운영 이슈 및 해결

1. `EADDRINUSE: 4317`
- 원인: 기존 브리지 프로세스 실행 중
- 해결: 기존 프로세스 종료 후 재실행

2. `Launching Chrome...`에서 login 멈춤
- 원인: `9222` 디버그 포트를 다른 Chrome 세션(예: antigravity browser profile)이 점유
- 해결: 점유 세션 종료 후 `nlm login` 재실행

3. Context7 파일 업로드 207(partial failed)
- 원인: NotebookLM이 `*.ts` file source 업로드 거부
- 해결: 브리지에 자동 fallback 구현 완료 (`.md` 래핑 후 재업로드)

## 8) 현재 확인된 정상 동작 시그널

- `Auth Check` -> `status: 200`, `ok: true`
- `One-Click Bootstrap` -> `status: 200`, `steps.context7.ok: true`
- 코드 파일 업로드 시 `fallback.used: true`가 표시될 수 있음 (정상)

## 9) Antigravity에 권장하는 다음 작업

1. Query 품질 고정
- `sourceIds` 선택 UI 추가해 특정 소스 강제 질의
- 답변 템플릿(근거 강제) 프리셋 버튼 제공

2. 결과 뷰 UX 개선
- JSON raw / human-readable 탭 분리
- ANSI escape 코드 제거 후 표시

3. 운영 안정화
- 브리지 시작 시 포트 충돌 감지/자동 재할당 옵션
- `.context7-wrapped` 정리(만료 파일 자동 삭제)

4. Antigravity 연동 고도화
- 핸드오프 전용 export 버튼 추가:
  - 현재 설정
  - 실행 결과
  - 소스 목록
  - 질의/응답 요약

## 10) 전달용 짧은 메시지 (복붙)

아래 문장을 Antigravity에 그대로 전달하면 됩니다.

```text
NotebookLM Context7 Coder 앱은 아래 위치에 있습니다.
- C:\Users\sound\Documents\MoonWorkspace\projects\notebooklm-context7-chrome

핵심 파일:
- bridge/src/server.js (API/CLI orchestration, ts->md fallback 포함)
- extension/popup.html
- extension/popup.js
- extension/popup.css
- docs/guide-ko.md (사용 가이드)

실행:
1) bridge 폴더에서 npm start
2) chrome://extensions 에서 extension 폴더 로드
3) nlm login --check
4) One-Click Bootstrap -> Query

현 상태:
- Auth 정상
- Bootstrap 정상
- ts 파일 업로드 실패 이슈는 자동 fallback으로 해결됨
```
