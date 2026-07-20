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
git add -A
git commit -m "release: $VERSION"
git push origin release
echo "released $VERSION — 主应用执行: bun update @excalidraw/excalidraw"
