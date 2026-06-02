const state = {
  sessions: [],
  filtered: [],
  selected: null,
};

const el = {
  sessionCount: document.getElementById("sessionCount"),
  searchInput: document.getElementById("searchInput"),
  refreshButton: document.getElementById("refreshButton"),
  sessionList: document.getElementById("sessionList"),
  selectedTitle: document.getElementById("selectedTitle"),
  selectedUsername: document.getElementById("selectedUsername"),
  selectedType: document.getElementById("selectedType"),
  selectedTime: document.getElementById("selectedTime"),
  selectedSummary: document.getElementById("selectedSummary"),
  formatSelect: document.getElementById("formatSelect"),
  limitInput: document.getElementById("limitInput"),
  sinceInput: document.getElementById("sinceInput"),
  untilInput: document.getElementById("untilInput"),
  exportButton: document.getElementById("exportButton"),
  reloadExports: document.getElementById("reloadExports"),
  exportsList: document.getElementById("exportsList"),
  statusBox: document.getElementById("statusBox"),
};

function setStatus(text) {
  el.statusBox.textContent = text;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

function formatType(session) {
  if (!session) return "-";
  if (session.is_group) return "群聊";
  if (session.chat_type === "private") return "私聊";
  return session.chat_type || "-";
}

function renderSessions() {
  const query = el.searchInput.value.trim().toLowerCase();
  state.filtered = state.sessions.filter((session) => {
    const text = `${session.chat} ${session.username} ${session.summary}`.toLowerCase();
    return text.includes(query);
  });

  el.sessionCount.textContent = `${state.sessions.length} 个会话`;
  el.sessionList.innerHTML = "";

  for (const session of state.filtered) {
    const button = document.createElement("button");
    button.className = `session-item${state.selected?.username === session.username ? " active" : ""}`;
    button.innerHTML = `
      <div>
        <div class="session-title"></div>
        <div class="session-summary"></div>
      </div>
      <div class="session-time"></div>
    `;
    button.querySelector(".session-title").textContent = session.chat || session.username;
    button.querySelector(".session-summary").textContent = session.summary || session.username;
    button.querySelector(".session-time").textContent = session.time || "";
    button.addEventListener("click", () => selectSession(session));
    el.sessionList.appendChild(button);
  }
}

function selectSession(session) {
  state.selected = session;
  el.selectedTitle.textContent = session.chat || session.username;
  el.selectedUsername.textContent = session.username || "-";
  el.selectedType.textContent = formatType(session);
  el.selectedTime.textContent = session.time || "-";
  el.selectedSummary.textContent = session.summary || "-";
  el.exportButton.disabled = false;
  renderSessions();
}

async function loadSessions(refresh = false) {
  setStatus(refresh ? "正在刷新真实微信会话..." : "正在载入会话...");
  const data = refresh
    ? await api("/api/refresh", { method: "POST", body: "{}" })
    : await api("/api/sessions");
  state.sessions = data.sessions || [];
  state.sessions.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  if (!state.selected && state.sessions.length) {
    selectSession(state.sessions[0]);
  }
  renderSessions();
  setStatus(refresh ? "会话已刷新" : "就绪。没有真实会话文件时会显示演示数据。");
}

async function loadExports() {
  const data = await api("/api/exports");
  el.exportsList.innerHTML = "";
  if (!data.files.length) {
    el.exportsList.innerHTML = `<div class="export-row"><div>暂无导出文件</div></div>`;
    return;
  }
  for (const file of data.files) {
    const row = document.createElement("div");
    row.className = "export-row";
    row.innerHTML = `
      <div>
        <strong></strong>
        <div class="export-path"></div>
      </div>
      <div></div>
    `;
    row.querySelector("strong").textContent = file.name;
    row.querySelector(".export-path").textContent = file.path;
    row.lastElementChild.textContent = `${Math.max(1, Math.round(file.size / 1024))} KB`;
    el.exportsList.appendChild(row);
  }
}

async function exportSelected() {
  if (!state.selected) return;
  const payload = {
    chat: state.selected.chat || state.selected.username,
    username: state.selected.username,
    format: el.formatSelect.value,
    limit: Number(el.limitInput.value || 10000),
    since: el.sinceInput.value,
    until: el.untilInput.value,
  };
  el.exportButton.disabled = true;
  setStatus(`正在导出：${payload.chat}`);
  try {
    const data = await api("/api/export", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setStatus(`${data.stdout || "导出完成"}\n\n${data.output}`);
    await loadExports();
  } catch (error) {
    setStatus(`导出失败：${error.message}`);
  } finally {
    el.exportButton.disabled = false;
  }
}

el.searchInput.addEventListener("input", renderSessions);
el.refreshButton.addEventListener("click", () => loadSessions(true).catch((error) => setStatus(error.message)));
el.exportButton.addEventListener("click", exportSelected);
el.reloadExports.addEventListener("click", () => loadExports().catch((error) => setStatus(error.message)));

loadSessions(false)
  .then(loadExports)
  .catch((error) => setStatus(error.message));
