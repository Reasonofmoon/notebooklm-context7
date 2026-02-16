const SOURCE_TYPES = new Set(["url", "file", "text", "youtube", "drive"]);
const STORAGE_KEY = "context7CoderSettings";

const elements = {
  bridgeUrl: document.getElementById("bridgeUrl"),
  checkAuthBtn: document.getElementById("checkAuthBtn"),
  listNotebooksBtn: document.getElementById("listNotebooksBtn"),
  createNotebookBtn: document.getElementById("createNotebookBtn"),
  notebookTitle: document.getElementById("notebookTitle"),
  notebookId: document.getElementById("notebookId"),
  repoDir: document.getElementById("repoDir"),
  repoOutput: document.getElementById("repoOutput"),
  repoInclude: document.getElementById("repoInclude"),
  repoIgnore: document.getElementById("repoIgnore"),
  addPackAsSource: document.getElementById("addPackAsSource"),
  packageBtn: document.getElementById("packageBtn"),
  bootstrapBtn: document.getElementById("bootstrapBtn"),
  sourcesText: document.getElementById("sourcesText"),
  ingestBtn: document.getElementById("ingestBtn"),
  manualMode: document.getElementById("manualMode"),
  questionText: document.getElementById("questionText"),
  listSourcesBtn: document.getElementById("listSourcesBtn"),
  mindmapBtn: document.getElementById("mindmapBtn"),
  queryBtn: document.getElementById("queryBtn"),
  copyResultBtn: document.getElementById("copyResultBtn"),
  result: document.getElementById("result"),
};

let lastRenderText = "";

function render(data) {
  lastRenderText =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
  elements.result.textContent = lastRenderText;
}

function getNotebookIdRequired() {
  const notebookId = elements.notebookId.value.trim();
  if (!notebookId) {
    throw new Error("Notebook ID를 먼저 입력하세요.");
  }
  return notebookId;
}

function getBridgeBaseUrl() {
  const base = elements.bridgeUrl.value.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error("Bridge URL이 비어 있습니다.");
  }
  return base;
}

function parseContext7Lines() {
  const lines = elements.sourcesText.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (lines.length > 7) {
    throw new Error("Context7는 최대 7개 소스만 허용됩니다.");
  }

  return lines.map((line, lineIndex) => {
    const [sourceTypeRaw, valueRaw, ...titleParts] = line
      .split("|")
      .map((part) => part.trim());

    const sourceType = String(sourceTypeRaw || "").toLowerCase();
    const value = String(valueRaw || "");
    if (!sourceType || !value) {
      throw new Error(
        `${lineIndex + 1}번째 줄 형식이 올바르지 않습니다. type|value|title`,
      );
    }
    if (!SOURCE_TYPES.has(sourceType)) {
      throw new Error(
        `${lineIndex + 1}번째 줄 sourceType이 유효하지 않습니다: ${sourceType}`,
      );
    }

    return {
      sourceType,
      value,
      title: titleParts.join("|"),
    };
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
    addAsSource: elements.addPackAsSource.checked,
    dir: elements.repoDir.value.trim() || ".",
    output: elements.repoOutput.value.trim() || "repomix-output.md",
    include: elements.repoInclude.value.trim(),
    ignore: elements.repoIgnore.value.trim(),
    style: "markdown",
    sourceTitle: "Repomix Pack",
  };
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const settings = stored[STORAGE_KEY] || {};

  if (settings.bridgeUrl) elements.bridgeUrl.value = settings.bridgeUrl;
  if (settings.notebookTitle) elements.notebookTitle.value = settings.notebookTitle;
  if (settings.notebookId) elements.notebookId.value = settings.notebookId;
  if (settings.repoDir) elements.repoDir.value = settings.repoDir;
  if (settings.repoOutput) elements.repoOutput.value = settings.repoOutput;
  if (settings.repoInclude) elements.repoInclude.value = settings.repoInclude;
  if (settings.repoIgnore) elements.repoIgnore.value = settings.repoIgnore;
  if (typeof settings.addPackAsSource === "boolean") {
    elements.addPackAsSource.checked = settings.addPackAsSource;
  }
  if (typeof settings.manualMode === "boolean") {
    elements.manualMode.checked = settings.manualMode;
  }
  if (settings.sourcesText) elements.sourcesText.value = settings.sourcesText;
  if (settings.questionText) elements.questionText.value = settings.questionText;
}

async function saveSettings() {
  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      bridgeUrl: elements.bridgeUrl.value.trim(),
      notebookTitle: elements.notebookTitle.value.trim(),
      notebookId: elements.notebookId.value.trim(),
      repoDir: elements.repoDir.value.trim(),
      repoOutput: elements.repoOutput.value.trim(),
      repoInclude: elements.repoInclude.value.trim(),
      repoIgnore: elements.repoIgnore.value.trim(),
      addPackAsSource: elements.addPackAsSource.checked,
      manualMode: elements.manualMode.checked,
      sourcesText: elements.sourcesText.value,
      questionText: elements.questionText.value,
    },
  });
}

