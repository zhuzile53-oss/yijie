# 隐私说明 / Privacy

译解 没有服务器。它不收集、不上传任何数据到项目作者那里 —— 因为根本没有
「作者那里」可以上传。

Yijie has no backend. Nothing is collected, and nothing is sent to the project
author — there is no server to send it to.

## 存在本机的数据

保存在 `chrome.storage.local`（仅本机，不同步到 Google 账号）：

| Key | 内容 |
|---|---|
| `apiKey` | 你的 API Key |
| `baseUrl` | 接口地址 |
| `model` | 模型名 |
| `systemPrompt` / `detailPrompt` | 英文原文的中文提示词 |
| `systemPromptZh` / `detailPromptZh` | 中文原文的英文提示词 |
| `outputLang` | 输出语言偏好 |
| `disabledSites` | 你禁用过的站点域名 |

这些数据不会离开你的设备，除非你自己去看设置页。

## 什么会被发出去

点击「解释」时，浏览器会**直接**向你在设置里填的接口地址发起请求，内容为：

1. 你选中的那段文字
2. 它所在的段落（最多 600 字），用于消解代词和上下文
3. 提示词（system prompt）
4. 你的 API Key —— 作为 `Authorization` 请求头发给**同一个**接口。这是调用大模型必需的，
   它只出现在发往你自己配置的地址的请求里，不发给任何其他人，也不会写进日志。

请求发往哪里，完全由你填的 `baseUrl` 决定（DeepSeek、OpenAI、你自建的中转、
本地 Ollama 等）。该服务商如何处理这些文字，取决于**它自己的隐私政策**，
与本扩展无关。

除此之外没有其他网络请求：没有统计上报、没有崩溃收集、没有版本检查。

## 不收集的东西

- 不读取整页内容，只读取你选中的文字及所在段落
- 不截图、不记录浏览历史
- 不生成设备指纹或设备 ID
- 不要求注册、登录

## 删除

- 设置页「清除 Key」只删 Key
- 卸载扩展会删除全部本地数据
- Chrome 的「清除浏览数据」若勾选扩展数据也会一并清除

## English summary

All settings live in `chrome.storage.local` on your machine. When you click
Explain, your browser sends the selected text, its surrounding paragraph (up to
600 characters), the system prompt and your own API key (as an `Authorization`
header) **directly** to the endpoint you configured — and nowhere else. No
telemetry, no accounts, no device identifiers, no other network requests.
Uninstalling removes everything.
