// 译解 · 后台服务
// 只做两件事：读取用户配置、把 OpenAI 兼容接口的流式响应转发给页面。
// 没有中转服务、没有账号、没有设备标识、没有遥测。

const DEFAULT_BASE = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-chat";
// 超过这么久没有任何新内容，就认为流断了，主动收尾而不是永远转圈
const STALL_MS = 45000;

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

// 把 HTTP 状态码翻成用户能行动的话，别只甩一个数字
function httpErrorText(status, detail) {
  const tail = detail ? "（" + detail + "）" : "";
  if (status === 401) return "API Key 无效或已失效（401），去设置页重新填" + tail;
  if (status === 403) return "这个 Key 没有访问该模型或接口的权限（403）" + tail;
  if (status === 404) return "接口地址或模型名不对（404），检查设置页的地址和模型" + tail;
  if (status === 429) return "请求太频繁或额度已用完（429），稍等再试" + tail;
  if (status >= 500) return "模型服务端出错（" + status + "），稍后重试" + tail;
  return "请求失败 HTTP " + status + tail;
}

function netErrorText(e) {
  const m = String((e && e.message) || e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) {
    return "连不上这个接口：检查地址是否写对、网络是否通（必要时开代理），或该域名还没授权给本扩展。";
  }
  return "网络错误：" + m;
}

async function readErrorBody(res) {
  try {
    const txt = await res.text();
    try {
      const j = JSON.parse(txt);
      return (j && j.error && j.error.message) || (j && j.message) || txt.slice(0, 200);
    } catch (e) {
      return txt.slice(0, 200);
    }
  } catch (e) {
    return "";
  }
}

// 逐行解析 SSE。跨 chunk 的半行由 buf 兜住；[DONE] 与流内的 error 都会提前收尾。
function createSseReader(onDelta) {
  let buf = "";
  let stopped = false;
  let errorText = null;

  function consumeLine(raw) {
    const t = raw.trim();
    if (!t || t.startsWith(":")) return; // 空行 / 心跳注释
    if (!t.startsWith("data:")) return; // event: / id: 之类的非内容行
    const payload = t.slice(5).trim();
    if (!payload) return;
    if (payload === "[DONE]") {
      stopped = true;
      return;
    }
    let j;
    try {
      j = JSON.parse(payload);
    } catch (e) {
      return;
    }
    if (j && j.error) {
      stopped = true;
      errorText = j.error.message || "接口返回错误";
      return;
    }
    const c = j && j.choices && j.choices[0];
    // delta 是标准流式格式；text / message.content 兼容那些整包返回的兼容服务
    const piece = (c && c.delta && c.delta.content) || (c && c.text) || (c && c.message && c.message.content);
    if (piece) onDelta(piece);
  }

  return {
    feed(chunk, isFinal) {
      buf += chunk;
      const lines = buf.split("\n");
      buf = isFinal ? "" : lines.pop();
      for (const raw of lines) {
        consumeLine(raw);
        if (stopped) return;
      }
    },
    get stopped() {
      return stopped;
    },
    get error() {
      return errorText;
    }
  };
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
  let stalled = false;
  let idleTimer = null;

  function stopIdle() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }
  function bumpIdle() {
    stopIdle();
    idleTimer = setTimeout(() => {
      stalled = true;
      if (aborter) aborter.abort();
    }, STALL_MS);
  }

  // 用户关掉面板 = 不再需要这次回答，立即中止请求，别继续烧 token
  port.onDisconnect.addListener(() => {
    stopIdle();
    if (aborter) aborter.abort();
  });

  port.onMessage.addListener(async (msg) => {
    if (msg.type !== "explain") return;
    if (aborter) aborter.abort();
    stopIdle();
    aborter = new AbortController();
    stalled = false;

    const { apiKey, baseUrl, model } = await getConfig();
    if (!apiKey) {
      // 页面收到后会渲染引导卡片，而不是甩一行红字
      safePost(port, { type: "need_key" });
      return;
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      safePost(port, { type: "error", text: "接口地址必须以 http:// 或 https:// 开头，去设置页改一下。" });
      return;
    }

    const post = (body) =>
      fetch(endpoint(baseUrl), {
        method: "POST",
        signal: aborter.signal,
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + apiKey
        },
        body: JSON.stringify(body)
      });

    try {
      const payload = {
        model,
        stream: true,
        max_tokens: msg.max_tokens || 800,
        messages: [
          { role: "system", content: msg.system },
          { role: "user", content: msg.user }
        ]
      };

      bumpIdle();
      let res = await post(payload);

      // 新一些的模型（o1/gpt-5 系列）只认 max_completion_tokens，被拒时自动换一次
      if (res.status === 400) {
        const detail = await readErrorBody(res);
        if (/max_tokens/i.test(detail)) {
          const retry = { ...payload, max_completion_tokens: payload.max_tokens };
          delete retry.max_tokens;
          res = await post(retry);
        } else {
          safePost(port, { type: "error", text: httpErrorText(400, detail) });
          return;
        }
      }
      if (!res.ok) {
        safePost(port, { type: "error", text: httpErrorText(res.status, await readErrorBody(res)) });
        return;
      }

      // 不看 content-type，一律按流解析。
      // 很多「OpenAI 兼容」服务把流标成 text/plain 甚至不标，按 header 判断会把它
      // 当成整包 JSON 用 res.text() 等到底，结果就是"不逐字"+"长时间出不来"。
      if (!res.body) {
        safePost(port, { type: "error", text: "接口没有返回内容，检查模型名是否正确。" });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      let deltas = 0;
      const sse = createSseReader((p) => {
        deltas++;
        safePost(port, { type: "delta", text: p });
        bumpIdle();
      });

      while (!sse.stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (raw.length < 200000) raw += text;
        sse.feed(text, false);
      }
      if (!sse.stopped) {
        const tail = decoder.decode();
        if (raw.length < 200000) raw += tail;
        sse.feed(tail, true);
      }
      stopIdle();

      if (sse.stopped) {
        try {
          await reader.cancel();
        } catch (e) {}
      }
      if (sse.error) {
        safePost(port, { type: "error", text: sse.error });
        return;
      }

      // 整条流里一个 data: 行都没有，说明对方无视了 stream:true，回的是整包 JSON
      if (deltas === 0) {
        let filled = false;
        try {
          const j = JSON.parse(raw);
          if (j && j.error) {
            safePost(port, { type: "error", text: j.error.message || "接口返回错误" });
            return;
          }
          const c = j && j.choices && j.choices[0];
          const full = (c && c.message && c.message.content) || (c && c.text);
          if (full) {
            safePost(port, { type: "delta", text: full });
            filled = true;
          }
        } catch (e) {}
        if (!filled) {
          const ct = String(res.headers.get("content-type") || "无");
          safePost(port, {
            type: "error",
            text: "接口没有返回可用内容（content-type: " + ct + "）。检查模型名，或确认该地址是 OpenAI 兼容的 /v1/chat/completions。"
          });
          return;
        }
      }
      safePost(port, { type: "done" });
    } catch (e) {
      stopIdle();
      if (e && e.name === "AbortError") {
        if (stalled) {
          safePost(port, { type: "error", text: "生成中断：45 秒没有收到新内容，可能是网络或服务端卡住。" });
        }
        return;
      }
      safePost(port, { type: "error", text: netErrorText(e) });
    } finally {
      stopIdle();
    }
  });
});
