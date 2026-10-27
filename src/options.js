const $ = (id) => document.getElementById(id);

const D = globalThis.YJ_DEFAULTS || {};
const DEFAULT_BASE = D.baseUrl || "https://api.deepseek.com/v1";
const DEFAULT_MODEL = D.model || "deepseek-chat";
const DEFAULT_SYSTEM = D.systemPrompt || "";
const DEFAULT_DETAIL = D.detailPrompt || "";

// Key 区分大小写：只去不可见字符和首尾空白，绝不做大小写转换
function cleanKey(s) {
  return String(s || "").replace(/[\u200b-\u200f\ufeff]/g, "").trim();
}

function cleanBase(s) {
  return String(s || "").trim().replace(/\/+$/, "") || DEFAULT_BASE;
}

function endpoint(baseUrl) {
  return /\/chat\/completions\/?$/.test(baseUrl) ? baseUrl : baseUrl + "/chat/completions";
}

chrome.storage.local.get(["apiKey", "baseUrl", "model", "systemPrompt", "detailPrompt"], (s) => {
  $("apiKey").value = s.apiKey || "";
  $("baseUrl").value = s.baseUrl || DEFAULT_BASE;
  $("model").value = s.model || DEFAULT_MODEL;
  $("systemPrompt").value = s.systemPrompt || DEFAULT_SYSTEM;
  $("detailPrompt").value = s.detailPrompt || DEFAULT_DETAIL;
});

$("save").addEventListener("click", () => {
  const apiKey = cleanKey($("apiKey").value);
  if (!apiKey) {
    $("status").textContent = "请先填写 API Key";
    return;
  }
  const baseUrl = cleanBase($("baseUrl").value);
  const model = String($("model").value || "").trim() || DEFAULT_MODEL;
  const systemPrompt = String($("systemPrompt").value || "").trim() || DEFAULT_SYSTEM;
  const detailPrompt = String($("detailPrompt").value || "").trim() || DEFAULT_DETAIL;
  chrome.storage.local.set({ apiKey, baseUrl, model, systemPrompt, detailPrompt }, () => {
    $("status").textContent = "✅ 已保存";
  });
});

$("resetPrompts").addEventListener("click", () => {
  $("systemPrompt").value = DEFAULT_SYSTEM;
  $("detailPrompt").value = DEFAULT_DETAIL;
  $("status").textContent = "已恢复默认提示词，记得点保存";
});

$("clearKey").addEventListener("click", () => {
  chrome.storage.local.remove("apiKey", () => {
    $("apiKey").value = "";
    $("status").textContent = "已清除 Key";
  });
});

$("test").addEventListener("click", async () => {
  const apiKey = cleanKey($("apiKey").value);
  if (!apiKey) {
    $("status").textContent = "请先填写 API Key";
    return;
  }
  const baseUrl = cleanBase($("baseUrl").value);
  const model = String($("model").value || "").trim() || DEFAULT_MODEL;
  $("status").textContent = "测试中…";
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
      $("status").textContent = "✅ 连接成功";
      return;
    }
    let msg = "HTTP " + r.status;
    try {
      msg = (await r.json())?.error?.message || msg;
    } catch (e) {}
    $("status").textContent = "❌ " + msg;
  } catch (e) {
    $("status").textContent = "❌ " + (e.message || e);
  }
});
