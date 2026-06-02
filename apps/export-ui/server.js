const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const url = require("url");

const workspace = path.resolve(__dirname, "../..");
const outputDir = process.env.WECHAT_OUTPUT_DIR
  ? path.resolve(process.env.WECHAT_OUTPUT_DIR)
  : path.join(workspace, "output");
const exportsDir = path.join(outputDir, "exports");
const publicDir = path.join(__dirname, "public");

function readJsonSmart(filePath) {
  const raw = fs.readFileSync(filePath);
  const decoders = [
    () => JSON.parse(raw.toString("utf8").replace(/^\uFEFF/, "")),
    () => JSON.parse(raw.toString("utf16le").replace(/^\uFEFF/, "")),
    () => JSON.parse(raw.toString("latin1")),
  ];
  for (const decode of decoders) {
    try {
      return decode();
    } catch (_) {
      // Try the next common Windows redirection encoding.
    }
  }
  throw new Error(`Cannot decode JSON: ${filePath}`);
}

function normalizeSessions(data) {
  const rows = Array.isArray(data) ? data : data.sessions || data.data || [];
  return rows.map((row) => ({
    chat: row.chat || row.name || row.nickname || row.username || "",
    username: row.username || row.wxid || "",
    chat_type: row.chat_type || "",
    is_group: Boolean(row.is_group),
    time: row.time || "",
    unread: Number(row.unread || 0),
    last_msg_type: row.last_msg_type || "",
    summary: row.summary || "",
    timestamp: row.timestamp || 0,
  }));
}

function loadSessions() {
  const sessionsPath = path.join(outputDir, "wx_sessions.json");
  if (!fs.existsSync(sessionsPath)) {
    return [
      {
        chat: "林远航",
        username: "demo_customer_001",
        chat_type: "private",
        is_group: false,
        time: "2026-06-02",
        unread: 0,
        last_msg_type: "text",
        summary: "演示数据：订单、收款、产品和售后沟通。",
        timestamp: 1780368000,
        demo: true,
      },
      {
        chat: "南山跨境小组",
        username: "demo_business_group_001",
        chat_type: "group",
        is_group: true,
        time: "2026-06-02",
        unread: 0,
        last_msg_type: "text",
        summary: "演示数据：项目、运营、渠道和跨境业务讨论。",
        timestamp: 1780367000,
        demo: true,
      },
      {
        chat: "周小北",
        username: "demo_brother_001",
        chat_type: "private",
        is_group: false,
        time: "2026-06-01",
        unread: 0,
        last_msg_type: "text",
        summary: "演示数据：朋友兄弟关系，生活化互动较多。",
        timestamp: 1780281600,
        demo: true,
      },
    ];
  }
  return normalizeSessions(readJsonSmart(sessionsPath));
}

function safeFileName(name) {
  return String(name || "chat")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "chat";
}

function runWxCli(args) {
  return new Promise((resolve, reject) => {
    const executable = process.platform === "win32" ? "cmd.exe" : "npx";
    const commandArgs = process.platform === "win32"
      ? ["/d", "/s", "/c", "npx.cmd", "@jackwener/wx-cli", ...args]
      : ["@jackwener/wx-cli", ...args];
    const child = spawn(executable, commandArgs, {
      cwd: workspace,
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error((stderr || stdout || `wx-cli exited with ${code}`).trim()));
      }
    });
  });
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  const target = pathname === "/" ? path.join(publicDir, "index.html") : path.join(publicDir, pathname);
  const resolved = path.resolve(target);
  if (!resolved.startsWith(publicDir) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(resolved).toLowerCase();
  const contentType = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
  }[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(resolved).pipe(res);
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  try {
    if (req.method === "GET" && parsed.pathname === "/api/sessions") {
      sendJson(res, 200, { sessions: loadSessions() });
      return;
    }

    if (req.method === "POST" && parsed.pathname === "/api/refresh") {
      fs.mkdirSync(outputDir, { recursive: true });
      const { stdout } = await runWxCli(["sessions", "--json", "-n", "500"]);
      fs.writeFileSync(path.join(outputDir, "wx_sessions.json"), stdout, "utf8");
      sendJson(res, 200, { sessions: normalizeSessions(JSON.parse(stdout)) });
      return;
    }

    if (req.method === "POST" && parsed.pathname === "/api/export") {
      const body = await readRequestJson(req);
      const chat = String(body.chat || "").trim();
      const format = ["markdown", "txt", "json", "yaml"].includes(body.format) ? body.format : "markdown";
      const limit = Math.max(1, Math.min(Number(body.limit || 10000), 100000));
      const since = String(body.since || "").trim();
      const until = String(body.until || "").trim();
      if (!chat) {
        sendJson(res, 400, { error: "请选择聊天对象" });
        return;
      }
      if (String(body.username || "").startsWith("demo_")) {
        sendJson(res, 400, { error: "当前是演示会话。请先刷新真实微信会话，再导出聊天记录。" });
        return;
      }
      fs.mkdirSync(exportsDir, { recursive: true });
      const ext = format === "markdown" ? "md" : format;
      const output = path.join(exportsDir, `${safeFileName(chat)}.${ext}`);
      const args = ["export", chat, "--format", format, "--limit", String(limit), "--output", output];
      if (since) args.push("--since", since);
      if (until) args.push("--until", until);
      const result = await runWxCli(args);
      sendJson(res, 200, {
        chat,
        output,
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
      });
      return;
    }

    if (req.method === "GET" && parsed.pathname === "/api/exports") {
      fs.mkdirSync(exportsDir, { recursive: true });
      const files = fs.readdirSync(exportsDir).map((name) => {
        const fullPath = path.join(exportsDir, name);
        const stat = fs.statSync(fullPath);
        return { name, path: fullPath, size: stat.size, modified: stat.mtimeMs };
      }).sort((a, b) => b.modified - a.modified);
      sendJson(res, 200, { files });
      return;
    }

    serveStatic(req, res, decodeURIComponent(parsed.pathname));
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

const port = Number(process.env.PORT || 4789);
server.listen(port, "127.0.0.1", () => {
  console.log(`WeChat export UI: http://127.0.0.1:${port}`);
});
