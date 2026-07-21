#!/usr/bin/env bash
# 从 core 构建并更新 release 产物分支（供主应用 git-dependency 消费）
# 用法: scripts/fork-release.sh <version>   例: scripts/fork-release.sh 0.18.1-fork.1
set -euo pipefail

VERSION="${1:?usage: fork-release.sh <version>}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

corepack yarn --cwd ./packages/excalidraw build:esm

TMP="$(mktemp -d)/release"
git worktree add "$TMP" release
trap 'git worktree remove --force "$TMP" 2>/dev/null || true' EXIT

rm -rf "$TMP/dist"
cp -R packages/excalidraw/dist "$TMP/dist"
cp LICENSE "$TMP/LICENSE"

TMP="$TMP" VERSION="$VERSION" python3 - <<'EOF'
import json, os
tmp, version = os.environ["TMP"], os.environ["VERSION"]
pkg = json.load(open("packages/excalidraw/package.json"))
pkg["name"] = "@topcoderfullstack/board-core"
pkg["version"] = version
pkg["description"] = (
    "Whiteboard engine for the desktop workspace "
    "(fork of @excalidraw/excalidraw, MIT)"
)
for key in ("private", "scripts", "devDependencies"):
    pkg.pop(key, None)
json.dump(pkg, open(f"{tmp}/package.json", "w"), indent=2)
EOF

cd "$TMP"
# -f 强制纳入 dist（防任何 .gitignore 规则漏掉产物）；再 -A 收尾 package.json/LICENSE
git add -Af dist
git add -A
# 发布保险：dev/prod/types 三样产物必须都在 index 里，否则中止（绝不 push 残缺
# release）。曾出现过只发出 dist/types、dev/prod 缺失导致线上引擎无代码的事故。
for d in dev prod types; do
  if [ -z "$(git ls-files "dist/$d" | head -1)" ]; then
    echo "ERROR: dist/$d 未纳入 release —— 中止，未 push。检查 build:esm 产物。" >&2
    exit 1
  fi
done
git commit -m "release: $VERSION"
git push origin release
echo "released $VERSION — 主应用执行: bun update @excalidraw/excalidraw"
