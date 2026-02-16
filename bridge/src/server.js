import cors from "cors";
import express from "express";
import path from "node:path";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = Number(process.env.PORT || 4317);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRIDGE_ROOT = path.resolve(__dirname, "..");
const PROJECT_ROOT = path.resolve(BRIDGE_ROOT, "..");
const DEFAULT_WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, "..", "..");
const WORKSPACE_ROOT = path.resolve(
  process.env.WORKSPACE_ROOT || DEFAULT_WORKSPACE_ROOT,
);
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const SOURCE_FLAG_MAP = {
  url: "--url",
  text: "--text",
  file: "--file",
  youtube: "--youtube",
  drive: "--drive",
};
const DIRECT_FILE_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".csv",
  ".tsv",
]);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function runCommand(command, args, options = {}) {
  const cwd = options.cwd || WORKSPACE_ROOT;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const shell = options.shell === true;

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd,
        shell,
        windowsHide: true,
        env: process.env,
      });
    } catch (error) {
      resolve({
        ok: false,
        code: -1,
        stdout: "",
        stderr: error.message,
        timedOut: false,
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0 && !timedOut,
        code: code ?? -1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timedOut,
      });
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        code: -1,
        stdout: stdout.trim(),
        stderr: `${stderr}\n${error.message}`.trim(),
        timedOut,
      });
    });
  });
}

function runNlm(args, options = {}) {
  return runCommand("nlm", args, options);
}

function runRepomix(args, options = {}) {
  return runCommand("npx", ["-y", "repomix", ...args], {
    ...options,
    shell: true,
  });
}

function parseNotebookId(text) {
  const match = text.match(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
  );
  return match ? match[0] : null;
}

function extractJsonPayload(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const startBracket = trimmed.indexOf("[");
    const startBrace = trimmed.indexOf("{");
    let start = -1;
    if (startBracket >= 0 && startBrace >= 0) {
      start = Math.min(startBracket, startBrace);
    } else {
      start = Math.max(startBracket, startBrace);
    }
    const end = Math.max(trimmed.lastIndexOf("]"), trimmed.lastIndexOf("}"));
    if (start >= 0 && end > start) {
      const candidate = trimmed.slice(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch (_error2) {
        return null;
      }
    }
  }
  return null;
}

function resolveInsideWorkspace(targetPath) {
  const resolved = path.resolve(WORKSPACE_ROOT, targetPath);
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error("Path must stay inside WORKSPACE_ROOT");
  }
  return resolved;
}

function badRequest(res, message) {
  return res.status(400).json({
    ok: false,
    error: message,
  });
}

function normalizeSource(rawSource, index) {
  const source = rawSource || {};
  const sourceType = String(source.sourceType || "").trim();
  const value = String(source.value || "").trim();
  const title = String(source.title || "").trim();
  if (!sourceType || !value) {
    return {
      ok: false,
      index,
      error: "sourceType and value are required",
    };
  }
  if (!SOURCE_FLAG_MAP[sourceType]) {
    return {
      ok: false,
      index,
      error: "invalid sourceType",
    };
  }
  return {
    ok: true,
    index,
    sourceType,
    value,
    title,
  };
}

