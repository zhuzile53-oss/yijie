const $ = (id) => document.getElementById(id);

const D = globalThis.YJ_DEFAULTS || {};
const DEFAULT_BASE = D.baseUrl || "https://api.deepseek.com/v1";
const DEFAULT_MODEL = D.model || "deepseek-chat";
const DEFAULT_SYSTEM = D.systemPrompt || "";
const DEFAULT_DETAIL = D.detailPrompt || "";
const DEFAULT_SYSTEM_ZH = D.systemPromptZh || "";
const DEFAULT_DETAIL_ZH = D.detailPromptZh || "";

const PRESETS = {
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  ollama: { baseUrl: "http://localhost:11434/v1", model: "qwen2.5:7b" }
};

// 设置页跟着浏览器语言走（和面板不同：面板跟的是"这次输出什么语言"）
const UI_LANG = String(navigator.language || "en").toLowerCase().startsWith("zh") ? "zh" : "en";

const STR = {
  zh: {
    pageTitle: "译解 · 设置",
    intro: "选中网页上的文字 → 点左侧「解释」按钮 → 右侧显示中文翻译与讲解。请求直接从你的浏览器发往下面填写的接口，不经过任何第三方服务器。",
    apiKeyLabel: "API Key",
    apiKeyPlaceholder: "粘贴你的 API Key",
    apiKeyHint: "只保存在本机浏览器存储里，不会上传。DeepSeek 在 platform.deepseek.com 申请，OpenAI 在 platform.openai.com 申请。",
    presetLabel: "服务预设",
    presetDeepseek: "DeepSeek（推荐）",
    presetOpenai: "OpenAI",
    presetOllama: "本地 Ollama",
    presetCustom: "自定义 / 其他 OpenAI 兼容服务",
    baseUrlLabel: "接口地址",
    baseUrlHint: "填到 /v1 这一层即可，程序自动拼 /chat/completions；直接粘贴完整地址也能识别。换自定义域名时浏览器会弹窗请求访问授权，点「允许」才能用。",
    modelLabel: "模型",
    modelHint: "DeepSeek 用 deepseek-chat；OpenAI 用 gpt-4o-mini；Ollama 填本地拉取的模型名，如 qwen2.5:7b。",
    promptsTitle: "提示词",
    promptsIntro: "决定模型怎么解释。改完点「保存」立即生效，已打开的页面也不用刷新。",
    outputLangLabel: "输出语言",
    outputLangAuto: "自动：原文是中文 → 用英文解释；其他 → 用中文解释",
    outputLangZh: "始终用中文解释",
    detailsEnZh: "英文原文 → 中文讲解",
    defaultPromptLabel: "默认提示词 · 点「解释」时使用",
    detailPromptLabel: "详解提示词 · 面板里点「详解」时使用",
    detailsZhEn: "中文原文 → English explanation",
    zhEnHint: "选中中文时用这两段，输出英文，给读中文网站的英语用户。上方「输出语言」选「始终中文」时这两段不生效。",
    zhDefaultLabel: "默认提示词 · 点「解释」时使用",
    zhDetailLabel: "详解提示词 · 面板里点「详解」时使用",
    save: "保存",
    test: "测试连接",
    resetPrompts: "恢复默认提示词",
    clearKey: "清除 Key",
    disabledTitle: "已禁用的站点",
    disabledIntro: "在面板里点「本站禁用」会加到这里。点「恢复」立刻生效，不用刷新页面。",
    restoreAll: "全部恢复",
    usage: "用法：选中一段文字 → 点屏幕左侧「解释」按钮（或按 Alt+E）→ 右侧弹出面板，可切「详解」、可复制。",
    needKey: "请先填写 API Key",
    saved: "✅ 已保存",
    noPermission: "❌ 没有获得访问 {origin} 的授权，无法调用接口",
    promptsReset: "已恢复默认提示词，记得点保存",
    keyCleared: "已清除 Key",
    testing: "测试中…",
    testOk: "✅ 连接成功",
    test401: "❌ Key 无效：",
    test404: "❌ 地址或模型不对：",
    testFail: "❌ ",
    testNet: "❌ 连不上该地址：检查地址、网络或代理",
    presetFilled: "已填入预设，记得点保存",
    noneDisabled: "（还没有禁用的站点）",
    restore: "恢复",
    restoredAll: "已恢复所有站点"
  },
  en: {
    pageTitle: "Yijie · Settings",
    intro: "Select text on a page → click Explain on the left edge → read the explanation in the side panel. Requests go straight from your browser to the endpoint below; no third-party server is involved.",
    apiKeyLabel: "API key",
    apiKeyPlaceholder: "Paste your API key",
    apiKeyHint: "Stored on this device only, never uploaded. Get one at platform.deepseek.com or platform.openai.com.",
    presetLabel: "Provider preset",
    presetDeepseek: "DeepSeek (recommended)",
    presetOpenai: "OpenAI",
    presetOllama: "Local Ollama",
    presetCustom: "Custom / another OpenAI-compatible service",
    baseUrlLabel: "Base URL",
    baseUrlHint: "Fill it up to /v1 — the extension appends /chat/completions itself, and a full URL works too. Changing to a custom domain makes the browser ask for permission once; click Allow.",
    modelLabel: "Model",
    modelHint: "deepseek-chat for DeepSeek, gpt-4o-mini for OpenAI, or a local model name such as qwen2.5:7b for Ollama.",
    promptsTitle: "Prompts",
    promptsIntro: "These control how the model explains. Changes take effect on Save — no page reload needed.",
    outputLangLabel: "Output language",
    outputLangAuto: "Auto: Chinese source → English answer; anything else → Chinese answer",
    outputLangZh: "Always answer in Chinese",
    detailsEnZh: "English source → Chinese explanation",
    defaultPromptLabel: "Default prompt · used by Explain",
    detailPromptLabel: "Detailed prompt · used by the Detailed button",
    detailsZhEn: "Chinese source → English explanation",
    zhEnHint: "Used when the selection is Chinese; the answer comes back in English. Ignored when Output language is set to Always Chinese.",
    zhDefaultLabel: "Default prompt · used by Explain",
    zhDetailLabel: "Detailed prompt · used by the Detailed button",
    save: "Save",
    test: "Test connection",
    resetPrompts: "Reset prompts",
    clearKey: "Clear key",
    disabledTitle: "Disabled sites",
    disabledIntro: "Sites you turned off from the panel appear here. Restore takes effect immediately, no page reload.",
    restoreAll: "Restore all",
    usage: "Usage: select some text → click Explain on the left edge (or press Alt+E) → the panel opens with a Detailed toggle and Copy.",
    needKey: "Enter an API key first",
    saved: "✅ Saved",
    noPermission: "❌ Permission to reach {origin} was not granted",
    promptsReset: "Default prompts restored — remember to save",
    keyCleared: "Key cleared",
    testing: "Testing…",
    testOk: "✅ Connected",
    test401: "❌ Invalid key: ",
    test404: "❌ Wrong URL or model: ",
    testFail: "❌ ",
    testNet: "❌ Cannot reach that URL — check the address, network or proxy",
    presetFilled: "Preset filled — remember to save",
    noneDisabled: "(no disabled sites)",
    restore: "Restore",
    restoredAll: "All sites restored"
  }
};

