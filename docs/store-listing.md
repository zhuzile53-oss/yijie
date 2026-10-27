# Chrome Web Store 上架素材包

> 直接从这里复制粘贴到开发者后台。中文版本在后面。
> 截图文件在 `docs/store/`，尺寸均为商店要求的 1280×800。

---

## 1. 商品信息（English — 主语言）

**Name（37 / 45 字符）**

```
Yijie — AI explainer for any web page
```

**Short description（128 / 132 字符）**

```
Select text on any page and get an explanation in your language — translation first, then terms and structure. Your own API key.
```

**Category**：Productivity
**Language**：English (United States)
**Privacy policy URL**：`https://github.com/zhuzile53-oss/yijie/blob/main/PRIVACY.md`

**Detailed description**

```
Yijie is a reading assistant for people who read in a language they are still learning.

Select a sentence or a paragraph on any web page and a side panel opens with an explanation in your language — not just a translation. You get the translation first, then the terms that matter, the structure of the sentence, and what the author is actually saying.

Two directions, detected automatically:
• English text → explanation in Simplified Chinese
• Chinese text → explanation in English

It is built for textbook chapters, papers, documentation and long-form news — the places where one sentence carries four clauses and two pieces of jargon.

HOW IT WORKS
Yijie has no server. It calls an OpenAI-compatible API directly from your browser with a key you provide. Nothing passes through the developer, because there is no back end to pass through: no account, no sign-up, no analytics.

BRING YOUR OWN KEY
Works with DeepSeek, OpenAI, a local Ollama server, or any endpoint that implements /v1/chat/completions. Usage is billed by your own provider, typically a fraction of a cent per explanation.

MAKE IT YOURS
Four prompts are editable — brief and detailed, for each direction. Changes apply immediately, no restart.

ALSO INCLUDED
• Streaming answers, text appears as it is written
• Alt+E explains the selection, Esc closes the panel
• Per-site switch for pages where you don't want it
• Copy, regenerate, brief/detailed toggle
• Dark mode
• Full settings page with prompt editor

WHAT IT DOES NOT DO
• It cannot read chrome:// pages, the Web Store, or PDF viewers
• It does not translate whole pages or documents — only what you select
• It requires its own API key; without one it shows a setup card instead of failing silently

PRIVACY
Your key and settings stay in chrome.storage.local on your device. The selected text and its surrounding paragraph (up to 600 characters) are sent directly to the endpoint you configured, and nowhere else.
```

---

## 2. 权限理由（审核必填，逐条粘贴）

**`storage`**

```
Saves the user's API key, endpoint, model, prompt and per-site settings on their own device. Nothing is synced, uploaded, or shared with the developer.
```

**Content script on all http/https sites**

```
Yijie's single function is to explain text that the user selects while reading, and the user may be reading any site. The script reads window.getSelection() only after a mouse-up and sends nothing unless the user clicks Explain or presses Alt+E. It does not read page content in the background, take screenshots, or record history.
```

**`host_permissions`: api.deepseek.com, api.openai.com**

```
Default endpoints used by the guided setup so that the first explanation works without an extra permission prompt.
```

**`optional_host_permissions`: http://*/*, https://*/***

```
Required so users can point Yijie at their own OpenAI-compatible endpoint — a local Ollama server, a self-hosted gateway, or a regional provider. Permission is requested for the specific origin at the moment the user saves that address, never in advance and never for all sites at once.
```

---

## 3. 隐私权与数据披露表单

**Single purpose**

```
Explain text that the user selects on a web page, in the user's own language, using an AI endpoint that the user configures and pays for.
```

**Data usage — 勾选项**

| 类别 | 选 |
|---|---|
| Website content（选中的文字和所在段落会发给用户自己配置的接口） | **是** |
| Personally identifiable information | 否 |
| Health information | 否 |
| Financial and payment information | 否 |
| Authentication information | 否（Key 只发给用户自己填的那个接口，不经过开发者） |
| Personal communications | 否 |
| Location | 否 |
| Web history | 否 |
| User activity | 否 |

**Certifications** — 三项全部勾选：

- 不出售或转让给第三方（除已披露的必要用途）
- 不用于与单一用途无关的目的
- 不用于判定信用等级或放贷

**Remote code**：No（不加载任何远程脚本）

---

## 4. 截图清单（`docs/store/`）

| 文件 | 内容 | 建议顺序 |
|---|---|---|
| `shot-1.png` | 英文文章 → 中文讲解（简明） | 1（商店首图） |
| `shot-2.png` | 中文文章 → 英文讲解 | 2 |
| `shot-3.png` | 学术论文 → 中文详解 | 3 |
| `shot-4.png` | 设置页（英文界面，BYOK 展示） | 4 |
| `tile-440x280.png` | 小型宣传图（可选） | — |

> 设置页已经做了 i18n：界面语言跟随**浏览器语言**（中文浏览器显示中文，其他显示英文）。
> `shot-4.png` 是在 `--lang=en-US` 下截的，对应英文用户看到的界面。

---

## 5. 提交前检查清单

- [ ] 注册开发者账号并支付 5 美元（一次性）
- [ ] 账号开启两步验证
- [ ] `./scripts/build.sh` 生成 zip，确认 `manifest.json` 在压缩包根目录
- [ ] 上传 zip，后台应读到 `Yijie 译解` / `0.2.0`
- [ ] 填写标题、简短描述、详细描述
- [ ] 上传 3 张截图 + 128×128 图标（用 `icons/icon128.png`）
- [ ] 填权限理由（第 2 节）
- [ ] 填隐私披露（第 3 节）+ 隐私政策链接
- [ ] 提交审核（通常 1–3 个工作日）

---

# 中文版本（语言列表里再加 Chinese (Simplified)）

**名称**

```
Yijie 译解 — 任意网页划词讲解
```

**简短描述**

```
选中网页上的文字，右侧给出中文或英文讲解：先译文，再讲术语和句子结构。自带 API Key，无后端。
```

**详细描述**

```
译解 是一个给「跨语言阅读」用的浏览器扩展。

在任意网页上选中一句话或一段话，右侧会弹出讲解——不只是翻译。先给你译文，再讲里面的术语、句子主干，以及作者到底在说什么。

两个方向自动判断：
· 选中英文 → 中文讲解
· 选中中文 → 英文讲解

为教材、论文、技术文档和长报道而做——那些一句话里有四个从句和两个专业词的场合。

工作原理
译解 没有服务器。它用你自己填的 Key，从浏览器直接调用 OpenAI 兼容接口。请求不经过开发者，因为根本没有后端：没有账号、不用注册、没有统计。

自带 Key
支持 DeepSeek、OpenAI、本地 Ollama，以及任何实现了 /v1/chat/completions 的接口。费用由你自己的服务商账户结算，每次通常不到一分钱。

可以改
四段提示词都可以编辑（简明 / 详解 × 两个方向），保存即生效，不用重启。

还包括
· 流式输出，模型写一个字显示一个字
· Alt+E 解释选区，Esc 关闭面板
· 站点开关，不想用的网站可以单独关掉
· 复制、重新生成、简明/详解切换
· 深色模式
· 完整设置页与提示词编辑器

做不到的
· 无法读取 chrome:// 页面、应用商店、PDF 阅读器
· 不翻译整页或整份文档，只处理你选中的内容
· 必须自备 API Key，没填时会显示引导卡片而不是默默失败

隐私
Key 和设置只保存在本机的 chrome.storage.local。选中的文字和所在段落（最多 600 字）直接发往你自己配置的接口，不发给任何其他人。
```
