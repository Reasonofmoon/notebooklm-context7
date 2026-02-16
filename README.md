# NotebookLM Context7 Chrome App

`Repomix + NotebookLM (nlm CLI)`를 묶어 문서 근거 기반 코딩 플로우를 빠르게 실행하는 Chrome 확장 + 로컬 브리지 서버입니다.

한국어 상세 가이드:
- `docs/guide-ko.md`

Antigravity 전달용 문서:
- `docs/antigravity-handoff.md`

## What It Does

- NotebookLM 인증 확인, 노트북 생성/목록 조회
- Context7(최대 7개) 소스 일괄 주입
- Repomix 패키징
- 패키징 결과를 NotebookLM 소스로 자동 등록
- Manual-first 질의 (문서 근거 우선)
- 소스 목록 조회, Mindmap 생성
- One-Click Bootstrap:
  - 노트북 생성(필요 시) + Repomix + 소스 등록 + Context7 주입을 한 번에 실행

## Project Structure

- `bridge/`: Express 기반 로컬 API 서버
  - extension 요청을 받아 `nlm`, `repomix` CLI 실행
- `extension/`: Chrome MV3 popup 앱
  - 브리지 API를 UI로 호출

## Prerequisites

- Node.js 18+
- `nlm` CLI 설치 및 로그인
- 인터넷 연결 (NotebookLM/소스 접근용)

로그인 예시:

```powershell
nlm login
```

## Quick Start

1. 브리지 실행

```powershell
cd bridge
npm install
npm start
```

기본 URL: `http://localhost:4317`

2. Chrome 확장 로드

1. `chrome://extensions` 이동
2. `개발자 모드` ON
3. `압축해제된 확장 프로그램 로드` -> `extension/` 선택

3. 팝업에서 동작 순서

1. `Auth Check`
2. 필요 시 `Create Notebook` 또는 `List Notebooks`
3. `One-Click Bootstrap` 실행
4. `Query NotebookLM`

## Context7 Input Format

`Context7 Sources` 텍스트 영역에 한 줄씩 입력:

```text
type|value|title(optional)
```

예시:

```text
url|https://nextjs.org/docs|Next.js Docs
url|https://ai.google.dev/gemini-api/docs|Gemini API Docs
file|C:\repo\docs\api.md|Internal API Spec
```

지원 타입:

- `url`
- `file`
- `text`
- `youtube`
- `drive`

최대 7개만 허용됩니다.

## Bridge API

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

## One-Click Bootstrap Payload (Reference)

```json
{
  "notebookId": "",
  "notebookTitle": "context7-notebook",
  "createNotebookIfMissing": true,
  "wait": true,
  "repomix": {
    "enabled": true,
    "addAsSource": true,
    "dir": "kbob-ocr/app",
    "output": "artifacts/repomix-pack.md",
    "include": "src/**/*,README.md,package.json,next.config.ts",
    "ignore": "**/node_modules/**,**/.next/**,package-lock.json",
    "style": "markdown",
    "sourceTitle": "Repomix Pack"
  },
  "sources": [
    { "sourceType": "url", "value": "https://nextjs.org/docs", "title": "Next.js Docs" }
  ]
}
```

## Ops Notes

- 로컬 사용 전제입니다.
- `WORKSPACE_ROOT` 밖 경로는 Repomix에서 차단됩니다.
- 민감 정보 포함 문서는 업로드 전에 반드시 제외/마스킹하세요.
- `nlm` 세션 만료 시 `nlm login` 재실행이 필요합니다.