async function addSourceToNotebook({ notebookId, sourceType, value, title, wait }) {
  const buildArgs = (inputValue, inputTitle) => {
    const args = [
      "source",
      "add",
      notebookId,
      SOURCE_FLAG_MAP[sourceType],
      inputValue,
    ];
    if (inputTitle) {
      args.push("--title", inputTitle);
    }
    if (wait) {
      args.push("--wait");
    }
    return args;
  };

  const initialResult = await runNlm(buildArgs(value, title), {
    timeoutMs: 180_000,
  });

  if (initialResult.ok || sourceType !== "file") {
    return initialResult;
  }

  const extension = path.extname(String(value || "")).toLowerCase();
  if (DIRECT_FILE_EXTENSIONS.has(extension)) {
    return initialResult;
  }

  const originalPath = path.isAbsolute(value)
    ? value
    : path.resolve(WORKSPACE_ROOT, value);
  try {
    const raw = await fs.readFile(originalPath, "utf8");
    const wrapperDir = path.join(WORKSPACE_ROOT, ".context7-wrapped");
    await fs.mkdir(wrapperDir, { recursive: true });

    const safeBase = path
      .basename(originalPath)
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const wrappedPath = path.join(
      wrapperDir,
      `${Date.now()}-${safeBase}.md`,
    );
    const fenceLanguage = extension.replace(".", "") || "txt";
    const wrapped = [
      `# Source: ${path.basename(originalPath)}`,
      "",
      `Original path: \`${originalPath}\``,
      "",
      `\`\`\`${fenceLanguage}`,
      raw,
      "```",
      "",
    ].join("\n");

    await fs.writeFile(wrappedPath, wrapped, "utf8");
    const fallbackTitle = title
      ? `${title} (wrapped)`
      : `${path.basename(originalPath)} (wrapped)`;
    const fallbackResult = await runNlm(buildArgs(wrappedPath, fallbackTitle), {
      timeoutMs: 180_000,
    });

    return {
      ...fallbackResult,
      fallback: {
        used: true,
        originalPath,
        wrappedPath,
        originalError: [initialResult.stdout, initialResult.stderr]
          .filter(Boolean)
          .join(" | "),
      },
    };
  } catch (_error) {
    return initialResult;
  }
}

async function ingestContextSources({ notebookId, sources, wait }) {
  const results = [];
  for (let i = 0; i < sources.length; i += 1) {
    const normalized = normalizeSource(sources[i], i);
    if (!normalized.ok) {
      results.push(normalized);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const result = await addSourceToNotebook({
      notebookId,
      sourceType: normalized.sourceType,
      value: normalized.value,
      title: normalized.title,
      wait,
    });
    results.push({
      index: i,
      sourceType: normalized.sourceType,
      value: normalized.value,
      title: normalized.title,
      ...result,
    });
  }
  return results;
}

async function createNotebook(title) {
  const result = await runNlm(["notebook", "create", title], {
    timeoutMs: 60_000,
  });
  return {
    ...result,
    notebookId: parseNotebookId(`${result.stdout}\n${result.stderr}`),
  };
}

async function packageWithRepomix(options) {
  const relDir = String(options?.dir || ".").trim();
  const output = String(options?.output || "repomix-output.md").trim();
  const style = String(options?.style || "markdown").trim();
  const include = String(options?.include || "").trim();
  const ignore = String(options?.ignore || "").trim();
  const compress = options?.compress !== false;
  const removeComments = options?.removeComments !== false;
  const removeEmptyLines = options?.removeEmptyLines !== false;

  const cwd = resolveInsideWorkspace(relDir);
  const outputPath = path.resolve(cwd, output);

  const args = [cwd, "--output", output, "--style", style];
  if (compress) args.push("--compress");
  if (removeComments) args.push("--remove-comments");
  if (removeEmptyLines) args.push("--remove-empty-lines");
  if (include) args.push("--include", include);
  if (ignore) args.push("--ignore", ignore);

  const result = await runRepomix(args, { cwd, timeoutMs: 180_000 });
  return {
    ...result,
    cwd,
    output,
    outputPath,
    style,
  };
}

app.get("/api/health", async (_req, res) => {
  const [nlmVersion, repomixVersion] = await Promise.all([
    runNlm(["--version"], { timeoutMs: 30_000 }),
    runRepomix(["--version"], { timeoutMs: 30_000 }),
  ]);

  res.json({
    ok: true,
    workspaceRoot: WORKSPACE_ROOT,
    tools: {
      nlm: nlmVersion,
      repomix: repomixVersion,
    },
  });
});

app.post("/api/auth/check", async (_req, res) => {
  const result = await runNlm(["login", "--check"], { timeoutMs: 30_000 });
  res.status(result.ok ? 200 : 401).json({
    ok: result.ok,
    ...result,
    hint: result.ok ? null : "Run: nlm login",
  });
});

app.post("/api/notebook/list", async (_req, res) => {
  const result = await runNlm(["notebook", "list", "--json"], {
    timeoutMs: 60_000,
  });
  const data = extractJsonPayload(result.stdout);
  res.status(result.ok ? 200 : 500).json({
    ok: result.ok,
    data,
    ...result,
  });
});

app.post("/api/notebook/create", async (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title) {
    return badRequest(res, "title is required");
  }

  const result = await createNotebook(title);
  res.status(result.ok ? 200 : 500).json({
    ok: result.ok,
    ...result,
  });
});

