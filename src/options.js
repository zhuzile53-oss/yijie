const $ = (id) => document.getElementById(id);

const D = globalThis.YJ_DEFAULTS || {};
const DEFAULT_BASE = D.baseUrl || "https://api.deepseek.com/v1";
const DEFAULT_MODEL = D.model || "deepseek-chat";
const DEFAULT_SYSTEM = D.systemPrompt || "";
const DEFAULT_DETAIL = D.detailPrompt || "";

const PRESETS = {
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  ollama: { baseUrl: "http://localhost:11434/v1", model: "qwen2.5:7b" }
};

function status(text) {
  $("status").textContent = text;
}

// Key 区分大小写：只去不可见字符和首尾空白，绝不做大小写转换
function cleanKey(s) {
  return String(s || "").replace(/[\u200b-\u200f\ufeff]/g, "").trim();
}

// 允许只填 api.deepseek.com/v1 这种省略协议的写法；本地地址默认 http
function cleanBase(s) {
  let v = String(s || "").trim();
  if (!v) return DEFAULT_BASE;
  if (!/^https?:\/\//i.test(v)) {
    const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|192\.168\.|10\.)/i.test(v);
    v = (isLocal ? "http://" : "https://") + v;
  }
  return v.replace(/\/+$/, "");
}

function endpoint(baseUrl) {
  return /\/chat\/completions\/?$/.test(baseUrl) ? baseUrl : baseUrl + "/chat/completions";
}

function originOf(baseUrl) {
  try {
    return new URL(baseUrl).origin;
  } catch (e) {
    return baseUrl;
  }
}

// 自定义接口（Ollama、中转站）必须在用户点击时申请该域名的 host 权限，否则 fetch 会被拦。
// 必须在点击事件的同步阶段调用 request，不能先 await 别的东西，否则用户手势会失效。
function ensureHostPermission(baseUrl) {
  let pattern;
  try {
    const u = new URL(baseUrl);
    if (!/^https?:$/.test(u.protocol)) return Promise.resolve(true);
    pattern = u.origin + "/*";
  } catch (e) {
    return Promise.resolve(true); // 地址本身有问题，交给 fetch 去报错
  }
  if (!chrome.permissions || !chrome.permissions.request) return Promise.resolve(true);
  try {
    return chrome.permissions
      .request({ origins: [pattern] })
      .then((ok) => !!ok)
      .catch(() => false);
  } catch (e) {
    return Promise.resolve(false);
  }
}

function matchPreset(baseUrl) {
  for (const key of Object.keys(PRESETS)) {
    if (PRESETS[key].baseUrl === baseUrl) return key;
  }
  return "custom";
}

chrome.storage.local.get(["apiKey", "baseUrl", "model", "systemPrompt", "detailPrompt"], (s) => {
  const baseUrl = s.baseUrl || DEFAULT_BASE;
  $("apiKey").value = s.apiKey || "";
  $("baseUrl").value = baseUrl;
  $("model").value = s.model || DEFAULT_MODEL;
  $("systemPrompt").value = s.systemPrompt || DEFAULT_SYSTEM;
  $("detailPrompt").value = s.detailPrompt || DEFAULT_DETAIL;
  $("preset").value = matchPreset(baseUrl);
});

$("preset").addEventListener("change", () => {
  const p = PRESETS[$("preset").value];
  if (!p) return;
  $("baseUrl").value = p.baseUrl;
  $("model").value = p.model;
  status("已填入预设，记得点保存");
});

$("save").addEventListener("click", async () => {
  const apiKey = cleanKey($("apiKey").value);
  if (!apiKey) {
    status("请先填写 API Key");
    return;
  }
  const baseUrl = cleanBase($("baseUrl").value);
  const model = String($("model").value || "").trim() || DEFAULT_MODEL;
  const systemPrompt = String($("systemPrompt").value || "").trim() || DEFAULT_SYSTEM;
  const detailPrompt = String($("detailPrompt").value || "").trim() || DEFAULT_DETAIL;

  const granted = await ensureHostPermission(baseUrl);
  if (!granted) {
    status("❌ 没有获得访问 " + originOf(baseUrl) + " 的授权，无法调用接口");
    return;
  }
  chrome.storage.local.set({ apiKey, baseUrl, model, systemPrompt, detailPrompt }, () => {
    $("baseUrl").value = baseUrl;
    $("preset").value = matchPreset(baseUrl);
    status("✅ 已保存");
  });
});

$("resetPrompts").addEventListener("click", () => {
  $("systemPrompt").value = DEFAULT_SYSTEM;
  $("detailPrompt").value = DEFAULT_DETAIL;
  status("已恢复默认提示词，记得点保存");
});

$("clearKey").addEventListener("click", () => {
  chrome.storage.local.remove("apiKey", () => {
    $("apiKey").value = "";
    status("已清除 Key");
  });
});

function renderDisabled() {
  chrome.storage.local.get(["disabledSites"], (s) => {
    const list = Array.isArray(s.disabledSites) ? s.disabledSites.slice() : [];
    const box = $("disabledList");
    box.textContent = "";
    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "（还没有禁用的站点）";
      box.appendChild(empty);
      return;
    }
    list.forEach((host) => {
      const row = document.createElement("div");
      row.className = "site-row";
      const name = document.createElement("span");
      name.textContent = host;
      const btn = document.createElement("button");
      btn.className = "ghost";
      btn.textContent = "恢复";
      btn.addEventListener("click", () => {
        chrome.storage.local.set({ disabledSites: list.filter((h) => h !== host) }, renderDisabled);
      });
      row.appendChild(name);
      row.appendChild(btn);
      box.appendChild(row);
    });
  });
}

$("clearSites").addEventListener("click", () => {
  chrome.storage.local.set({ disabledSites: [] }, () => {
    renderDisabled();
    status("已恢复所有站点");
  });
});

renderDisabled();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "disabledSites" in changes) renderDisabled();
});

$("test").addEventListener("click", async () => {
  const apiKey = cleanKey($("apiKey").value);
  if (!apiKey) {
    status("请先填写 API Key");
    return;
  }
  const baseUrl = cleanBase($("baseUrl").value);
  const model = String($("model").value || "").trim() || DEFAULT_MODEL;

  const granted = await ensureHostPermission(baseUrl);
  if (!granted) {
    status("❌ 没有获得访问 " + originOf(baseUrl) + " 的授权");
    return;
  }
  $("baseUrl").value = baseUrl;
  status("测试中…");
  try {
    const r = await fetch(endpoint(baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: "user", content: "只回复 ok" }],
        max_tokens: 8
      })
    });
    if (r.ok) {
      status("✅ 连接成功");
      return;
    }
    let msg = "HTTP " + r.status;
    try {
      msg = (await r.json())?.error?.message || msg;
    } catch (e) {}
    const icon = r.status === 401 ? "❌ Key 无效：" : r.status === 404 ? "❌ 地址或模型不对：" : "❌ ";
    status(icon + msg);
  } catch (e) {
    const m = String((e && e.message) || e);
    status(/Failed to fetch|NetworkError/i.test(m) ? "❌ 连不上该地址：检查地址、网络或代理" : "❌ " + m);
  }
});
