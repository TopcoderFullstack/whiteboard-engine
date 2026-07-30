import { drawFlowDots } from "../flow-path";

import type { Drawable, Op } from "roughjs/bin/core";

// 用 mock context 捕获 arc() 落点 —— 直接验证「圆球画在了路径上的哪里」，
// 比测内部私有函数更贴近真实行为
const mockContext = () => {
  const dots: { x: number; y: number; r: number }[] = [];

  return {
    dots,
    ctx: {
      save() {},
      restore() {},
      beginPath() {},
      fill() {},
      arc(x: number, y: number, r: number) {
        dots.push({ x, y, r });
      },
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D,
  };
};

const drawable = (ops: Op[]): Drawable =>
  ({
    shape: "line",
    options: {},
    sets: [{ type: "path", ops }],
  }) as unknown as Drawable;

/** 水平直线 (0,0) → (100,0) */
const straightLine = drawable([
  { op: "move", data: [0, 0] },
  { op: "lineTo", data: [100, 0] },
]);

const draw = (shape: Drawable, phase: number, strokeWidth = 2) => {
  const { ctx, dots } = mockContext();

  drawFlowDots(ctx, shape, { strokeColor: "#000", strokeWidth, phase });

  return dots;
};

describe("流动 dots 模式的路径采样", () => {
  it("沿直线等距排布圆球", () => {
    const dots = draw(straightLine, 0);

    expect(dots.length).toBeGreaterThan(1);
    // 全部落在直线上
    for (const dot of dots) {
      expect(dot.y).toBeCloseTo(0);
      expect(dot.x).toBeGreaterThanOrEqual(0);
      expect(dot.x).toBeLessThanOrEqual(100);
    }
    // 间距均匀
    const xs = dots.map((d) => d.x).sort((a, b) => a - b);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]!);
    for (const gap of gaps) {
      expect(gap).toBeCloseTo(gaps[0]!);
    }
  });

  it("相位推进 = 圆球整体沿路径前移", () => {
    const at0 = draw(straightLine, 0).map((d) => d.x);
    const at10 = draw(straightLine, 10).map((d) => d.x);

    expect(at10.length).toBe(at0.length);
    // 第一颗从 0 走到 10（尚未环绕）
    expect(Math.min(...at10)).toBeCloseTo(10);
    expect(Math.min(...at0)).toBeCloseTo(0);
  });

  it("走到尽头后环绕回起点，位置始终落在路径内", () => {
    // 相位远超路径总长（连续播放很久之后）
    for (const phase of [150, 1000, 123456.7]) {
      const dots = draw(straightLine, phase);

      expect(dots.length).toBeGreaterThan(0);
      for (const dot of dots) {
        expect(dot.x).toBeGreaterThanOrEqual(0);
        expect(dot.x).toBeLessThanOrEqual(100);
        expect(Number.isFinite(dot.x)).toBe(true);
      }
    }
  });

  it("负相位（反向流动）同样归一到路径内", () => {
    const dots = draw(straightLine, -37.5);

    expect(dots.length).toBeGreaterThan(0);
    for (const dot of dots) {
      expect(dot.x).toBeGreaterThanOrEqual(0);
      expect(dot.x).toBeLessThanOrEqual(100);
    }
  });

  it("按弧长而非按点序均分（折线拐弯处不会疏密不均）", () => {
    // L 形：(0,0)→(100,0)→(100,100)，两段等长，总长 200
    const elbow = drawable([
      { op: "move", data: [0, 0] },
      { op: "lineTo", data: [100, 0] },
      { op: "lineTo", data: [100, 100] },
    ]);
    const dots = draw(elbow, 0);

    // 两条边上的圆球数应大致相等 —— 若按点序均分会全挤在某一段
    const onFirst = dots.filter((d) => d.y < 1).length;
    const onSecond = dots.filter((d) => d.x > 99).length;
    expect(Math.abs(onFirst - onSecond)).toBeLessThanOrEqual(1);
  });

  it("贝塞尔段被离散化，圆球贴着曲线走", () => {
    // 从 (0,0) 出发的三次贝塞尔，控制点把曲线拉高
    const curve = drawable([
      { op: "move", data: [0, 0] },
      { op: "bcurveTo", data: [0, 50, 100, 50, 100, 0] },
    ]);
    const dots = draw(curve, 0);

    expect(dots.length).toBeGreaterThan(1);
    // 曲线中部应明显高于两端（y > 0），证明确实采到了曲线而非直连弦
    expect(Math.max(...dots.map((d) => d.y))).toBeGreaterThan(10);
  });

  it("同一 path 内的第二段子路径被忽略（避免圆球在两笔间瞬移）", () => {
    const twoSubpaths = drawable([
      { op: "move", data: [0, 0] },
      { op: "lineTo", data: [100, 0] },
      // rough 的第二笔描边：起点又跳回左侧
      { op: "move", data: [0, 20] },
      { op: "lineTo", data: [100, 20] },
    ]);
    const dots = draw(twoSubpaths, 0);

    expect(dots.length).toBeGreaterThan(0);
    // 只取第一段 → 不应有落在 y≈20 的圆球
    for (const dot of dots) {
      expect(dot.y).toBeCloseTo(0);
    }
  });

  it("退化路径（零长度 / ops 为空）安全跳过，不抛错也不画", () => {
    expect(draw(drawable([]), 0)).toHaveLength(0);
    expect(
      draw(
        drawable([
          { op: "move", data: [5, 5] },
          { op: "lineTo", data: [5, 5] },
        ]),
        0,
      ),
    ).toHaveLength(0);
  });

  it("短路径也至少有一颗圆球在走", () => {
    const tiny = drawable([
      { op: "move", data: [0, 0] },
      { op: "lineTo", data: [4, 0] },
    ]);
    expect(draw(tiny, 0).length).toBeGreaterThanOrEqual(1);
  });
});
