#!/usr/bin/env node
// 开发用 watch 构建：监听源码变更 → 重建 packages/excalidraw/dist →
// 拷贝进主应用的 node_modules/@excalidraw/excalidraw/dist，实现秒级预览。
// 不用软链：Turbopack 会把软链解析到项目根之外，且会引入第二个 React。
// 只跑 esbuild 打包，不跑 tsc 类型（改对外 API 类型时手动 `yarn gen:types`）。
//
// 用法: node scripts/fork-dev.mjs /path/to/主应用
import { execSync } from "node:child_process"
import { cpSync, existsSync, rmSync, watch } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const appRoot = process.argv[2]
if (!appRoot) {
  console.error("用法: node scripts/fork-dev.mjs /path/to/主应用")
  process.exit(1)
}
const target = path.join(appRoot, "node_modules", "@excalidraw", "excalidraw", "dist")
if (!existsSync(path.dirname(target))) {
  console.error(`主应用里没有 @excalidraw/excalidraw（先 bun install）: ${target}`)
  process.exit(1)
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pkgDir = path.join(root, "packages", "excalidraw")
const WATCH_DIRS = ["excalidraw", "math", "utils"]
  .map((p) => path.join(root, "packages", p))
  .filter((p) => existsSync(p))

function buildAndSync(reason) {
  const t = Date.now()
  process.stdout.write(`[fork-dev] rebuild (${reason}) ... `)
  try {
    rmSync(path.join(pkgDir, "dist"), { recursive: true, force: true })
    execSync("node ../../scripts/buildPackage.js", {
      cwd: pkgDir,
      stdio: ["ignore", "ignore", "inherit"],
    })
    rmSync(target, { recursive: true, force: true })
    cpSync(path.join(pkgDir, "dist"), target, { recursive: true })
    console.log(`built + synced in ${((Date.now() - t) / 1000).toFixed(1)}s`)
  } catch {
    console.log("FAILED (see errors above)")
  }
}

let timer = null
function schedule(file) {
  clearTimeout(timer)
  timer = setTimeout(() => buildAndSync(file), 300)
}

buildAndSync("initial")
for (const dir of WATCH_DIRS) {
  watch(dir, { recursive: true }, (_event, file) => {
    if (!file) return
    if (/^(dist|types|node_modules)\//.test(file)) return
    if (/\/(dist|types|node_modules|__snapshots__|tests)\//.test(`/${file}`)) return
    schedule(file)
  })
}
console.log(`[fork-dev] watching → 同步到 ${target}\n改动 packages/* 源码即自动生效（浏览器刷新查看），Ctrl+C 退出`)
