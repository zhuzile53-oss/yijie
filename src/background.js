// 译解 · 后台服务
// 只做两件事：读取用户配置、把 OpenAI 兼容接口的流式响应转发给页面。
// 没有中转服务、没有账号、没有设备标识、没有遥测。

const DEFAULT_BASE = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-chat";

async function getConfig() {
  const s = await chrome.storage.local.get(["apiKey", "baseUrl", "model"]);
  return {
    apiKey: String(s.apiKey || "").trim(),
    baseUrl: String(s.baseUrl || DEFAULT_BASE).trim().replace(/\/+$/, ""),
    model: String(s.model || DEFAULT_MODEL).trim()
  };
}

// 用户可能填 https://api.deepseek.com/v1，也可能直接粘完整的 .../chat/completions
function endpoint(baseUrl) {
  return /\/chat\/completions\/?$/.test(baseUrl) ? baseUrl : baseUrl + "/chat/completions";
}

// 面板关闭后 port 已断开，postMessage 会抛错，不能让它污染真实错误
function safePost(port, msg) {
  try {
    port.postMessage(msg);
  } catch (e) {}
}

// 面板里的「打开设置」按钮，以及点工具栏图标，都进设置页
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "open_options") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }
  return false;
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "explain") return;

  let aborter = null;
  // 用户关掉面板 = 不再需要这次回答，立即中止请求，别继续烧 token
  port.onDisconnect.addListener(() => {
    if (aborter) aborter.abort();
  });

  port.onMessage.addListener(async (msg) => {
    if (msg.type !== "explain") return;
    if (aborter) aborter.abort();
    aborter = new AbortController();

    const { apiKey, baseUrl, model } = await getConfig();
    if (!apiKey) {
      // 页面收到后会渲染引导卡片，而不是甩一行红字
      safePost(port, { type: "need_key" });
      return;
    }

    try {
      const res = await fetch(endpoint(baseUrl), {
        method: "POST",
        signal: aborter.signal,
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + apiKey
        },
        body: JSON.stringify({
          model,
          stream: true,
          max_tokens: msg.max_tokens || 800,
          messages: [
            { role: "system", content: msg.system },
            { role: "user", content: msg.user }
          ]
        })
      });
      if (!res.ok) {
        let detail = "";
        try {
          detail = (await res.json())?.error?.message || "";
        } catch (e) {}
        safePost(port, { type: "error", text: detail || ("请求失败 HTTP " + res.status) });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            const piece = j?.choices?.[0]?.delta?.content;
            if (piece) safePost(port, { type: "delta", text: piece });
          } catch (e) {}
        }
      }
      safePost(port, { type: "done" });
    } catch (e) {
      if (e && e.name === "AbortError") return;
      safePost(port, { type: "error", text: "网络错误：" + (e.message || e) });
    }
  });
});
