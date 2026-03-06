const SOURCE_TYPES = new Set(["url", "file", "text", "youtube", "drive"]);
const STORAGE_KEY = "context7CoderSettings";

/* ========== Query Presets ========== */
const QUERY_PRESETS = {
  evidence: [
    "업로드된 소스만 근거로 답변해.",
    "추측 금지.",
    "각 결론마다 근거 소스명과 함수명을 명시해.",
    "마지막에 구현 체크리스트를 5개 이내로 정리해.",
    "",
    "질문: ",
  ].join("\n"),
  architecture: [
    "아키텍처 분석 모드입니다.",
    "업로드된 문서를 기반으로 시스템 구조를 설명해주세요.",
    "컴포넌트 간 데이터 흐름을 다이어그램 형태로 설명하고,",
    "개선 가능한 포인트를 우선순위 순으로 나열해주세요.",
    "",
    "분석 대상: ",
  ].join("\n"),
  debug: [
    "디버깅 모드입니다.",
    "업로드된 문서에서 관련 코드를 찾아서,",
    "가능한 원인을 근거와 함께 3가지 이내로 제시해주세요.",
    "각 원인에 대한 해결 코드도 함께 제공해주세요.",
    "",
    "에러 상황: ",
  ].join("\n"),
  review: [
    "코드 리뷰 모드입니다.",
    "업로드된 문서 기준으로 코드 품질을 평가해주세요.",
    "항목: 보안, 성능, 가독성, 테스트 커버리지.",
    "각 항목별 점수(1-5)와 개선 사항을 제시해주세요.",
    "",
    "리뷰 대상: ",
  ].join("\n"),
};

/* ========== Element References ========== */
const el = {
  // Status chips
  chipBridge: document.getElementById("chipBridge"),
  chipAuth: document.getElementById("chipAuth"),
  chipNotebook: document.getElementById("chipNotebook"),
  // Step navigation
  stepTabs: document.querySelectorAll(".step-tab"),
  stepPanels: document.querySelectorAll(".step-panel"),
  // Step 1: Connect
  bridgeUrl: document.getElementById("bridgeUrl"),
  notebookTitle: document.getElementById("notebookTitle"),
  notebookSelect: document.getElementById("notebookSelect"),
  refreshNotebooksBtn: document.getElementById("refreshNotebooksBtn"),
  notebookId: document.getElementById("notebookId"),
  createNotebookBtn: document.getElementById("createNotebookBtn"),
  // Step 2: Setup
  repoDir: document.getElementById("repoDir"),
  repoOutput: document.getElementById("repoOutput"),
  repoInclude: document.getElementById("repoInclude"),
  repoIgnore: document.getElementById("repoIgnore"),
  addPackAsSource: document.getElementById("addPackAsSource"),
  sourcesText: document.getElementById("sourcesText"),
  sourceCounter: document.getElementById("sourceCounter"),
  packageBtn: document.getElementById("packageBtn"),
  bootstrapBtn: document.getElementById("bootstrapBtn"),
  // Step 3: Query
  manualMode: document.getElementById("manualMode"),
  questionText: document.getElementById("questionText"),
  listSourcesBtn: document.getElementById("listSourcesBtn"),
  mindmapBtn: document.getElementById("mindmapBtn"),
  queryBtn: document.getElementById("queryBtn"),
  // Step 4: Result
  resultTabs: document.querySelectorAll(".result-tab"),
  resultAnswer: document.getElementById("resultAnswer"),
  resultRaw: document.getElementById("resultRaw"),
  answerContent: document.getElementById("answerContent"),
  rawContent: document.getElementById("rawContent"),
  copyAnswerBtn: document.getElementById("copyAnswerBtn"),
  copyRawBtn: document.getElementById("copyRawBtn"),
  // Progress
  progressOverlay: document.getElementById("progressOverlay"),
  progressTitle: document.getElementById("progressTitle"),
  progressSteps: document.getElementById("progressSteps"),
  // Legacy
  result: document.getElementById("result"),
};

let lastAnswerText = "";
let lastRawText = "";
let currentStep = 1;

