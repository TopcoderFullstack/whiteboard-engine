import { getCurvePathOps } from "@excalidraw/utils/geometry/shape";

import { getFlowDotMetrics } from "./flow";

import type { Drawable } from "roughjs/bin/core";

// FORK(board): 流动 dots 模式的路径采样与绘制。
//
// 圆球必须贴着**实际画出来的那条线**走，所以采样对象是缓存的 roughjs
// Drawable（含 roughness 抖动），而不是元素的理想点位 —— 否则 sloppiness
// 调高时圆球会明显飘在线外。
//
// 采样结果按 Drawable 做 WeakMap 缓存：Drawable 由 ShapeCache 持有，元素几何
// 一变就会重新生成新的 Drawable 对象，缓存随之自动失效，无需手动失效逻辑。

/** 每段三次贝塞尔的离散化份数（够密，肉眼看不出折线） */
const BEZIER_STEPS = 16;

interface FlowPath {
  /** 元素局部坐标下的折线点 */
  points: [number, number][];
  /** 与 points 等长的累计弧长，cumulative[0] === 0 */
  cumulative: number[];
  /** 路径总长（px） */
  total: number;
}

const pathCache = new WeakMap<Drawable, FlowPath>();

const cubicAt = (
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number => {
  const u = 1 - t;

  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

/** 把 roughjs 的路径 ops 离散成折线并算好累计弧长 */
const buildFlowPath = (shape: Drawable): FlowPath | null => {
  const ops = getCurvePathOps(shape);

  if (!ops.length) {
    return null;
  }

  const points: [number, number][] = [];
  let current: [number, number] | null = null;

  for (const op of ops) {
    const d = op.data;

    if (op.op === "move") {
      // rough 的一条 path 可能含多个子路径（多笔描边）；只取第一段，
      // 否则圆球会在两笔之间来回瞬移
      if (points.length > 0) {
        break;
      }
      current = [d[0]!, d[1]!];
      points.push(current);
    } else if (op.op === "lineTo") {
      current = [d[0]!, d[1]!];
      points.push(current);
    } else if (op.op === "bcurveTo" && current) {
      const [x0, y0] = current;
      const [x1, y1, x2, y2, x3, y3] = d as [
        number,
        number,
        number,
        number,
        number,
        number,
      ];

      for (let i = 1; i <= BEZIER_STEPS; i++) {
        const t = i / BEZIER_STEPS;

        points.push([
          cubicAt(x0, x1, x2, x3, t),
          cubicAt(y0, y1, y2, y3, t),
        ]);
      }
      current = [x3, y3];
    }
  }

  if (points.length < 2) {
    return null;
  }

  const cumulative: number[] = [0];
  let total = 0;

  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1]!;
    const [x, y] = points[i]!;

    total += Math.hypot(x - px, y - py);
    cumulative.push(total);
  }

  if (total <= 0) {
    return null;
  }

  return { points, cumulative, total };
};

const getFlowPath = (shape: Drawable): FlowPath | null => {
  const cached = pathCache.get(shape);

  if (cached) {
    return cached;
  }

  const path = buildFlowPath(shape);

  if (path) {
    pathCache.set(shape, path);
  }

  return path;
};

/** 弧长 d 处的点（d 已归一到 [0, total)），二分定位后线性插值 */
const pointAtDistance = (path: FlowPath, d: number): [number, number] => {
  const { points, cumulative } = path;

  let lo = 0;
  let hi = cumulative.length - 1;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;

    if (cumulative[mid]! < d) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  if (lo === 0) {
    return points[0]!;
  }

  const segStart = cumulative[lo - 1]!;
  const segLen = cumulative[lo]! - segStart;
  const t = segLen > 0 ? (d - segStart) / segLen : 0;
  const [ax, ay] = points[lo - 1]!;
  const [bx, by] = points[lo]!;

  return [ax + (bx - ax) * t, ay + (by - ay) * t];
};

/**
 * 沿路径画一串等距小圆球，整体按 `phase`（已行进距离，px）平移。
 *
 * 坐标系与 rc.draw 一致（元素局部坐标），因此可直接在 drawElementOnCanvas
 * 里画完线之后叠加。透明度沿用调用方设好的 globalAlpha（元素 opacity）。
 */
export const drawFlowDots = (
  context: CanvasRenderingContext2D,
  shape: Drawable,
  options: { strokeColor: string; strokeWidth: number; phase: number },
): void => {
  const path = getFlowPath(shape);

  if (!path) {
    return;
  }

  const { radius, spacing } = getFlowDotMetrics(options.strokeWidth);
  const { total } = path;
  // 至少一颗：短箭头也要能看出"有东西在走"
  const count = Math.max(1, Math.round(total / spacing));
  // 用实际步距而非 spacing，让首尾衔接处间隔均匀，不会在环绕点挤一下
  const step = total / count;

  context.save();
  context.fillStyle = options.strokeColor;

  for (let i = 0; i < count; i++) {
    // 负速度会让相位为负，先归一到 [0, total)
    const d = (((options.phase + i * step) % total) + total) % total;
    const [x, y] = pointAtDistance(path, d);

    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
};