const T = STR[UI_LANG];
const t = (key) => T[key] || key;

function applyI18n() {
  document.documentElement.lang = UI_LANG === "zh" ? "zh-CN" : "en";
  document.title = t("pageTitle");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

applyI18n();

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

chrome.storage.local.get(
  ["apiKey", "baseUrl", "model", "systemPrompt", "detailPrompt", "systemPromptZh", "detailPromptZh", "outputLang"],
  (s) => {
    const baseUrl = s.baseUrl || DEFAULT_BASE;
    $("apiKey").value = s.apiKey || "";
    $("baseUrl").value = baseUrl;
    $("model").value = s.model || DEFAULT_MODEL;
    $("systemPrompt").value = s.systemPrompt || DEFAULT_SYSTEM;
    $("detailPrompt").value = s.detailPrompt || DEFAULT_DETAIL;
    $("systemPromptZh").value = s.systemPromptZh || DEFAULT_SYSTEM_ZH;
    $("detailPromptZh").value = s.detailPromptZh || DEFAULT_DETAIL_ZH;
    $("outputLang").value = s.outputLang === "zh" ? "zh" : "auto";
    $("preset").value = matchPreset(baseUrl);
  }
);

$("preset").addEventListener("change", () => {
  const p = PRESETS[$("preset").value];
  if (!p) return;
  $("baseUrl").value = p.baseUrl;
  $("model").value = p.model;
  status(t("presetFilled"));
});

$("save").addEventListener("click", async () => {
  const apiKey = cleanKey($("apiKey").value);
  if (!apiKey) {
    status(t("needKey"));
    return;
  }
  const baseUrl = cleanBase($("baseUrl").value);
  const model = String($("model").value || "").trim() || DEFAULT_MODEL;
  const systemPrompt = String($("systemPrompt").value || "").trim() || DEFAULT_SYSTEM;
  const detailPrompt = String($("detailPrompt").value || "").trim() || DEFAULT_DETAIL;
  const systemPromptZh = String($("systemPromptZh").value || "").trim() || DEFAULT_SYSTEM_ZH;
  const detailPromptZh = String($("detailPromptZh").value || "").trim() || DEFAULT_DETAIL_ZH;
  const outputLang = $("outputLang").value === "zh" ? "zh" : "auto";

  const granted = await ensureHostPermission(baseUrl);
  if (!granted) {
    status(t("noPermission").replace("{origin}", originOf(baseUrl)));
    return;
  }
  chrome.storage.local.set(
    { apiKey, baseUrl, model, systemPrompt, detailPrompt, systemPromptZh, detailPromptZh, outputLang },
    () => {
      $("baseUrl").value = baseUrl;
      $("preset").value = matchPreset(baseUrl);
      status(t("saved"));
    }
  );
});

$("resetPrompts").addEventListener("click", () => {
  $("systemPrompt").value = DEFAULT_SYSTEM;
  $("detailPrompt").value = DEFAULT_DETAIL;
  $("systemPromptZh").value = DEFAULT_SYSTEM_ZH;
  $("detailPromptZh").value = DEFAULT_DETAIL_ZH;
  status(t("promptsReset"));
});

$("clearKey").addEventListener("click", () => {
  chrome.storage.local.remove("apiKey", () => {
    $("apiKey").value = "";
    status(t("keyCleared"));
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
      empty.textContent = t("noneDisabled");
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
      btn.textContent = t("restore");
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
    status(t("restoredAll"));
  });
});

renderDisabled();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "disabledSites" in changes) renderDisabled();
});

$("test").addEventListener("click", async () => {
  const apiKey = cleanKey($("apiKey").value);
  if (!apiKey) {
    status(t("needKey"));
    return;
  }
  const baseUrl = cleanBase($("baseUrl").value);
  const model = String($("model").value || "").trim() || DEFAULT_MODEL;

  const granted = await ensureHostPermission(baseUrl);
  if (!granted) {
    status(t("noPermission").replace("{origin}", originOf(baseUrl)));
    return;
  }
  $("baseUrl").value = baseUrl;
  status(t("testing"));
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
      status(t("testOk"));
      return;
    }
    let msg = "HTTP " + r.status;
    try {
      msg = (await r.json())?.error?.message || msg;
    } catch (e) {}
    const prefix = r.status === 401 ? t("test401") : r.status === 404 ? t("test404") : t("testFail");
    status(prefix + msg);
  } catch (e) {
    const m = String((e && e.message) || e);
    status(/Failed to fetch|NetworkError/i.test(m) ? t("testNet") : t("testFail") + m);
  }
});
