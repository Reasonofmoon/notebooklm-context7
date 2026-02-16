# Context7 Coder — Document-Grounded AI Web App

> Repomix + NotebookLM(nlm CLI)를 묶어 **문서 근거 기반 코딩 플로우**를 빠르게 실행하는 웹 대시보드

## ✨ Features

- 🎯 **Dashboard** — Bridge 연결 상태, 노트북 관리
- ◈ **Context7 Studio** — 소스 주입(최대 7개) + Repomix 패키징 + One-Click Bootstrap
- ◉ **Query Console** — 문서 근거 기반 AI 질의 + 템플릿 프리셋 + 답변 기록

## 🏗 Architecture

```
Browser (Next.js Web App)
  ↓ client-side fetch
localhost:4317 (Express Bridge Server)
  ↓ spawn
nlm CLI → NotebookLM
repomix CLI → Code Packaging
```

UI는 Vercel에 배포, API는 로컬 Bridge 서버를 통해 실행됩니다.

## 🚀 Quick Start

### 1. Bridge 서버 실행

```bash
# 기존 bridge 프로젝트에서
cd bridge
npm install
npm start
# → http://localhost:4317
```

### 2. 웹앱 실행

```bash
npm install
npm run dev
# → http://localhost:3000
```

### 3. 인증

```bash
nlm login
nlm login --check
```

## 📋 Prerequisites

- Node.js 18+
- `nlm` CLI 설치 및 로그인
- 인터넷 연결

## 🛠 Tech Stack

- **Next.js 16** (App Router)
- **Vanilla CSS** (Dark Glassmorphism Theme)
- **Inter** (Google Fonts)
- **Express Bridge** (localhost:4317)

## 📄 License

MIT
