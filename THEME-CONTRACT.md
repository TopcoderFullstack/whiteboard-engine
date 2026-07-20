# THEME-CONTRACT — 宿主主题合同

引擎（packages/excalidraw）正式消费一组带 `--board-` 前缀的宿主 CSS 变量。
宿主在 `.excalidraw` 的任意祖先上提供这些变量，引擎内部所有映射到位的
UI/画布颜色即实时跟随（变量继承，零重渲染）。**任何合同变量未提供时，
回退为上游 v0.18.1 原始值** —— 裸引擎与上游视觉完全一致。

改动位置：`css/theme.scss`（亮/暗两块共 61 处）、`components/TextField.scss`
（3 处）。模式统一为 `--内部变量: var(--board-xxx, <上游原值>);`。

## 合同变量 → 内部变量映射

| 合同变量 | 驱动的内部变量 | 语义 |
|---|---|---|
| `--board-bg` | `--color-surface-lowest` `--default-bg-color` `--input-bg-color` | 基础底色 |
| `--board-fg` | `--color-on-surface`（间接：`--text-primary-color` `--icon-fill-color`） | 主文字/图标 |
| `--board-surface` | `--island-bg-color`（间接：`--sidebar-bg-color`） | 悬浮岛底（可给半透明值配毛玻璃） |
| `--board-popup` | `--popup-bg-color` | 弹出层实底 |
| `--board-popup-fg` | `--popup-text-color` | 弹出层文字 |
| `--board-primary` | `--color-primary` `--color-brand-active` | 主色 |
| `--board-primary-hover` | `--color-primary-hover` `--color-brand-hover` | 主色悬停 |
| `--board-primary-darker/-darkest/-light/-light-darker` | 同名 `--color-primary-*` | 主色梯度（宿主显式分档） |
| `--board-accent` | `--color-surface-high` `--color-surface-primary-container` `--input-hover-bg-color`（间接：`--button-hover-bg` `--default-border-color` `--sidebar-border-color`） | 悬停/激活容器 |
| `--board-accent-fg` | `--color-on-primary-container` | 激活容器上的文字 |
| `--board-muted` | `--color-surface-mid` `--color-surface-low` `--popup-secondary-bg-color` `--button-active-bg` | 次级底 |
| `--board-border` | `--dialog-border-color` `--input-border-color` `--scrollbar-thumb` `--ExcTextField--border` | 边框 |
| `--board-ring` | `--scrollbar-thumb-hover` `--ExcTextField--border-hover/-active` | 焦点/滚动条悬停 |
| `--board-selection` | `--color-selection` | 画布框选与选中态点缀（宿主接动态 tint） |
| `--board-radius-md` / `--board-radius-lg` | `--border-radius-md` / `--border-radius-lg` | 圆角 |
| `--board-island-shadow` | `--shadow-island` | 悬浮岛阴影（宿主可嵌 tint 描边） |

## 亮暗行为

亮暗两个块（`.excalidraw` 与 `.excalidraw.theme--dark`）消费**同一组合同
变量**，各自保留自己的上游原值作回退。宿主的 token 自身随宿主暗色机制翻转
即可；需要亮暗不同的合同值（如 primary 梯度）由宿主分别提供。

## 维护规则

- 上游同步时若 `theme.scss` 有冲突：保留 var 包裹模式，把上游的新默认值
  填进回退位；上游新增的重要颜色变量按语义并入上表。
- 宿主侧供值实现见主应用
  `src/components/desktop/apps/whiteboard/whiteboard.css`。
