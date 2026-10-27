(() => {
  if (window.__yijieLoaded) return;
  window.__yijieLoaded = true;

  const SYSTEM = `你是一位中文母语的英文阅读助手。用户划出了网页上的一段英文，请用简体中文解释。
严格遵守：
1. 第一句直接说明这段在讲什么，不要复述原文，不要开场白。
2. 先给一句贴切的译文（以「译文：」开头），让用户立刻知道意思。
3. 出现专业术语时写成「英文术语 = 中文译名」，再用一句大白话解释。
4. 若是长难句，先一句话说大意，再拆出主干（谁 + 做什么 + 结果）。
5. 只在有助于理解时给一个不超过两行的例子。
6. 全文控制在 250 字以内，可用短列表，不要写总结段。`;

  const SYSTEM_FULL = `你是一位中文母语的英文阅读助手。用户划出了网页上的一段英文，请用简体中文详细讲解。
严格遵守：
1. 先用一句话说明这段在讲什么，不要复述原文。
2. 给出完整译文，保留原文的分句结构，便于对照。
3. 逐个讲解其中的专业术语：「英文术语 = 中文译名」，再解释含义与作用。
4. 若句子结构复杂，拆出主干并说明修饰成分；点出容易误解的地方。
5. 给一个不超过三行的实际例子（商业、科技或生活皆可）。
6. 最后一句说明这段的言外之意或作者意图。
7. 全文控制在 600 字以内，可用小标题和短列表，不要开场白。`;

  let btn = null, panel = null, port = null, currentText = "", currentCtx = "", buffer = "", detailed = false;

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
          <button class="yj-close" title="关闭">×</button>
        </span>
      </div>
      <div class="yj-body"><div class="yj-answer"></div></div>
      <div class="yj-foot"><span class="yj-status">就绪</span></div>`;
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
    document.documentElement.appendChild(panel);
    return panel;
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
    const watchdog = setTimeout(() => {
      if (buffer === "") {
        answer.innerHTML = '<span class="yj-err">⚠️ 20 秒没有返回。打开 chrome://extensions → 该扩展 → 服务工作进程，看红色报错。</span>';
        status.textContent = "超时";
      }
    }, 20000);
    port.onMessage.addListener((msg) => {
      if (msg.type === "delta") {
        buffer += msg.text;
        renderAnswer(answer, buffer);
        p.querySelector(".yj-body").scrollTop = p.querySelector(".yj-body").scrollHeight;
        status.textContent = "生成中… " + buffer.length + " 字";
      } else if (msg.type === "done") {
        clearTimeout(watchdog);
        status.textContent = "完成 · " + buffer.length + " 字";
      } else if (msg.type === "error") {
        answer.innerHTML = '<span class="yj-err">⚠️ ' + esc(msg.text) + "</span>";
        status.textContent = "出错";
      }
    });
    const userMsg = context && context.length > text.length
      ? '选中的片段：\n"""\n' + text + '\n"""\n\n它所在的段落（供理解上下文，不必逐句解释）：\n"""\n' + context + '\n"""\n\n请重点解释选中的片段。'
      : '网页原文：\n"""\n' + text + '\n"""\n请解释。';
    currentCtx = context || "";
    port.postMessage({ type: "explain", system: detailed ? SYSTEM_FULL : SYSTEM, user: userMsg, max_tokens: detailed ? 1800 : 700 });
  }

  document.addEventListener("mouseup", (e) => {
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
    if (e.altKey && (e.key === "e" || e.key === "E")) {
      const sel = window.getSelection();
      const t = String(sel || "").trim();
      if (t.length >= 3) { e.preventDefault(); explain(t, contextOf(sel)); removeButton(); }
    }
  });
})();