async function callApi(path, method = "GET", body) {
  const base = getBridgeBaseUrl();
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    return {
      status: 0,
      payload: {
        ok: false,
        error: `Bridge 요청 실패: ${error.message}`,
      },
    };
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch (_error) {
    payload = {
      ok: false,
      error: "Bridge 응답을 JSON으로 파싱하지 못했습니다.",
    };
  }
  return { status: response.status, payload };
}

async function runAction(statusText, action) {
  render(statusText);
  try {
    const result = await action();
    if (result?.payload?.notebookId) {
      elements.notebookId.value = result.payload.notebookId;
    }
    await saveSettings();
    render({
      status: result.status,
      ...result.payload,
    });
  } catch (error) {
    render({
      ok: false,
      error: error.message,
    });
  }
}

elements.checkAuthBtn.addEventListener("click", async () => {
  await runAction("Checking auth...", () => callApi("/api/auth/check", "POST", {}));
});

elements.listNotebooksBtn.addEventListener("click", async () => {
  await runAction("Listing notebooks...", () =>
    callApi("/api/notebook/list", "POST", {}),
  );
});

elements.createNotebookBtn.addEventListener("click", async () => {
  await runAction("Creating notebook...", async () => {
    const title = elements.notebookTitle.value.trim();
    if (!title) {
      throw new Error("Notebook title이 비어 있습니다.");
    }
    return callApi("/api/notebook/create", "POST", { title });
  });
});

elements.packageBtn.addEventListener("click", async () => {
  await runAction("Packaging with repomix...", () =>
    callApi("/api/repomix/package", "POST", buildRepomixConfig()),
  );
});

elements.bootstrapBtn.addEventListener("click", async () => {
  await runAction("Running one-click bootstrap...", async () => {
    const notebookId = elements.notebookId.value.trim();
    const notebookTitle = elements.notebookTitle.value.trim();
    const sources = parseContext7Lines();

    return callApi("/api/flow/bootstrap", "POST", {
      notebookId,
      notebookTitle,
      createNotebookIfMissing: true,
      wait: true,
      repomix: buildRepomixConfig(),
      sources,
    });
  });
});

elements.ingestBtn.addEventListener("click", async () => {
  await runAction("Ingesting Context7...", async () => {
    const notebookId = getNotebookIdRequired();
    const sources = parseContext7Lines();
    return callApi("/api/context7/ingest", "POST", {
      notebookId,
      sources,
      wait: true,
    });
  });
});

elements.listSourcesBtn.addEventListener("click", async () => {
  await runAction("Listing sources...", async () => {
    const notebookId = getNotebookIdRequired();
    return callApi("/api/source/list", "POST", { notebookId });
  });
});

elements.mindmapBtn.addEventListener("click", async () => {
  await runAction("Creating mindmap...", async () => {
    const notebookId = getNotebookIdRequired();
    const baseTitle = elements.notebookTitle.value.trim() || "Context7 Notebook";
    return callApi("/api/mindmap/create", "POST", {
      notebookId,
      title: `${baseTitle} Mindmap`,
    });
  });
});

elements.queryBtn.addEventListener("click", async () => {
  await runAction("Querying NotebookLM...", async () => {
    const notebookId = getNotebookIdRequired();
    const question = elements.questionText.value.trim();
    if (!question) {
      throw new Error("질문을 입력하세요.");
    }

    const finalQuestion = elements.manualMode.checked
      ? buildManualFirstQuestion(question)
      : question;

    return callApi("/api/query", "POST", {
      notebookId,
      question: finalQuestion,
    });
  });
});

elements.copyResultBtn.addEventListener("click", async () => {
  if (!lastRenderText) {
    render("복사할 결과가 없습니다.");
    return;
  }
  try {
    await navigator.clipboard.writeText(lastRenderText);
    render("결과를 클립보드에 복사했습니다.");
  } catch (error) {
    render(`복사 실패: ${error.message}`);
  }
});

document.addEventListener("input", () => {
  saveSettings().catch(() => {});
});

loadSettings()
  .then(() => {
    render("Ready. Bridge Auth Check부터 시작하세요.");
  })
  .catch((error) => {
    render(error.message);
  });
