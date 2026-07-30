import type { ExcalidrawElement } from "./element/types";
/** 存进 `element.customData.flow` 的载荷 */
export interface ElementFlow {
    enabled: boolean;
    /** 流速，px/秒，沿路径正方向（起点→终点）。负值反向。 */
    speed: number;
}
/** 流动的两种视觉，由描边样式决定，不由用户直接选 */
export type FlowMode = "dash" | "dots";
export declare const FLOW_DEFAULT_SPEED = 40;
export declare const FLOW_MIN_SPEED = 5;
export declare const FLOW_MAX_SPEED = 200;
/**
 * 元素的流动模式；非线性元素返回 null（v1 只做箭头/线段）。
 * 实线走 dots，虚线/点线走 dash —— 实线没有 dash 可动，只能用圆球表达。
 */
export declare const getFlowMode: (element: ExcalidrawElement) => FlowMode | null;
/** 该元素是否**有资格**流动（与是否开启无关） */
export declare const canElementFlow: (element: ExcalidrawElement) => boolean;
/**
 * 读取元素上的流动配置。非法/缺省一律回落为 null（= 不流动），
 * 因为 customData 是自由字段，可能被任何第三方写进任意内容。
 */
export declare const getElementFlow: (element: ExcalidrawElement) => ElementFlow | null;
/** 该元素此刻是否正在流动（有资格 + 已开启） */
export declare const isElementFlowing: (element: ExcalidrawElement) => boolean;
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
export declare const getFlowPhase: (element: ExcalidrawElement, timeMs: number) => number;
/** dots 模式的圆球半径与间距（由描边宽度导出） */
export declare const getFlowDotMetrics: (strokeWidth: number) => {
    radius: number;
    spacing: number;
};
