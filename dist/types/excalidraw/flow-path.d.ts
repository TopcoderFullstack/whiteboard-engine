import type { Drawable } from "roughjs/bin/core";
/**
 * 沿路径画一串等距小圆球，整体按 `phase`（已行进距离，px）平移。
 *
 * 坐标系与 rc.draw 一致（元素局部坐标），因此可直接在 drawElementOnCanvas
 * 里画完线之后叠加。透明度沿用调用方设好的 globalAlpha（元素 opacity）。
 */
export declare const drawFlowDots: (context: CanvasRenderingContext2D, shape: Drawable, options: {
    strokeColor: string;
    strokeWidth: number;
    phase: number;
}) => void;
