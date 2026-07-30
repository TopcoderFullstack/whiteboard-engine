import {
  canElementFlow,
  getElementFlow,
  getFlowDotMetrics,
  getFlowMode,
  getFlowPhase,
  isElementFlowing,
  FLOW_DEFAULT_SPEED,
} from "../flow";

import { API } from "./helpers/api";

import type { ExcalidrawElement } from "../element/types";

// customData 直接挂在成品元素上 —— API.createElement 不透传该字段
const arrow = (
  overrides: {
    strokeStyle?: ExcalidrawElement["strokeStyle"];
    customData?: Record<string, any>;
  } = {},
): ExcalidrawElement => ({
  ...API.createElement({
    type: "arrow",
    strokeStyle: overrides.strokeStyle ?? "dashed",
  }),
  customData: overrides.customData,
});

describe("虚线流动 flow", () => {
  describe("getFlowMode / canElementFlow", () => {
    it("虚线/点线走 dash 模式（虚线本身行进）", () => {
      expect(getFlowMode(arrow({ strokeStyle: "dashed" }))).toBe("dash");
      expect(getFlowMode(arrow({ strokeStyle: "dotted" }))).toBe("dash");
    });

    it("实线走 dots 模式（线不变，叠一串小圆球）", () => {
      expect(getFlowMode(arrow({ strokeStyle: "solid" }))).toBe("dots");
    });

    it("所有线性元素都有资格流动，只是模式不同", () => {
      expect(canElementFlow(arrow({ strokeStyle: "solid" }))).toBe(true);
      expect(canElementFlow(arrow({ strokeStyle: "dashed" }))).toBe(true);
    });

    it("非线性元素不参与（v1 只做箭头/线段）", () => {
      const rect = API.createElement({ type: "rectangle" });
      expect(getFlowMode(rect)).toBeNull();
      expect(canElementFlow(rect)).toBe(false);
    });
  });

  describe("getElementFlow", () => {
    it("未配置 customData 时为 null", () => {
      expect(getElementFlow(arrow())).toBeNull();
    });

    it("enabled 非 true 一律视为不流动", () => {
      expect(
        getElementFlow(arrow({ customData: { flow: { enabled: false } } })),
      ).toBeNull();
      // customData 是自由字段，任何第三方都可能写进异物，必须防御
      expect(
        getElementFlow(
          arrow({ customData: { flow: { enabled: "yes" as any } } }),
        ),
      ).toBeNull();
      expect(getElementFlow(arrow({ customData: { flow: 42 as any } }))).toBe(
        null,
      );
    });

    it("speed 缺失/非有限数时回落默认值，而不是产出 NaN 相位", () => {
      expect(
        getElementFlow(arrow({ customData: { flow: { enabled: true } } }))
          ?.speed,
      ).toBe(FLOW_DEFAULT_SPEED);
      expect(
        getElementFlow(
          arrow({ customData: { flow: { enabled: true, speed: NaN } } }),
        )?.speed,
      ).toBe(FLOW_DEFAULT_SPEED);
    });

    it("读取显式 speed", () => {
      expect(
        getElementFlow(
          arrow({ customData: { flow: { enabled: true, speed: 80 } } }),
        ),
      ).toEqual({ enabled: true, speed: 80 });
    });
  });

  describe("isElementFlowing", () => {
    it("需要同时「有资格」且「已开启」", () => {
      const on = { flow: { enabled: true, speed: 40 } };
      expect(isElementFlowing(arrow({ customData: on }))).toBe(true);
      // 实线同样会流动，只是换成 dots 模式
      expect(
        isElementFlowing(arrow({ strokeStyle: "solid", customData: on })),
      ).toBe(true);
      expect(isElementFlowing(arrow())).toBe(false);
    });

    it("非线性元素即便写了 flow 也不流动", () => {
      const rect = {
        ...API.createElement({ type: "rectangle" }),
        customData: { flow: { enabled: true, speed: 40 } },
      };
      expect(isElementFlowing(rect)).toBe(false);
    });
  });

  describe("getFlowPhase", () => {
    it("不流动的元素相位恒为 0（缓存自门控依赖这一点）", () => {
      // 这是「不流动 → 离屏 canvas 缓存永不失效」的前提：两侧恒等于 0
      expect(getFlowPhase(arrow(), 1234)).toBe(0);
      expect(getFlowPhase(arrow(), 99999)).toBe(0);
      // 非线性元素无论如何都不产生相位
      expect(
        getFlowPhase(
          {
            ...API.createElement({ type: "rectangle" }),
            customData: { flow: { enabled: true, speed: 40 } },
          },
          1234,
        ),
      ).toBe(0);
    });

    it("相位 = 已行进距离，随时间线性推进", () => {
      const el = arrow({ customData: { flow: { enabled: true, speed: 40 } } });
      expect(getFlowPhase(el, 0)).toBe(0);
      expect(getFlowPhase(el, 1000)).toBe(40);
      expect(getFlowPhase(el, 2000)).toBe(80);
    });

    it("实线（dots 模式）同样产生相位", () => {
      const el = arrow({
        strokeStyle: "solid",
        customData: { flow: { enabled: true, speed: 40 } },
      });
      expect(getFlowPhase(el, 1000)).toBe(40);
    });

    it("负 speed 反向流动", () => {
      const el = arrow({ customData: { flow: { enabled: true, speed: -40 } } });
      expect(getFlowPhase(el, 1000)).toBe(-40);
    });

    it("长时间运行不丢精度（不取模的前提）", () => {
      const el = arrow({ customData: { flow: { enabled: true, speed: 200 } } });
      // 连跑 30 天：相位仍是精确整数，远在 float64 整数精度上限之内
      const thirtyDays = 30 * 24 * 3600 * 1000;
      const phase = getFlowPhase(el, thirtyDays);
      expect(Number.isSafeInteger(phase)).toBe(true);
      expect(phase).toBe(518400000);
    });
  });

  describe("getFlowDotMetrics", () => {
    it("圆球随描边加粗而变大", () => {
      expect(getFlowDotMetrics(4).radius).toBeGreaterThan(
        getFlowDotMetrics(1).radius,
      );
    });

    it("细线也保底可见，且间距永远大于直径（不会连成一条）", () => {
      for (const strokeWidth of [0.5, 1, 2, 4, 8]) {
        const { radius, spacing } = getFlowDotMetrics(strokeWidth);
        expect(radius).toBeGreaterThanOrEqual(2);
        expect(spacing).toBeGreaterThan(radius * 2);
      }
    });
  });
});
