// 语言判断的单元测试：node test/lang.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ctx = { globalThis: null };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'lang.js'), 'utf8'), ctx);
const { looksChinese } = ctx.YJ_LANG;

const cases = [
  ['这是一段普通的中文', true, '常见中文'],
  ['這是一段繁體中文', true, '繁体'],
  ['This is a normal English sentence.', false, '英文'],
  ['ACCA 是一个国际证书', true, '中英混排，汉字为主'],
  ['我们 use Chinese mixed with a lot of English words here', false, '中英混排，英文为主'],
  ['1234 5678', false, '纯数字'],
  ['，。！？', false, '纯标点'],
  ['', false, '空字符串'],
  ['中', false, '单个汉字（多半是误选）'],
  ['这是一个测试 test', true, '中文为主'],
];

let fails = 0;
for (const [text, expect, name] of cases) {
  const got = looksChinese(text);
  const ok = got === expect;
  if (!ok) fails++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}: ${JSON.stringify(text)} → ${got}`);
}
console.log(fails ? `\n失败 ${fails}` : `\n${cases.length} 项全部通过`);
process.exit(fails ? 1 : 0);
