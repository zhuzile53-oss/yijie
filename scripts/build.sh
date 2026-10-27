#!/usr/bin/env bash
# 打包成可分发的 zip（上传应用商店或直接发给别人解压加载）。
# 用法：./scripts/build.sh          产出 dist/yijie-<version>.zip
#       ./scripts/build.sh --crx    额外尝试用 Chrome 生成 .crx（需要本机装有 Chrome）
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
NAME="yijie-$VERSION"
OUT="dist"

mkdir -p "$OUT"
rm -f "$OUT/$NAME.zip"

# 只打包运行时需要的文件：商店审核看的也是这些
zip -qr "$OUT/$NAME.zip" manifest.json src icons LICENSE -x '*.DS_Store' '*__MACOSX*'

echo "已生成 $OUT/$NAME.zip"
unzip -Z1 "$OUT/$NAME.zip" | sed 's/^/  /'

if [ "${1:-}" = "--crx" ]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  if [ -x "$CHROME" ]; then
    echo "正在用 Chrome 打包 .crx（会生成一个私钥 .pem，注意不要提交）…"
    rm -rf "$OUT/.pack" && mkdir -p "$OUT/.pack"
    cp -R manifest.json src icons "$OUT/.pack/"
    "$CHROME" --pack-extension="$PWD/$OUT/.pack" --no-message-box >/dev/null 2>&1 || true
    if [ -f "$OUT/.pack.crx" ]; then
      mv "$OUT/.pack.crx" "$OUT/$NAME.crx"
      mv "$OUT/.pack.pem" "$OUT/$NAME.pem" 2>/dev/null || true
      echo "已生成 $OUT/$NAME.crx（$OUT/$NAME.pem 是私钥，绝不要提交或上传）"
    else
      echo "Chrome 打包失败，跳过 .crx"
    fi
    rm -rf "$OUT/.pack"
  else
    echo "没有找到 Chrome，跳过 .crx"
  fi
fi
