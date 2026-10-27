// 后台流式解析的单元测试：用假 fetch / 假 port 跑，不需要浏览器和真实 API Key。
// 运行：node test/background.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BACKGROUND = fs.readFileSync(path.join(ROOT, 'src', 'background.js'), 'utf8');

const enc = new TextEncoder();
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

function loader(store, fetchImpl) {
  const L = {};
  const ctx = {
    console, URL, TextDecoder, AbortController, setTimeout, clearTimeout, TextEncoder,
    fetch: fetchImpl,
    chrome: {
      storage: { local: { get: async () => ({ ...store }) } },
      runtime: { onConnect: { addListener: (f) => (L.connect = f) }, onMessage: { addListener() {} }, openOptionsPage() {} },
      action: { onClicked: { addListener() {} } },
    },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(BACKGROUND, ctx);
  return L.connect;
}
const makePort = () => { const p = { name: 'explain', msgs: [], postMessage(m) { p.msgs.push(m); }, onMessage: { addListener(f) { p._h = f; } }, onDisconnect: { addListener() {} } }; return p; };
const readerFrom = (chunks, log = []) => { let i = 0; return { async read() { return i < chunks.length ? { value: enc.encode(chunks[i++]), done: false } : { done: true }; }, async cancel() { log.push('cancel'); } }; };
const sseRes = (chunks, log = [], ct = 'text/event-stream') => ({ ok: true, status: 200, headers: { get: () => ct }, body: { getReader: () => readerFrom(chunks, log) } });
const jsonRes = (o, ct = 'application/json') => ({ ok: true, status: 200, headers: { get: () => ct }, body: { getReader: () => readerFrom([JSON.stringify(o)]) } });
const errRes = (status, o) => ({ ok: false, status, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(o) });

const R = [];
const check = (n, c, x = '') => R.push((c ? '  ok  ' : '  FAIL ') + n + (c ? '' : '  ' + x));
const deltas = (p) => p.msgs.filter((m) => m.type === 'delta').map((m) => m.text).join('');

// A. SSE 半行 + [DONE]
{
  const log = [];
  const connect = loader({ apiKey: 'k', baseUrl: 'https://api.deepseek.com/v1', model: 'm' }, async () =>
    sseRes(['data: {"choices":[{"delta":{"content":"你"}}]}\n\ndata: {"choices":[{"delta":{"content":"好"}}]}\n\nda', 'ta: [DONE]\n\ndata: {"choices":[{"delta":{"content":"X"}}]}\n\n'], log));
  const p = makePort(); connect(p); p._h({ type: 'explain', system: 's', user: 'u' });
  await tick();
  check('SSE 半行拼接', deltas(p) === '你好', deltas(p));
  check('[DONE] 后不再输出', !deltas(p).includes('X'));
  check('[DONE] 触发 cancel', log.includes('cancel'));
  check('SSE 后发 done', p.msgs.at(-1)?.type === 'done');
}

// B. 无视 stream:true 的整包 JSON
{
  const connect = loader({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, async () => jsonRes({ choices: [{ message: { content: '整包' } }] }));
  const p = makePort(); connect(p); p._h({ type: 'explain', system: 's', user: 'u' });
  await tick();
  check('整包 JSON 也能出字', deltas(p) === '整包', deltas(p));
  check('整包 JSON 后发 done', p.msgs.at(-1)?.type === 'done');
}

// C. 400 max_tokens 重试
{
  const calls = [];
  const connect = loader({ apiKey: 'k', baseUrl: 'https://api.openai.com/v1', model: 'o1' }, async (u, o) => {
    calls.push(JSON.parse(o.body));
    return calls.length === 1 ? errRes(400, { error: { message: 'Unsupported parameter: max_tokens' } })
      : sseRes(['data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n']);
  });
  const p = makePort(); connect(p); p._h({ type: 'explain', system: 's', user: 'u', max_tokens: 300 });
  await tick();
  check('max_tokens 被拒后重试', calls.length === 2);
  check('改用 max_completion_tokens', calls[1]?.max_completion_tokens === 300 && !('max_tokens' in calls[1]));
  check('重试成功后出字', deltas(p) === 'ok');
}

// D. 401
{
  const connect = loader({ apiKey: 'bad', baseUrl: 'https://api.deepseek.com/v1', model: 'm' }, async () => errRes(401, { error: { message: 'invalid api key' } }));
  const p = makePort(); connect(p); p._h({ type: 'explain', system: 's', user: 'u' });
  await tick();
  const e = p.msgs.find((m) => m.type === 'error');
  check('401 提示', !!e && /401/.test(e.text) && /重新填/.test(e.text), JSON.stringify(e));
}

// E. 流内 error
{
  const connect = loader({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, async () => sseRes(['data: {"error":{"message":"quota exceeded"}}\n\n']));
  const p = makePort(); connect(p); p._h({ type: 'explain', system: 's', user: 'u' });
  await tick();
  check('流内 error 上报', /quota exceeded/.test(p.msgs.find((m) => m.type === 'error')?.text || ''));
}

// F. 没 Key
{
  const connect = loader({}, async () => { throw new Error('no'); });
  const p = makePort(); connect(p); p._h({ type: 'explain', system: 's', user: 'u' });
  await tick();
  check('没 Key 只发 need_key', p.msgs.length === 1 && p.msgs[0].type === 'need_key');
}

// G. 回归：content-type 标成 text/plain 也必须逐块出，不能等整条流
{
  const q = []; let wake = null;
  const reader = {
    read() {
      if (q.length) return Promise.resolve({ value: enc.encode(q.shift()), done: false });
      return new Promise((res) => { wake = res; });
    },
    cancel() { return Promise.resolve(); },
  };
  const push = (s) => { if (wake) { const r = wake; wake = null; r({ value: enc.encode(s), done: false }); } else q.push(s); };
  const connect = loader({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, async () => ({
    ok: true, status: 200, headers: { get: () => 'text/plain; charset=utf-8' }, body: { getReader: () => reader },
  }));
  const p = makePort(); connect(p); p._h({ type: 'explain', system: 's', user: 'u' });
  await tick(10);
  push('data: {"choices":[{"delta":{"content":"逐"}}]}\n\n');
  await tick(20);
  check('text/plain 也逐块出（未等流结束）', deltas(p) === '逐', JSON.stringify(deltas(p)));
  push('data: {"choices":[{"delta":{"content":"字"}}]}\n\ndata: [DONE]\n\n');
  await tick(20);
  check('后续块继续出', deltas(p) === '逐字', deltas(p));
  check('流结束后发 done', p.msgs.at(-1)?.type === 'done');
}

// H. content-type 标成 event-stream 但实际是整包 JSON
{
  const connect = loader({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, async () => ({
    ok: true, status: 200, headers: { get: () => 'text/event-stream' },
    body: { getReader: () => readerFrom([JSON.stringify({ choices: [{ message: { content: '反着标' } }] })]) },
  }));
  const p = makePort(); connect(p); p._h({ type: 'explain', system: 's', user: 'u' });
  await tick();
  check('标错 header 的整包 JSON 仍能出字', deltas(p) === '反着标', deltas(p));
}

// I. 完全空响应
{
  const connect = loader({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, async () => sseRes(['']));
  const p = makePort(); connect(p); p._h({ type: 'explain', system: 's', user: 'u' });
  await tick();
  const e = p.msgs.find((m) => m.type === 'error');
  check('空响应给出可诊断错误', !!e && /content-type/.test(e.text), JSON.stringify(e));
}

console.log(R.join('\n'));
const bad = R.filter((x) => x.includes('FAIL')).length;
console.log(`\n${R.length} 项，失败 ${bad}`);
process.exit(bad ? 1 : 0);