/* ========== Utilities ========== */
function stripAnsi(text) {
  return String(text || "").replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    "",
  );
}

function getNotebookIdRequired() {
  const fromSelect = el.notebookSelect.value;
  const fromInput = el.notebookId.value.trim();
  const notebookId = fromSelect || fromInput;
  if (!notebookId) {
    throw new Error("Notebook을 선택하거나 ID를 입력하세요.");
  }
  return notebookId;
}

function getBridgeBaseUrl() {
  const base = el.bridgeUrl.value.trim().replace(/\/$/, "");
  if (!base) throw new Error("Bridge URL이 비어 있습니다.");
  return base;
}

function getEffectiveNotebookId() {
  return el.notebookSelect.value || el.notebookId.value.trim();
}

/* ========== Step Navigation ========== */
function showStep(step) {
  currentStep = step;
  el.stepTabs.forEach((tab) => {
    tab.classList.toggle("active", Number(tab.dataset.step) === step);
  });
  el.stepPanels.forEach((panel) => {
    panel.classList.toggle("active", Number(panel.dataset.step) === step);
  });
}

el.stepTabs.forEach((tab) => {
  tab.addEventListener("click", () => showStep(Number(tab.dataset.step)));
});

/* ========== Result Tabs ========== */
el.resultTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.resultTab;
    el.resultTabs.forEach((t) => t.classList.toggle("active", t === tab));
    el.resultAnswer.classList.toggle("active", target === "answer");
    el.resultRaw.classList.toggle("active", target === "raw");
  });
});

/* ========== Status Chips ========== */
function setChip(chipEl, status, label) {
  chipEl.className = `chip chip--${status}`;
  const textNode = chipEl.childNodes[chipEl.childNodes.length - 1];
  if (textNode) textNode.textContent = ` ${label}`;
}

/* ========== Source Counter ========== */
function updateSourceCounter() {
  const lines = el.sourcesText.value
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"));
  const count = lines.length;
  el.sourceCounter.textContent = `${count}/7`;
  el.sourceCounter.style.color = count > 7 ? "var(--red)" : "";
}

el.sourcesText.addEventListener("input", updateSourceCounter);

/* ========== Progress Overlay ========== */
function showProgress(title, steps) {
  el.progressTitle.textContent = title;
  el.progressSteps.innerHTML = steps
    .map((s) => `<li>${s}</li>`)
    .join("");
  el.progressOverlay.classList.remove("hidden");
}

function updateProgressStep(index, status, label) {
  const items = el.progressSteps.querySelectorAll("li");
  if (!items[index]) return;
  items[index].className = status;
  const icons = { done: "✅", active: "⏳", fail: "❌", "": "⬜" };
  items[index].textContent = `${icons[status] || "⬜"} ${label}`;
}

function hideProgress() {
  el.progressOverlay.classList.add("hidden");
}

/* ========== Render Results ========== */
function renderResult(data, answerOverride) {
  const raw = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  lastRawText = stripAnsi(raw);
  el.rawContent.textContent = lastRawText;

  // Extract answer
  let answer = answerOverride || "";
  if (!answer && data && typeof data === "object") {
    answer = data.answer || "";
    if (!answer && data.data && typeof data.data === "object") {
      answer = data.data.answer || "";
    }
  }
  if (!answer && typeof data === "string") {
    answer = data;
  }

  lastAnswerText = stripAnsi(String(answer || "결과를 확인하세요."));
  el.answerContent.textContent = lastAnswerText;

  // Legacy compat
  el.result.textContent = lastRawText;

  showStep(4);
}

function renderError(error) {
  const msg = error?.message || String(error);
  lastAnswerText = `❌ ${msg}`;
  lastRawText = JSON.stringify({ ok: false, error: msg }, null, 2);
  el.answerContent.textContent = lastAnswerText;
  el.rawContent.textContent = lastRawText;
  el.result.textContent = lastRawText;
  showStep(4);
}

