# NotebookLM Context7 Coder 사용법 + 작동원리 (쉬운 설명)

이 문서는 `notebooklm-context7-chrome` 앱을 처음 쓰는 사람을 위한 안내서입니다.
복잡한 설정 없이, "왜 이렇게 동작하는지"까지 이해할 수 있게 설명합니다.

## 한 줄 요약

이 앱은 **문서(근거)를 먼저 NotebookLM에 넣고**, 그 다음에 **문서 기반으로 코딩 답변**을 받게 만드는 도구입니다.

## 이 앱이 해결하는 문제

일반 AI 코딩은 이런 문제가 자주 생깁니다.

- 프로젝트 코드를 다 모르고 추측 답변함
- 문서 근거가 없어서 신뢰하기 어려움
- 큰 코드베이스에서 토큰이 많이 듦

이 앱은 아래 방식으로 해결합니다.

- `Repomix`로 코드베이스를 AI 친화적인 한 파일로 압축
- 중요한 문서 최대 7개(Context7) 추가 주입
- NotebookLM에 질의해서 근거 중심 답변 받기

## 구성 요소 (쉽게 이해하기)

1. `Chrome Extension`  
버튼 UI입니다. 사용자가 누르는 화면입니다.

2. `Bridge 서버 (localhost:4317)`  
확장 프로그램이 직접 터미널 명령을 실행할 수 없어서, 중간 서버가 대신 `nlm`, `repomix`를 실행합니다.

3. `nlm CLI`  
NotebookLM 로그인, 노트북 생성, 소스 업로드, 질의를 담당합니다.

4. `Repomix`  
여러 파일을 하나의 AI 친화 문서로 묶어줍니다.

5. `NotebookLM`  
업로드된 자료를 바탕으로 답변합니다.

## 처음 한 번만 준비

1. 브리지 실행

```powershell
cd C:\Users\sound\Documents\MoonWorkspace\projects\notebooklm-context7-chrome\bridge
npm start
```

2. `chrome://extensions` 열기

3. `개발자 모드` 켜기

4. `압축해제된 확장 프로그램 로드` 클릭

5. 폴더 선택

```text
C:\Users\sound\Documents\MoonWorkspace\projects\notebooklm-context7-chrome\extension
```

6. 인증 확인

```powershell
nlm login --check
```

## 매번 쓰는 가장 쉬운 방법 (실전 4단계)

1. 확장 팝업 열기

2. `Auth Check` 클릭

3. `One-Click Bootstrap` 클릭

4. 질문 입력 후 `Query NotebookLM` 클릭

이 4단계면 대부분 끝납니다.

## 버튼별로 정확히 무엇을 하는지

| 버튼 | 하는 일 |
|---|---|
| `Auth Check` | `nlm login --check`를 호출해 인증 상태를 확인 |
| `List Notebooks` | NotebookLM의 노트북 목록 조회 |
| `Create Notebook` | 새 노트북 생성, 생성된 ID를 입력칸에 반영 |
| `Package Only` | Repomix만 실행해서 `repomix-pack.md` 생성 |
| `One-Click Bootstrap` | 노트북 준비 + Repomix + 소스 업로드 + Context7 업로드를 한 번에 수행 |
| `Ingest Context7` | 입력한 최대 7개 소스를 노트북에 업로드 |
| `List Sources` | 현재 노트북에 연결된 소스 목록 조회 |
| `Create Mindmap` | NotebookLM에서 마인드맵 생성 |
| `Query NotebookLM` | 입력한 질문을 노트북 컨텍스트 기반으로 실행 |
| `Copy Result` | 결과 JSON/텍스트를 클립보드로 복사 |

## One-Click Bootstrap의 내부 순서

실제로는 이 순서로 동작합니다.

1. 노트북 ID가 없으면 제목으로 새 노트북 생성

2. Repomix 실행

3. `repomix-pack.md`를 NotebookLM 소스로 업로드

4. Context7 소스들을 순서대로 업로드

5. 모두 성공하면 `ok: true` 반환

6. 일부 실패면 `207` 또는 에러 상세를 반환

## Context7 입력 형식

한 줄에 하나씩 아래 형식으로 입력합니다.

```text
type|value|title
```

예시:

```text
url|https://nextjs.org/docs|Next.js Docs
file|C:\Users\sound\Documents\MoonWorkspace\kbob-ocr\app\src\app\api\analyze\route.ts|analyze route
file|C:\Users\sound\Documents\MoonWorkspace\kbob-ocr\app\src\lib\gemini.ts|gemini lib
```

지원 타입:

- `url`
- `file`
- `text`
- `youtube`
- `drive`

규칙:

- 최대 7개
- 줄마다 `type|value`는 필수

## 중요한 동작: TypeScript 파일 자동 래핑

NotebookLM은 경우에 따라 `*.ts`를 파일 소스로 직접 받지 못합니다.

이 앱은 자동으로 이렇게 처리합니다.

1. `route.ts` 같은 파일 업로드 시도

2. 실패하면 코드 내용을 `.md`로 감싼 임시 파일 생성  
생성 위치: `C:\Users\sound\Documents\MoonWorkspace\.context7-wrapped`

3. 감싼 `.md` 파일을 다시 업로드

그래서 결과 JSON에 `fallback.used: true`가 보이면 **오류가 아니라 자동복구 성공**입니다.

## 좋은 질문 템플릿 (복붙용)

```text
업로드된 소스만 근거로 답변해.
추측 금지.
각 결론마다 근거 소스명과 함수명을 명시해.
마지막에 구현 체크리스트를 5개 이내로 정리해.
```

## 자주 보는 문제와 해결

1. `EADDRINUSE: 4317`

- 원인: 브리지가 이미 실행 중
- 해결: 기존 브리지 사용하거나 기존 프로세스 종료 후 재실행

```powershell
Get-NetTCPConnection -LocalPort 4317 | Select-Object OwningProcess
Stop-Process -Id <PID> -Force
npm start
```

2. `Authentication expired`

- 원인: NotebookLM 인증 만료
- 해결:

```powershell
nlm login
nlm login --check
```

3. Context7 업로드 일부 실패 (`status: 207`)

- 원인: 파일 형식/경로/권한 이슈
- 해결: 절대 경로 확인, 다시 업로드, 필요 시 래핑 fallback 확인

4. 답변이 추측처럼 보임

- 원인: 소스 근거 제약이 약한 질문
- 해결: 위 "좋은 질문 템플릿" 그대로 사용

## 결과 JSON을 이렇게 읽으면 빠릅니다

- `ok: true`  
전체 성공 여부

- `steps.repomix.ok`  
패키징 성공 여부

- `steps.repomixSource.ok`  
repomix 문서 업로드 성공 여부

- `steps.context7.ok`  
Context7 전체 성공 여부

- `steps.context7.results[].fallback.used`  
코드 파일 업로드 자동복구 사용 여부

## 추천 운영 습관

1. 프로젝트마다 노트북을 분리해서 사용

2. Context7은 "공식문서 + 핵심 내부문서" 중심으로 엄선

3. 질의 전에 항상 `List Sources`로 현재 근거를 점검

4. 답변을 바로 코드에 넣지 말고 체크리스트 기준으로 검증

## 파일 위치 요약

- 확장: `projects/notebooklm-context7-chrome/extension`
- 브리지: `projects/notebooklm-context7-chrome/bridge`
- 흐름 문서: `projects/notebooklm-context7-chrome/docs/flow.md`
- 이 문서: `projects/notebooklm-context7-chrome/docs/guide-ko.md`