app.post("/api/source/list", async (req, res) => {
  const notebookId = String(req.body?.notebookId || "").trim();
  if (!notebookId) {
    return badRequest(res, "notebookId is required");
  }

  const result = await runNlm(["source", "list", notebookId, "--json"], {
    timeoutMs: 60_000,
  });
  const data = extractJsonPayload(result.stdout);
  res.status(result.ok ? 200 : 500).json({
    ok: result.ok,
    data,
    ...result,
  });
});

app.post("/api/source/add", async (req, res) => {
  const notebookId = String(req.body?.notebookId || "").trim();
  const sourceType = String(req.body?.sourceType || "").trim();
  const value = String(req.body?.value || "").trim();
  const title = String(req.body?.title || "").trim();
  const wait = req.body?.wait !== false;

  if (!notebookId) {
    return badRequest(res, "notebookId is required");
  }
  if (!sourceType || !value) {
    return badRequest(res, "sourceType and value are required");
  }
  if (!SOURCE_FLAG_MAP[sourceType]) {
    return badRequest(
      res,
      "sourceType must be one of: url,text,file,youtube,drive",
    );
  }

  const result = await addSourceToNotebook({
    notebookId,
    sourceType,
    value,
    title,
    wait,
  });
  res.status(result.ok ? 200 : 500).json({
    ok: result.ok,
    ...result,
  });
});

app.post("/api/context7/ingest", async (req, res) => {
  const notebookId = String(req.body?.notebookId || "").trim();
  const sources = Array.isArray(req.body?.sources) ? req.body.sources : [];
  const wait = req.body?.wait !== false;

  if (!notebookId) {
    return badRequest(res, "notebookId is required");
  }
  if (sources.length === 0) {
    return badRequest(res, "sources is required");
  }
  if (sources.length > 7) {
    return badRequest(res, "Context7 accepts up to 7 sources");
  }

  const results = await ingestContextSources({
    notebookId,
    sources,
    wait,
  });
  const allOk = results.every((entry) => entry.ok);
  res.status(allOk ? 200 : 207).json({
    ok: allOk,
    notebookId,
    count: results.length,
    results,
  });
});

app.post("/api/query", async (req, res) => {
  const notebookId = String(req.body?.notebookId || "").trim();
  const question = String(req.body?.question || "").trim();
  const sourceIds = String(req.body?.sourceIds || "").trim();
  const conversationId = String(req.body?.conversationId || "").trim();

  if (!notebookId || !question) {
    return badRequest(res, "notebookId and question are required");
  }

  const args = ["query", "notebook", notebookId, question];
  if (sourceIds) {
    args.push("--source-ids", sourceIds);
  }
  if (conversationId) {
    args.push("--conversation-id", conversationId);
  }

  const result = await runNlm(args, { timeoutMs: 120_000 });
  const data = extractJsonPayload(result.stdout);
  const value = data && typeof data === "object" ? data.value : null;
  res.status(result.ok ? 200 : 500).json({
    ok: result.ok,
    data,
    answer:
      value && typeof value === "object" ? String(value.answer || "") : null,
    returnedConversationId:
      value && typeof value === "object"
        ? String(value.conversation_id || "")
        : null,
    sourcesUsed:
      value && typeof value === "object" ? value.sources_used || [] : [],
    ...result,
  });
});

