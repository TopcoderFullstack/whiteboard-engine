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
| 5 | `css/theme.scss`（61 处）`components/TextField.scss`（3 处） | 主题合同：内部颜色变量包裹为 `var(--board-*, 原值)` | 宿主 token 驱动引擎全局风格，见 THEME-CONTRACT.md | 中：上游改 theme.scss 需按合同文档重对映射（保包裹模式、换回退值） |
| 6 | `THEME-CONTRACT.md` | 合同文档 | — | 无（新文件） |
| 7 | `components/icons.tsx`（23 个图标重绘） | 核心 chrome 图标替换为 lucide 几何（stroke 1.5，标 `FORK(board) lucide:` 注释） | 与宿主桌面 dock/菜单同一图标语言 | 中：上游改这些图标定义时冲突，保留 lucide 版并核对新增用途 |
| 8 | `css/board-effects.scss` + `ToolIcon.scss`（1 行 import） | 图标互动特效（hover 弹性/按压/选中 tint 发光+弹跳，含 reduced-motion 降级；作用于菜单/撤销/缩放等按钮） | 桌面级质感 | 低：新文件 + 单行 import |
| 9 | `css/board-effects.scss` | 废弃引擎形状工具栏（`.shapes-section` 隐藏）；撤销/重做移到右下 | 工具栏由宿主用 React Bits Dock 自绘（setActiveTool 驱动，见宿主 board-dock.tsx） | 低：纯 CSS，上游布局重构时复查 |
| 10 | `components/App.tsx` + `types.ts` | imperative API 暴露 `runAction(name, value?)`（actionManager 直通） | 宿主自绘属性面板/未来自绘 chrome 驱动引擎 action（undo/redo/图层/对齐/字号/箭头…） | 低：API 组装处附加字段，上游冲突面小 |
| 11 | `css/board-effects.scss` | 隐藏画布内缩放/撤销重做/帮助/素材库按钮与右键菜单（宿主标题栏簇 + 宿主 BoardContextMenu 接管，右键状态经 appState.contextMenu 映射）；素材库侧栏经 `wb-lib-external` + `--wb-lib-*` 变量 fixed 外置窗外右侧 | 画布内零 chrome；引擎菜单溢出容器会顶起画布 | 低：纯 CSS |
| 12 | `data/library.ts` `mergeLibraryItems` | 合并前先按 item.id 判重（标 `FORK(board)` 注释） | 上游按元素逐一判重，restoreLibraryItems 重造元素内部字段后判重失效，网络导入 + adapter 初始加载重复合并会产生重复条目 | 低：单函数小改，上游改动时保留 id 先行判重 |
| 13 | `components/App.tsx` + `types.ts` + `css/board-effects.scss` | imperative API 暴露 `insertLibraryItems(items)`（onInsertElements + 方阵分布直通）；引擎默认侧栏整体隐藏 | 素材库由宿主自绘面板接管（搜索/来源分组/放大预览，见宿主 board-library.tsx） | 低：API 组装处附加字段 + 纯 CSS |
| 14 | `components/App.tsx` `updateDOMRect` | 容器尺寸变化时在同一 setState 内按半差量补偿 scrollX/scrollY（随缩放换算，首测 0 尺寸跳过） | 窗口缩放/最大化时视口中心内容保持稳定；宿主侧补偿慢一帧会"先移后回" | 低：单函数小改 |

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
- 代码地图（改造前须读，v0.18.1 布局）：`packages/excalidraw` 编辑器主包
  （`components/` UI、`actions/` 动作、`element/` 元素逻辑、`renderer/` 画布渲染、
  `components/App.tsx` 交互状态机（万行级）、`locales/` 文案）、
  `packages/math`/`utils` 基础库。
  `excalidraw-app/` 是官网应用，不使用也不删除（避免 merge 时 modify/delete 噪音）。
