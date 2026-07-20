# CLAUDE.md — whiteboard-engine

回答采用中英文双语，中文为主，英文关键词用英语。

## 仓库定位

本仓库是 excalidraw/excalidraw 的 **fork**（基线 v0.18.1，MIT），作为
topcoderfullstack 桌面工作台「画板」app 的自有画布引擎，进行上游 npm 包做不到的
内部改造（工具栏结构、内部 API 暴露、能力裁剪、交互/渲染定制、新功能）。

- 消费方（主应用）：`/Volumes/Data/Codespace/topcoderfullstack_2`，通过
  git-dependency（`github:TopcoderFullstack/whiteboard-engine#release`）+
  开发期 copy-sync 消费构建产物。
- **改造前必读 `FORK.md`**（分支纪律、divergence 清单、runbook）。

## 分支纪律（严格遵守）

- `master`：上游镜像，永不直接提交
- `core`：唯一工作分支，所有改造在此
- `release`：构建产物分支，只由 `scripts/fork-release.sh` 生成，禁止手改

## 开发与验证循环

1. 主应用侧通常已运行 `bun run engine:watch`（即本仓库 `scripts/fork-dev.mjs`）：
   改动 `packages/*` 源码保存 → 自动 esbuild 重建（~1.5s）→ dist 拷入主应用
   node_modules → **浏览器刷新 `localhost:3000` 打开「画板」窗口查看效果**
2. watch 不重建类型：改了对外类型/API 后手动执行
   `corepack yarn --cwd packages/excalidraw gen:types`（产出 `dist/types`，
   否则主应用 `bun run typecheck` 失败）
3. 手动全量构建：`corepack yarn --cwd packages/excalidraw build:esm`
   （`buildPackage.js` 必须以 `packages/excalidraw` 为 cwd 运行）
4. 验证注意：画板窗口内容高度低于约 500px 会触发 Excalidraw 移动端布局
   （UI 结构大变，不是 bug），验证桌面布局时保持大窗口
5. sass deprecation 告警是上游历史遗留，无害，忽略
6. **同步撞车警告**：宿主的 engine:watch 在跑时，改完源码交给它自动 build+sync 即可，
   不要再手动 build 或手动拷 dist（两个进程并发 rm/cp 会拷出半成品导致宿主 500）

## 改造纪律

- **每一处改动登记进 `FORK.md` 的 Divergence 清单**（文件/动机/冲突风险），
  这是未来 merge 上游安全补丁的生命线
- 优先「prop 化 / 配置化 / 扩展点」，硬编码删除是最后手段（减少上游合并冲突）
- 新增文件优先于修改上游文件
- 不动 `excalidraw-app/`（官网应用，不使用也不删除，避免 merge 噪音）
- 不恢复 `.github/workflows/`（已删除，divergence #4；push 会因 token 无
  workflow scope 被拒）
- 包名/对外名义不使用 "Excalidraw" 商标（对外身份是
  `@topcoderfullstack/board-core`），保留上游 LICENSE 与版权头

## 代码地图（packages/excalidraw/）

- `components/` — UI（工具栏 `Actions.tsx`/`shapes.tsx`、`App.tsx` 是万行级
  交互状态机，改前先搜索定位、小步改动）
- `actions/` — 各类操作（对齐/删除/导出/撤销等，注册式）
- `element/` — 元素几何/命中/绑定逻辑
- `renderer/` — 画布渲染（选中框、手柄、网格）
- `locales/` — 文案（en.json 为基准）
- `packages/math` / `packages/utils` — 基础库

## 提交与发布

- 提交规范：Angular convention（feat/fix/chore/…），**禁止任何 AI 生成标记或
  Co-Authored-By 署名**
- 阶段性发版：`scripts/fork-release.sh 0.18.1-fork.N`（构建 + 更新 release
  分支并推送）→ 主应用 `bun update @excalidraw/excalidraw`
- 上游安全补丁同步流程见 `FORK.md`