app.post("/api/mindmap/create", async (req, res) => {
  const notebookId = String(req.body?.notebookId || "").trim();
  const title = String(req.body?.title || "Mind Map").trim();
  const sourceIds = String(req.body?.sourceIds || "").trim();

  if (!notebookId) {
    return badRequest(res, "notebookId is required");
  }

  const args = ["mindmap", "create", notebookId, "--title", title, "--confirm"];
  if (sourceIds) {
    args.push("--source-ids", sourceIds);
  }
  const result = await runNlm(args, { timeoutMs: 180_000 });
  res.status(result.ok ? 200 : 500).json({
    ok: result.ok,
    ...result,
  });
});

app.post("/api/repomix/package", async (req, res) => {
  try {
    const result = await packageWithRepomix(req.body || {});
    res.status(result.ok ? 200 : 500).json({
      ok: result.ok,
      ...result,
    });
  } catch (error) {
    return badRequest(res, error.message);
  }
});

app.post("/api/flow/bootstrap", async (req, res) => {
  const notebookIdInput = String(req.body?.notebookId || "").trim();
  const notebookTitle = String(req.body?.notebookTitle || "").trim();
  const createNotebookIfMissing = req.body?.createNotebookIfMissing !== false;
  const context7Sources = Array.isArray(req.body?.sources) ? req.body.sources : [];
  const wait = req.body?.wait !== false;
  const repomix = req.body?.repomix || {};
  const shouldPackage = repomix.enabled !== false;
  const addPackAsSource = repomix.addAsSource !== false;

  if (context7Sources.length > 7) {
    return badRequest(res, "Context7 accepts up to 7 sources");
  }

  let notebookId = notebookIdInput;
  const steps = {
    notebook: null,
    repomix: null,
    repomixSource: null,
    context7: null,
  };

  if (!notebookId && createNotebookIfMissing) {
    if (!notebookTitle) {
      return badRequest(
        res,
        "Provide notebookId or notebookTitle when createNotebookIfMissing is true",
      );
    }
    const created = await createNotebook(notebookTitle);
    steps.notebook = created;
    notebookId = created.notebookId || "";
    if (!created.ok || !notebookId) {
      return res.status(500).json({
        ok: false,
        error: "Failed to create notebook",
        steps,
      });
    }
  }

  if (!notebookId) {
    return badRequest(
      res,
      "notebookId is required if createNotebookIfMissing is false",
    );
  }

  let packPath = "";
  if (shouldPackage) {
    try {
      const packaged = await packageWithRepomix(repomix);
      steps.repomix = packaged;
      if (!packaged.ok) {
        return res.status(500).json({
          ok: false,
          error: "Repomix packaging failed",
          notebookId,
          steps,
        });
      }
      packPath = packaged.outputPath;
    } catch (error) {
      return badRequest(res, error.message);
    }
  }

  if (shouldPackage && addPackAsSource && packPath) {
    const sourceResult = await addSourceToNotebook({
      notebookId,
      sourceType: "file",
      value: packPath,
      title: String(repomix.sourceTitle || "Repomix Pack").trim(),
      wait,
    });
    steps.repomixSource = sourceResult;
    if (!sourceResult.ok) {
      return res.status(500).json({
        ok: false,
        error: "Failed to add repomix output as NotebookLM source",
        notebookId,
        steps,
      });
    }
  }

  if (context7Sources.length > 0) {
    const ingestResults = await ingestContextSources({
      notebookId,
      sources: context7Sources,
      wait,
    });
    steps.context7 = {
      ok: ingestResults.every((entry) => entry.ok),
      count: ingestResults.length,
      results: ingestResults,
    };
    if (!steps.context7.ok) {
      return res.status(207).json({
        ok: false,
        error: "Context7 ingestion partially failed",
        notebookId,
        steps,
      });
    }
  }

  return res.status(200).json({
    ok: true,
    notebookId,
    steps,
  });
});

app.use((error, _req, res, _next) => {
  res.status(500).json({
    ok: false,
    error: error.message,
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[context7-bridge] listening on http://localhost:${PORT} (workspace: ${WORKSPACE_ROOT})`,
  );
});
