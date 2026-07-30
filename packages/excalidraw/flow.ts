import { isLinearElement } from "./element/typeChecks";

import type { ExcalidrawElement } from "./element/types";

// FORK(board): 流动（flow）
//
// 让线性元素（箭头/线段）表达"数据在流动"。按描边样式分成两种视觉：
//
//   dashed / dotted → "dash" 模式：虚线本身沿路径行进（marching ants）
//   solid           → "dots" 模式：线保持实线，一串小圆球从起点依次驶向终点
//
// 两种模式共用同一个「相位」——已行进的距离（px）。开关与流速共用一套
// customData 与同一个 UI，用户不需要知道底下是两条渲染路径。
//
// 三条设计约束，改这里之前先读：
//
//  1. dash 模式只改 roughjs Drawable 的 `strokeLineDashOffset`，**不重新生成
//     几何**；dots 模式沿缓存 Drawable 的路径采点，采样结果按 Drawable 做
//     WeakMap 缓存（见 flow-path.ts），元素几何一变自动失效。
//
//  2. 开关与速度存进 `element.customData.flow` —— 不扩元素 schema。customData
//     是上游正式的扩展点且被 restore 保留，所以导出的 .excalidraw 与上游/官方
//     excalidraw.com 完全互操作（对方只是不播放动画）。
//
//  3. **动画时钟绝不进 element**。时钟是渲染层的全局量（经 renderConfig.flowTime
//     下发）。若把相位写进元素，每帧都会 bump 元素 version，宿主的场景同步引擎
//     会把 60fps 的相位当成用户改动疯狂上传。

/** 存进 `element.customData.flow` 的载荷 */
export interface ElementFlow {
  enabled: boolean;
  /** 流速，px/秒，沿路径正方向（起点→终点）。负值反向。 */
  speed: number;
}

/** 流动的两种视觉，由描边样式决定，不由用户直接选 */
export type FlowMode = "dash" | "dots";

export const FLOW_DEFAULT_SPEED = 40;
export const FLOW_MIN_SPEED = 5;
export const FLOW_MAX_SPEED = 200;

/** dots 模式：圆球半径 = strokeWidth × 此系数（有下限，细线也看得见） */
const DOT_RADIUS_SCALE = 1.6;
const DOT_MIN_RADIUS = 2;
/** dots 模式：相邻圆球间距，随球径放大以免粗线时挤成一条 */
const DOT_MIN_SPACING = 18;
const DOT_SPACING_SCALE = 8;

/**
 * 元素的流动模式；非线性元素返回 null（v1 只做箭头/线段）。
 * 实线走 dots，虚线/点线走 dash —— 实线没有 dash 可动，只能用圆球表达。
 */
export const getFlowMode = (element: ExcalidrawElement): FlowMode | null => {
  if (!isLinearElement(element)) {
    return null;
  }

  return element.strokeStyle === "solid" ? "dots" : "dash";
};

/** 该元素是否**有资格**流动（与是否开启无关） */
export const canElementFlow = (element: ExcalidrawElement): boolean =>
  getFlowMode(element) !== null;

/**
 * 读取元素上的流动配置。非法/缺省一律回落为 null（= 不流动），
 * 因为 customData 是自由字段，可能被任何第三方写进任意内容。
 */
export const getElementFlow = (
  element: ExcalidrawElement,
): ElementFlow | null => {
  const flow = (
    element.customData as { flow?: Partial<ElementFlow> } | undefined
  )?.flow;

  if (!flow || flow.enabled !== true) {
    return null;
  }

  const speed =
    typeof flow.speed === "number" && Number.isFinite(flow.speed)
      ? flow.speed
      : FLOW_DEFAULT_SPEED;

  return { enabled: true, speed };
};

/** 该元素此刻是否正在流动（有资格 + 已开启） */
export const isElementFlowing = (element: ExcalidrawElement): boolean =>
  canElementFlow(element) && getElementFlow(element) !== null;

/**
 * 元素在 `timeMs` 时刻的流动相位 —— 已沿路径行进的距离（px）。
 *
 * dash 模式取其相反数作 `strokeLineDashOffset`（lineDashOffset 递减 = 图案前移）；
 * dots 模式直接用它做圆球沿弧长的位移。
 *
 * 不做取模：相位是绝对时间的线性函数，float64 在整数区间精确到 9e15，
 * 即便以最高速连跑数月也不丢精度；取模反而会在环绕点引入一帧跳变。
 * （dots 模式在采样时才按路径总长归一，见 flow-path.ts）
 */
export const getFlowPhase = (
  element: ExcalidrawElement,
  timeMs: number,
): number => {
  if (!canElementFlow(element)) {
    return 0;
  }

  const flow = getElementFlow(element);

  if (!flow) {
    return 0;
  }

  const phase = (timeMs / 1000) * flow.speed;

  // 归一化 -0 → 0：相位被当作缓存键比对，保持规范形式，免得将来有人用
  // Object.is / Map 键把 -0 和 0 当成两个不同的值
  return phase === 0 ? 0 : phase;
};

/** dots 模式的圆球半径与间距（由描边宽度导出） */
export const getFlowDotMetrics = (
  strokeWidth: number,
): { radius: number; spacing: number } => {
  const radius = Math.max(DOT_MIN_RADIUS, strokeWidth * DOT_RADIUS_SCALE);

  return {
    radius,
    spacing: Math.max(DOT_MIN_SPACING, radius * DOT_SPACING_SCALE),
  };
};
