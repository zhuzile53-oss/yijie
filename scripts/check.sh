#!/usr/bin/env bash
# 发布前体检：语法、单元测试、manifest、隐私红线、文档链接。
# 用法：./scripts/check.sh
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; fail=1; }
head_() { printf '\n\033[1m%s\033[0m\n' "$*"; }

head_ "1. JS 语法"
if command -v node >/dev/null 2>&1; then
  for f in src/*.js test/*.mjs; do
    if node --check "$f" 2>/dev/null; then ok "$f"; else bad "$f 语法错误"; fi
  done
else
  printf '  (跳过：没有 node)\n'
fi

head_ "2. 单元测试"
if command -v node >/dev/null 2>&1; then
  for t in test/background.test.mjs test/lang.test.mjs; do
    if out=$(node "$t" 2>&1); then
      ok "$t — $(printf '%s' "$out" | tail -1)"
    else
      bad "$t 失败"
      printf '%s\n' "$out" | grep FAIL | sed 's/^/      /'
    fi
  done
else
  printf '  (跳过：没有 node)\n'
fi

head_ "3. manifest"
python3 - <<'PY'
import json, os, sys

fail = 0
def check(cond, msg):
    global fail
    print(("  \033[32m✓\033[0m " if cond else "  \033[31m✗\033[0m ") + msg)
    if not cond:
        fail = 1

m = json.load(open("manifest.json"))
check(m.get("manifest_version") == 3, "manifest_version = 3")
check(bool(m.get("name")) and bool(m.get("version")), f"name / version = {m.get('name')} {m.get('version')}")

paths = [m["background"]["service_worker"], m["options_page"]]
paths += m["content_scripts"][0]["js"] + m["content_scripts"][0]["css"]
paths += list(m.get("icons", {}).values())
paths += list(m.get("action", {}).get("default_icon", {}).values())
missing = sorted({p for p in paths if not os.path.exists(p)})
check(not missing, "所有引用文件存在" + ("" if not missing else "，缺: " + ", ".join(missing)))

matches = m["content_scripts"][0]["matches"]
check(any("://*/*" in x for x in matches), f"全站匹配: {matches}")
check("all_frames" in m["content_scripts"][0], "content script 启用 all_frames")

perms = set(m.get("permissions", []))
check("storage" in perms, "声明 storage 权限")
check(bool(m.get("optional_host_permissions")), "声明 optional_host_permissions（自定义接口用）")
check("host_permissions" in m, "声明 host_permissions")

sys.exit(fail)
PY
[ $? -ne 0 ] && fail=1

head_ "4. 隐私红线（LICENSE 署名除外）"
# 排除 LICENSE（署名是公开信息）和本脚本自身（它必须写出这些字符串才能扫）
hits=$(grep -rIni --exclude-dir=.git --exclude-dir=dist --exclude=LICENSE --exclude=check.sh \
        -e 'zhuzile53' -e 'vitalsource' -e 'workers\.dev' -e 'zile-acca' \
        -e 'acca-reader' -e 'ADMIN_TOKEN' . 2>/dev/null)
if [ -z "$hits" ]; then ok "没有私有域名 / 旧项目名 / 令牌字样"; else bad "命中："; printf '%s\n' "$hits" | sed 's/^/      /'; fi

real_key=$(grep -rInE --exclude-dir=.git --exclude-dir=dist 'sk-[A-Za-z0-9]{24,}' . 2>/dev/null)
if [ -z "$real_key" ]; then ok "没有疑似真实 API Key"; else bad "疑似真实 Key："; printf '%s\n' "$real_key" | sed 's/^/      /'; fi

leaked=$(git ls-files 2>/dev/null | grep -E '\.(env|key|pem)$|^config\.json$' || true)
if [ -z "$leaked" ]; then ok "没有敏感文件被跟踪"; else bad "被跟踪的敏感文件：$leaked"; fi

head_ "5. 文档链接"
if command -v node >/dev/null 2>&1; then
  node - <<'JS'
const fs = require('fs');
let fail = 0;
for (const f of ['README.md', 'README.zh-CN.md', 'CONTRIBUTING.md', 'PRIVACY.md']) {
  if (!fs.existsSync(f)) { console.log('  \x1b[31m✗\x1b[0m 缺少 ' + f); fail = 1; continue; }
  const s = fs.readFileSync(f, 'utf8');
  const links = [...s.matchAll(/\]\((?!https?:|#)([^)#]+)\)/g)].map((m) => m[1]);
  const imgs = [...s.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);
  const missing = [...new Set([...links, ...imgs])].filter((p) => !fs.existsSync(p));
  if (missing.length) { console.log('  \x1b[31m✗\x1b[0m ' + f + ' 链接失效: ' + missing.join(', ')); fail = 1; }
  else console.log('  \x1b[32m✓\x1b[0m ' + f);
}
process.exit(fail);
JS
  [ $? -ne 0 ] && fail=1
else
  printf '  (跳过：没有 node)\n'
fi

printf '\n'
if [ $fail -eq 0 ]; then
  printf '\033[32m全部通过，可以发布。\033[0m\n'
else
  printf '\033[31m有问题，先修上面的 ✗。\033[0m\n'
fi
exit $fail