/* ========== Parse Context7 ========== */
function parseContext7Lines() {
  const lines = el.sourcesText.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (lines.length > 7) {
    throw new Error("Context7는 최대 7개 소스만 허용됩니다.");
  }

  return lines.map((line, i) => {
    const [sourceTypeRaw, valueRaw, ...titleParts] = line
      .split("|")
      .map((p) => p.trim());

    const sourceType = String(sourceTypeRaw || "").toLowerCase();
    const value = String(valueRaw || "");
    if (!sourceType || !value) {
      throw new Error(`${i + 1}번째 줄 형식 오류. type|value|title`);
    }
    if (!SOURCE_TYPES.has(sourceType)) {
      throw new Error(`${i + 1}번째 줄 잘못된 sourceType: ${sourceType}`);
    }
    return { sourceType, value, title: titleParts.join("|") };
  });
}

function buildManualFirstQuestion(question) {
  return [
    "문서 근거 우선 모드입니다.",
    "업로드된 문서 범위 안에서만 답변하세요.",
    "가정이 필요한 경우 가정임을 명확히 표시하세요.",
    "구현 단계는 체크리스트 + 코드 스켈레톤으로 제시하세요.",
    "",
    `질문: ${question}`,
  ].join("\n");
}

function buildRepomixConfig() {
  return {
    enabled: true,
    addAsSource: el.addPackAsSource.checked,
    dir: el.repoDir.value.trim() || ".",
    output: el.repoOutput.value.trim() || "repomix-output.md",
    include: el.repoInclude.value.trim(),
    ignore: el.repoIgnore.value.trim(),
    style: "markdown",
    sourceTitle: "Repomix Pack",
  };
}

/* ========== API Calls ========== */
async function callApi(path, method = "GET", body) {
  const base = getBridgeBaseUrl();
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    return {
      status: 0,
      payload: { ok: false, error: `Bridge 요청 실패: ${error.message}` },
    };
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch (_) {
    payload = { ok: false, error: "JSON 파싱 실패" };
  }
  return { status: response.status, payload };
}

/* ========== Settings Persistence ========== */
async function loadSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const s = stored[STORAGE_KEY] || {};

  if (s.bridgeUrl) el.bridgeUrl.value = s.bridgeUrl;
  if (s.notebookTitle) el.notebookTitle.value = s.notebookTitle;
  if (s.notebookId) el.notebookId.value = s.notebookId;
  if (s.repoDir) el.repoDir.value = s.repoDir;
  if (s.repoOutput) el.repoOutput.value = s.repoOutput;
  if (s.repoInclude) el.repoInclude.value = s.repoInclude;
  if (s.repoIgnore) el.repoIgnore.value = s.repoIgnore;
  if (typeof s.addPackAsSource === "boolean") el.addPackAsSource.checked = s.addPackAsSource;
  if (typeof s.manualMode === "boolean") el.manualMode.checked = s.manualMode;
  if (s.sourcesText) el.sourcesText.value = s.sourcesText;
  if (s.questionText) el.questionText.value = s.questionText;
  if (s.lastStep) showStep(s.lastStep);
}

async function saveSettings() {
  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      bridgeUrl: el.bridgeUrl.value.trim(),
      notebookTitle: el.notebookTitle.value.trim(),
      notebookId: getEffectiveNotebookId(),
      repoDir: el.repoDir.value.trim(),
      repoOutput: el.repoOutput.value.trim(),
      repoInclude: el.repoInclude.value.trim(),
      repoIgnore: el.repoIgnore.value.trim(),
      addPackAsSource: el.addPackAsSource.checked,
      manualMode: el.manualMode.checked,
      sourcesText: el.sourcesText.value,
      questionText: el.questionText.value,
      lastStep: currentStep,
    },
  });
}

/* ========== Auto Status Checks ========== */
async function checkBridgeHealth() {
  setChip(el.chipBridge, "unknown", "Checking...");
  try {
    const { status, payload } = await callApi("/api/health");
    if (status === 200 && payload?.ok) {
      setChip(el.chipBridge, "ok", "Bridge");
      return true;
    }
    setChip(el.chipBridge, "fail", "Offline");
    return false;
  } catch (_) {
    setChip(el.chipBridge, "fail", "Offline");
    return false;
  }
}

