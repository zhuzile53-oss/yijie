(() => {
  if (window.__yijieLoaded) return;
  window.__yijieLoaded = true;

  const D = globalThis.YJ_DEFAULTS || {};
  let systemPrompt = String(D.systemPrompt || "").trim() || "请用简体中文解释这段英文。";
  let detailPrompt = String(D.detailPrompt || "").trim() || "请用简体中文详细讲解这段英文。";

  let btn = null, panel = null, port = null, currentText = "", currentCtx = "", buffer = "", detailed = false;

  // 站点开关：按 hostname 记，来自面板的「本站禁用」或设置页的恢复
  const HOST = location.hostname || "";
  let disabledSites = [];
  let siteDisabled = false;

  function applySites(list) {
    disabledSites = Array.isArray(list) ? list : [];
    siteDisabled = !!HOST && disabledSites.indexOf(HOST) >= 0;
    if (siteDisabled) {
      removeButton();
      if (port) { try { port.disconnect(); } catch (e) {} port = null; }
      if (panel) panel.style.display = "none";
    }
  }

  function disableSite() {
    if (!HOST) return;
    if (disabledSites.indexOf(HOST) < 0) disabledSites.push(HOST);
    chrome.storage.local.set({ disabledSites });
    applySites(disabledSites);
    if (panel) {
      panel.querySelector(".yj-status").textContent = "已禁用本站：" + HOST;
      setTimeout(() => { if (panel) panel.style.display = "none"; }, 1500);
    }
  }

  chrome.storage.local.get(["disabledSites"], (s) => applySites(s.disabledSites));

  // 设置页改完提示词，已打开的页面无需刷新即可生效
  function loadPrompts() {
    chrome.storage.local.get(["systemPrompt", "detailPrompt"], (s) => {
      const a = String(s.systemPrompt || "").trim();
      const b = String(s.detailPrompt || "").trim();
      if (a) systemPrompt = a;
      if (b) detailPrompt = b;
    });
  }
  loadPrompts();
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if ("systemPrompt" in changes || "detailPrompt" in changes) loadPrompts();
      if ("disabledSites" in changes) applySites(changes.disabledSites.newValue);
    });
  } catch (e) {}

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function renderAnswer(el, text) {
    const clean = String(text).replace(/^#{1,6}\s*/gm, "");
    el.textContent = "";
    const parts = clean.split(/(\*\*[^*\n]+\*\*)/g);
    for (const p of parts) {
      if (!p) continue;
      if (p.length > 4 && p.startsWith("**") && p.endsWith("**")) {
        const b = document.createElement("b");
        b.textContent = p.slice(2, -2);
        el.appendChild(b);
      } else {
        el.appendChild(document.createTextNode(p));
      }
    }
  }

  function removeButton() {
    if (btn) { btn.remove(); btn = null; }
  }

  function selectionRect() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    return r && r.width ? r : null;
  }

  function contextOf(sel) {
    try {
      let n = sel.anchorNode;
      while (n && n.nodeType !== 1) n = n.parentNode;
      const block = n && n.closest ? (n.closest("p,li,td,div") || n) : n;
      const t = (block ? block.innerText : "") || "";
      return "";
    } catch (e) { return ""; }
  }

  function showButton(x, y) {
    removeButton();
    const r = selectionRect();
    btn = document.createElement("button");
    btn.className = "yj-fab";
    btn.textContent = "解释";
    btn.style.position = "fixed";
    btn.style.left = "16px";
    btn.style.right = "auto";
    btn.style.top = "50%";
    btn.style.transform = "translateY(-50%)";
    btn.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
    btn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const sel = window.getSelection();
      const txt = String(sel || "").trim();
      if (txt) explain(txt, contextOf(sel));
      removeButton();
    });
    document.documentElement.appendChild(btn);
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.className = "yj-panel";
    panel.innerHTML = `
      <div class="yj-head">
        <span class="yj-title">译解</span>
        <span class="yj-actions">
          <button class="yj-mode" title="切换简明/详解">详解</button>
          <button class="yj-copy" title="复制解释">复制</button>
          <button class="yj-settings" title="设置">⚙</button>
          <button class="yj-close" title="关闭">×</button>
        </span>
      </div>
      <div class="yj-body"><div class="yj-answer"></div></div>
      <div class="yj-foot"><span class="yj-status">就绪</span><button class="yj-disable" title="在本站不再弹出，可在设置页恢复">本站禁用</button></div>`;
    panel.querySelector(".yj-close").addEventListener("click", () => {
      if (port) { try { port.disconnect(); } catch (e) {} port = null; }
      panel.style.display = "none";
    });
    panel.querySelector(".yj-mode").addEventListener("click", () => {
      detailed = !detailed;
      const b = panel.querySelector(".yj-mode");
      b.textContent = detailed ? "简明" : "详解";
      b.style.color = detailed ? "#1f3864" : "#888";
      if (currentText) explain(currentText, currentCtx);
    });
    panel.querySelector(".yj-copy").addEventListener("click", () => {
      navigator.clipboard.writeText(buffer).catch(() => {});
      panel.querySelector(".yj-status").textContent = "已复制";
    });
    panel.querySelector(".yj-settings").addEventListener("click", () => {
      try { chrome.runtime.sendMessage({ type: "open_options" }); } catch (e) {}
    });
    panel.querySelector(".yj-disable").addEventListener("click", disableSite);
    document.documentElement.appendChild(panel);
    return panel;
  }

  // 没填 Key 时不要甩一行红字，告诉用户下一步做什么
  function renderGuide(answer, status) {
    buffer = "";
    answer.textContent = "";
    const box = document.createElement("div");
    box.className = "yj-guide";

    const title = document.createElement("p");
    title.className = "yj-guide-title";
    title.textContent = "还没有配置 API Key";

    const p1 = document.createElement("p");
    p1.textContent = "译解 用你自己的 Key 调用模型，请求从浏览器直接发往你填的接口，不经过任何第三方服务器。";

    const p2 = document.createElement("p");
    p2.textContent = "推荐 DeepSeek（platform.deepseek.com 申请，几块钱能用很久）；也支持 OpenAI 和本地 Ollama。";

    const row = document.createElement("div");
    row.className = "yj-guide-row";

    const open = document.createElement("button");
    open.textContent = "打开设置";
    open.addEventListener("click", () => {
      try { chrome.runtime.sendMessage({ type: "open_options" }); } catch (e) {}
    });

    const retry = document.createElement("button");
    retry.textContent = "重试";
    retry.className = "yj-ghost";
    retry.addEventListener("click", () => { if (currentText) explain(currentText, currentCtx); });

    row.appendChild(open);
    row.appendChild(retry);
    box.appendChild(title);
    box.appendChild(p1);
    box.appendChild(p2);
    box.appendChild(row);
    answer.appendChild(box);
    status.textContent = "未配置";
  }

  function explain(text, context) {
    const p = ensurePanel();
    p.style.display = "flex";
    currentText = text;
    buffer = "";
    const answer = p.querySelector(".yj-answer");
    const status = p.querySelector(".yj-status");
    answer.innerHTML = '<span class="yj-dim">生成中…</span>';
    status.textContent = "生成中…";

    if (port) { try { port.disconnect(); } catch (e) {} }
    port = chrome.runtime.connect({ name: "explain" });
    port.onDisconnect.addListener(() => {
      const st = p.querySelector(".yj-status");
      if (st && st.textContent.startsWith("生成中")) st.textContent = "连接断开，请刷新页面";
    });
    // 等首字。超过这个时间还没内容就先提示，但请求不会被中断，后续内容到了照常显示
    const watchdog = setTimeout(() => {
      if (buffer === "") {
        answer.innerHTML = '<span class="yj-err">⚠️ 10 秒没有返回。打开 chrome://extensions → 该扩展 → 服务工作进程，看红色报错。</span>';
        status.textContent = "超时";
      }
    }, 10000);
    port.onMessage.addListener((msg) => {
      if (msg.type === "delta") {
        buffer += msg.text;
        renderAnswer(answer, buffer);
        p.querySelector(".yj-body").scrollTop = p.querySelector(".yj-body").scrollHeight;
        status.textContent = "生成中… " + buffer.length + " 字";
      } else if (msg.type === "done") {
        clearTimeout(watchdog);
        status.textContent = "完成 · " + buffer.length + " 字";
      } else if (msg.type === "need_key") {
        clearTimeout(watchdog);
        renderGuide(answer, status);
      } else if (msg.type === "error") {
        clearTimeout(watchdog);
        answer.innerHTML = '<span class="yj-err">⚠️ ' + esc(msg.text) + "</span>";
        status.textContent = "出错";
      }
    });
    const userMsg = context && context.length > text.length
      ? '选中的片段：\n"""\n' + text + '\n"""\n\n它所在的段落（供理解上下文，不必逐句解释）：\n"""\n' + context + '\n"""\n\n请重点解释选中的片段。'
      : '网页原文：\n"""\n' + text + '\n"""\n请解释。';
    currentCtx = context || "";
    port.postMessage({
      type: "explain",
      system: detailed ? detailPrompt : systemPrompt,
      user: userMsg,
      max_tokens: detailed ? 1800 : 700
    });
  }

  document.addEventListener("mouseup", (e) => {
    if (siteDisabled) return;
    if (panel && panel.contains(e.target)) return;
    setTimeout(() => {
      const sel = String(window.getSelection() || "").trim();
      if (sel.length >= 3) showButton(e.clientX, e.clientY);
      else removeButton();
    }, 10);
  });

  document.addEventListener("mousedown", (e) => {
    if (btn && e.target !== btn) removeButton();
  });

  document.addEventListener("keydown", (e) => {
    if (siteDisabled) return;
    if (e.altKey && (e.key === "e" || e.key === "E")) {
      const sel = window.getSelection();
      const t = String(sel || "").trim();
      if (t.length >= 3) { e.preventDefault(); explain(t, contextOf(sel)); removeButton(); }
    }
  });
})();
