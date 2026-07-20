# whiteboard-engine — Fork 手册

本仓库是 [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) 的 fork，
基线 **v0.18.1**（MIT）。作为 topcoderfullstack 桌面工作台「画板」app 的自有引擎，
用于进行上游 npm 包无法实现的内部改造（工具栏结构、内部 API 暴露、能力裁剪、
交互/渲染定制）。

## 分支模型

| 分支 | 用途 | 纪律 |
|---|---|---|
| `master` | 上游镜像 | 永不直接提交，只 `git fetch upstream` 更新 |
| `core` | 我们的主分支（基于 v0.18.1 tag） | 所有改造在此，每项登记 Divergence 清单 |
| `release` | 构建产物（orphan 分支） | 只由 `scripts/fork-release.sh` 生成，禁止手改 |

## Divergence 清单（每次内部改动必须登记）

| # | 文件/范围 | 改动 | 动机 | 上游合并冲突风险 |
|---|---|---|---|---|
| 1 | `.yarnrc` | `ignore-engines true` | 在 node 24 上构建（上游 engines 限 18–22） | 无（新文件） |
| 2 | `scripts/fork-release.sh` | 新增发布脚本 | 构建并更新 release 产物分支 | 无（新文件） |
| 3 | `FORK.md` | 本手册 | — | 无（新文件） |
| 4 | `.github/workflows/`（删除） | 移除上游 CI | fork 不运行上游发布自动化；且 OAuth token 无 workflow scope 无法推送 | 中：上游改 workflow 时产生 modify/delete 冲突，同步时一律保持删除 |

## 构建与发布 runbook

```bash
corepack yarn install --frozen-lockfile   # 首次
scripts/fork-release.sh 0.18.1-fork.N     # 构建 + 更新 release 分支并推送
```

主应用消费方式（git-dependency + npm alias，import 路径不变）：

```json
"@excalidraw/excalidraw": "github:TopcoderFullstack/whiteboard-engine#release"
```

发版后主应用执行 `bun update @excalidraw/excalidraw`（bun.lock 会钉到新 commit）。
主应用的 `bun run sync:excalidraw-assets` 依赖 dist/prod/fonts 路径，发版后如字体
有变需重跑并提交 public/excalidraw/fonts。

## 上游同步 playbook（安全补丁必做，特性按需）

```bash
git fetch upstream --tags
git checkout core
git merge vX.Y.Z          # 按 Divergence 清单逐项核对冲突
corepack yarn --cwd ./packages/excalidraw build:esm   # 构建验证
scripts/fork-release.sh X.Y.Z-fork.0
```

订阅上游 Releases 与 GitHub Security Advisories（先例：v0.18.1 即
@excalidraw/mermaid-to-excalidraw XSS 安全补丁版，CVE-2025-54881）。

## 命名与许可

- 包名 `@topcoderfullstack/board-core`；不以 "Excalidraw" 名义发布（商标不在 MIT
  授权范围内），保留上游 LICENSE 与版权声明。
- 代码地图（改造前须读）：`packages/excalidraw` 编辑器主包（UI/actions/工具栏）、
  `packages/element` 元素逻辑、`packages/common`/`math`/`utils` 基础库、
  `components/App.tsx` 交互状态机（万行级）、`renderer/` 画布渲染。
  `excalidraw-app/` 是官网应用，不使用也不删除（避免 merge 时 modify/delete 噪音）。