async function checkAuth() {
  setChip(el.chipAuth, "unknown", "Checking...");
  try {
    const { status, payload } = await callApi("/api/auth/check", "POST", {});
    if (status === 200 && payload?.ok) {
      setChip(el.chipAuth, "ok", "Auth");
      return true;
    }
    setChip(el.chipAuth, "fail", "Expired");
    return false;
  } catch (_) {
    setChip(el.chipAuth, "fail", "Error");
    return false;
  }
}

async function refreshNotebooks() {
  try {
    const { status, payload } = await callApi("/api/notebook/list", "POST", {});
    if (status !== 200 || !payload?.ok) return;

    const data = payload.data;
    let notebooks = [];
    if (Array.isArray(data)) {
      notebooks = data;
    } else if (data && typeof data === "object" && Array.isArray(data.notebooks)) {
      notebooks = data.notebooks;
    }

    el.notebookSelect.innerHTML = '<option value="">-- 선택 --</option>';
    notebooks.forEach((nb) => {
      const id = nb.id || nb.notebookId || nb.notebook_id || "";
      const title = nb.title || nb.name || id;
      if (!id) return;
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `${title} (${id.substring(0, 8)}...)`;
      el.notebookSelect.appendChild(opt);
    });

    // Restore previously saved notebook
    const savedId = el.notebookId.value.trim();
    if (savedId) {
      const match = [...el.notebookSelect.options].find(
        (o) => o.value === savedId,
      );
      if (match) el.notebookSelect.value = savedId;
    }

    if (notebooks.length > 0) {
      setChip(el.chipNotebook, "ok", `${notebooks.length} Notebooks`);
    }
  } catch (_) {
    // Silently fail
  }
}

/* ========== Notebook Select Sync ========== */
el.notebookSelect.addEventListener("change", () => {
  if (el.notebookSelect.value) {
    el.notebookId.value = el.notebookSelect.value;
    setChip(el.chipNotebook, "ok", "Selected");
  }
  saveSettings().catch(() => {});
});

el.notebookId.addEventListener("input", () => {
  const val = el.notebookId.value.trim();
  if (val) {
    // Try to match with dropdown
    const match = [...el.notebookSelect.options].find((o) => o.value === val);
    if (match) el.notebookSelect.value = val;
    else el.notebookSelect.value = "";
    setChip(el.chipNotebook, "ok", "ID Set");
  } else {
    setChip(el.chipNotebook, "unknown", "Notebook");
  }
});

/* ========== Action Handlers ========== */
el.refreshNotebooksBtn.addEventListener("click", async () => {
  el.refreshNotebooksBtn.disabled = true;
  el.refreshNotebooksBtn.textContent = "⏳";
  await refreshNotebooks();
  el.refreshNotebooksBtn.disabled = false;
  el.refreshNotebooksBtn.textContent = "🔄";
});

el.createNotebookBtn.addEventListener("click", async () => {
  const title = el.notebookTitle.value.trim();
  if (!title) {
    renderError(new Error("Notebook title이 비어 있습니다."));
    return;
  }
  showProgress("노트북 생성 중...", ["📓 노트북 생성"]);
  updateProgressStep(0, "active", "노트북 생성 중...");

  try {
    const { status, payload } = await callApi("/api/notebook/create", "POST", { title });
    if (payload?.notebookId) {
      el.notebookId.value = payload.notebookId;
      setChip(el.chipNotebook, "ok", "Created");
      await refreshNotebooks();
    }
    updateProgressStep(0, status === 200 ? "done" : "fail", "노트북 생성 " + (status === 200 ? "완료" : "실패"));
    await saveSettings();
    setTimeout(() => {
      hideProgress();
      renderResult({ status, ...payload });
    }, 600);
  } catch (err) {
    updateProgressStep(0, "fail", "노트북 생성 실패");
    setTimeout(() => { hideProgress(); renderError(err); }, 600);
  }
});

el.packageBtn.addEventListener("click", async () => {
  showProgress("Repomix 패키징 중...", ["📦 Repomix 패키징"]);
  updateProgressStep(0, "active", "패키징 중...");

  try {
    const { status, payload } = await callApi("/api/repomix/package", "POST", buildRepomixConfig());
    updateProgressStep(0, status === 200 ? "done" : "fail", status === 200 ? "패키징 완료" : "패키징 실패");
    await saveSettings();
    setTimeout(() => { hideProgress(); renderResult({ status, ...payload }); }, 600);
  } catch (err) {
    updateProgressStep(0, "fail", "패키징 실패");
    setTimeout(() => { hideProgress(); renderError(err); }, 600);
  }
});

el.bootstrapBtn.addEventListener("click", async () => {
  const steps = [
    "📓 노트북 준비",
    "📦 Repomix 패키징",
    "📤 Repomix 소스 등록",
    "📚 Context7 소스 주입",
  ];
  showProgress("One-Click Bootstrap 실행 중...", steps);
  updateProgressStep(0, "active", "노트북 준비 중...");

  try {
    const notebookId = getEffectiveNotebookId();
    const notebookTitle = el.notebookTitle.value.trim();
    const sources = parseContext7Lines();

    const { status, payload } = await callApi("/api/flow/bootstrap", "POST", {
      notebookId,
      notebookTitle,
      createNotebookIfMissing: true,
      wait: true,
      repomix: buildRepomixConfig(),
      sources,
    });

    // Update progress steps based on response
    const s = payload?.steps || {};
    updateProgressStep(0, s.notebook?.ok !== false ? "done" : "fail",
      s.notebook?.ok !== false ? "노트북 준비 완료" : "노트북 준비 실패");
    updateProgressStep(1, s.repomix?.ok ? "done" : (s.repomix ? "fail" : "done"),
      s.repomix?.ok ? "Repomix 패키징 완료" : (s.repomix ? "패키징 실패" : "패키징 스킵"));
    updateProgressStep(2, s.repomixSource?.ok ? "done" : (s.repomixSource ? "fail" : "done"),
      s.repomixSource?.ok ? "소스 등록 완료" : (s.repomixSource ? "등록 실패" : "등록 스킵"));
    updateProgressStep(3, s.context7?.ok ? "done" : (s.context7 ? "fail" : "done"),
      s.context7?.ok ? `Context7 완료 (${s.context7.count || 0}개)` : (s.context7 ? "일부 실패" : "소스 없음"));

    if (payload?.notebookId) {
      el.notebookId.value = payload.notebookId;
      setChip(el.chipNotebook, "ok", "Bootstrap OK");
    }

    await saveSettings();
    setTimeout(() => { hideProgress(); renderResult({ status, ...payload }); }, 1200);
  } catch (err) {
    setTimeout(() => { hideProgress(); renderError(err); }, 600);
  }
});

el.ingestBtn = document.getElementById("ingestBtn");
if (el.ingestBtn) {
  el.ingestBtn.addEventListener("click", async () => {
    showProgress("Context7 소스 주입 중...", ["📚 소스 주입"]);
    updateProgressStep(0, "active", "주입 중...");

    try {
      const notebookId = getNotebookIdRequired();
      const sources = parseContext7Lines();
      const { status, payload } = await callApi("/api/context7/ingest", "POST", {
        notebookId,
        sources,
        wait: true,
      });
      updateProgressStep(0, status === 200 ? "done" : "fail",
        status === 200 ? "소스 주입 완료" : "일부 실패");
      await saveSettings();
      setTimeout(() => { hideProgress(); renderResult({ status, ...payload }); }, 600);
    } catch (err) {
      updateProgressStep(0, "fail", "주입 실패");
      setTimeout(() => { hideProgress(); renderError(err); }, 600);
    }
  });
}

el.listSourcesBtn.addEventListener("click", async () => {
  showProgress("소스 목록 조회 중...", ["📋 소스 목록"]);
  updateProgressStep(0, "active", "조회 중...");

  try {
    const notebookId = getNotebookIdRequired();
    const { status, payload } = await callApi("/api/source/list", "POST", { notebookId });
    updateProgressStep(0, "done", "소스 목록 조회 완료");
    await saveSettings();
    setTimeout(() => { hideProgress(); renderResult({ status, ...payload }); }, 400);
  } catch (err) {
    updateProgressStep(0, "fail", "조회 실패");
    setTimeout(() => { hideProgress(); renderError(err); }, 400);
  }
});

el.mindmapBtn.addEventListener("click", async () => {
  showProgress("마인드맵 생성 중...", ["🧠 마인드맵 생성"]);
  updateProgressStep(0, "active", "생성 중...");

  try {
    const notebookId = getNotebookIdRequired();
    const baseTitle = el.notebookTitle.value.trim() || "Context7 Notebook";
    const { status, payload } = await callApi("/api/mindmap/create", "POST", {
      notebookId,
      title: `${baseTitle} Mindmap`,
    });
    updateProgressStep(0, status === 200 ? "done" : "fail",
      status === 200 ? "마인드맵 생성 완료" : "생성 실패");
    await saveSettings();
    setTimeout(() => { hideProgress(); renderResult({ status, ...payload }); }, 600);
  } catch (err) {
    updateProgressStep(0, "fail", "생성 실패");
    setTimeout(() => { hideProgress(); renderError(err); }, 600);
  }
});

el.queryBtn.addEventListener("click", async () => {
  showProgress("NotebookLM에 질의 중...", ["💬 질의 전송", "⏳ 응답 대기"]);
  updateProgressStep(0, "active", "질의 전송 중...");

  try {
    const notebookId = getNotebookIdRequired();
    const question = el.questionText.value.trim();
    if (!question) throw new Error("질문을 입력하세요.");

    const finalQuestion = el.manualMode.checked
      ? buildManualFirstQuestion(question)
      : question;

    updateProgressStep(0, "done", "질의 전송 완료");
    updateProgressStep(1, "active", "응답 대기 중...");

    const { status, payload } = await callApi("/api/query", "POST", {
      notebookId,
      question: finalQuestion,
    });

    updateProgressStep(1, status === 200 ? "done" : "fail",
      status === 200 ? "응답 수신 완료" : "질의 실패");

    await saveSettings();
    setTimeout(() => {
      hideProgress();
      renderResult(
        { status, ...payload },
        payload?.answer || null,
      );
    }, 600);
  } catch (err) {
    setTimeout(() => { hideProgress(); renderError(err); }, 600);
  }
});

/* ========== Copy Buttons ========== */
el.copyAnswerBtn.addEventListener("click", async () => {
  if (!lastAnswerText) return;
  try {
    await navigator.clipboard.writeText(lastAnswerText);
    el.copyAnswerBtn.textContent = "✅ Copied!";
    setTimeout(() => { el.copyAnswerBtn.textContent = "📋 Copy Answer"; }, 1500);
  } catch (_) {
    el.copyAnswerBtn.textContent = "❌ Failed";
    setTimeout(() => { el.copyAnswerBtn.textContent = "📋 Copy Answer"; }, 1500);
  }
});

el.copyRawBtn.addEventListener("click", async () => {
  if (!lastRawText) return;
  try {
    await navigator.clipboard.writeText(lastRawText);
    el.copyRawBtn.textContent = "✅ Copied!";
    setTimeout(() => { el.copyRawBtn.textContent = "📋 Copy Raw"; }, 1500);
  } catch (_) {
    el.copyRawBtn.textContent = "❌ Failed";
    setTimeout(() => { el.copyRawBtn.textContent = "📋 Copy Raw"; }, 1500);
  }
});

/* ========== Query Presets ========== */
document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.preset;
    if (QUERY_PRESETS[key]) {
      el.questionText.value = QUERY_PRESETS[key];
      el.questionText.focus();
      // Place cursor at end
      el.questionText.selectionStart = el.questionText.value.length;
      el.questionText.selectionEnd = el.questionText.value.length;
    }
  });
});

/* ========== Auto Save ========== */
document.addEventListener("input", () => {
  saveSettings().catch(() => {});
});

/* ========== Initialization ========== */
async function init() {
  try {
    await loadSettings();
  } catch (_) {
    // Settings load failed, use defaults
  }

  updateSourceCounter();

  // Auto-check bridge and auth
  const bridgeOk = await checkBridgeHealth();
  if (bridgeOk) {
    const authOk = await checkAuth();
    if (authOk) {
      await refreshNotebooks();
    }
  }
}

init();
