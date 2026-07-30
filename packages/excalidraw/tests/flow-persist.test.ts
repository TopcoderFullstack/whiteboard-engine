import { serializeAsJSON } from "../data/json";
import { restore } from "../data/restore";
import { getSceneVersion } from "../element";
import { newElementWith } from "../element/mutateElement";
import { getElementFlow } from "../flow";

import { API } from "./helpers/api";

import type { ExcalidrawElement } from "../element/types";

// FORK(board): 流动配置的落盘链路回归。
//
// 曾出过一个真实丢数据的 bug：宿主属性面板用 `{ ...el, ...patch }` 造新元素，
// version 原封不动 —— 而宿主判断「有没有改动」靠 getSceneVersion()（= 所有
// 元素 version 之和），于是改动对同步引擎完全隐形，当场看得见、重开就没了。
// 这里把两端都钉住：改动必须能被 getSceneVersion 感知，且 customData 必须
// 扛得住 serialize → restore 的往返。

const flowArrow = (speed = 40) =>
  newElementWith(
    API.createElement({ type: "arrow", strokeStyle: "solid" }),
    { customData: { flow: { enabled: true, speed } } } as any,
  );

describe("流动配置的持久化", () => {
  describe("改动可被 getSceneVersion 感知（同步管道的入口条件）", () => {
    it("newElementWith 写 customData 会 bump version", () => {
      const before = API.createElement({ type: "arrow", strokeStyle: "solid" });
      const after = newElementWith(before, {
        customData: { flow: { enabled: true, speed: 40 } },
      } as any);

      expect(after.version).toBe(before.version + 1);
      expect(getSceneVersion([after])).not.toBe(getSceneVersion([before]));
    });

    it("普通展开不动 version —— 正是它让改动对同步引擎隐形", () => {
      const before = API.createElement({ type: "arrow", strokeStyle: "solid" });
      const spread = {
        ...before,
        customData: { flow: { enabled: true, speed: 40 } },
      };

      // 内容确实变了，但 getSceneVersion 看不见 → 宿主绝不能用这种写法
      expect(spread.customData).toBeDefined();
      expect(getSceneVersion([spread])).toBe(getSceneVersion([before]));
    });

    it("反复开关都能 bump（每次都是新对象，不会被判为无变化）", () => {
      let el: ExcalidrawElement = flowArrow();
      const versions = [el.version];

      for (const enabled of [false, true, false]) {
        el = newElementWith(el, {
          customData: { flow: { enabled, speed: 40 } },
        } as any);
        versions.push(el.version);
      }

      // 严格递增
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i]!).toBeGreaterThan(versions[i - 1]!);
      }
    });
  });

  describe("serialize → restore 往返", () => {
    const roundTrip = (element: ExcalidrawElement) => {
      const json = serializeAsJSON([element], {}, {}, "local");
      const parsed = JSON.parse(json);

      return restore(parsed, null, null).elements[0]!;
    };

    it("customData.flow 扛得住一次往返", () => {
      const restored = roundTrip(flowArrow(85));

      expect(getElementFlow(restored)).toEqual({ enabled: true, speed: 85 });
    });

    it("关掉流动的状态同样被保留（不是靠字段缺失表达）", () => {
      const off = newElementWith(flowArrow(), {
        customData: { flow: { enabled: false, speed: 120 } },
      } as any);
      const restored = roundTrip(off);

      // 关闭态不流动，但速度记忆要留着，下次打开还是 120
      expect(getElementFlow(restored)).toBeNull();
      expect((restored.customData as any).flow.speed).toBe(120);
    });

    it("多次往返不衰减（存档反复打开保存）", () => {
      let el = flowArrow(65);

      for (let i = 0; i < 3; i++) {
        el = roundTrip(el);
      }

      expect(getElementFlow(el)).toEqual({ enabled: true, speed: 65 });
    });

    it("没配过流动的元素不会凭空长出 customData", () => {
      const plain = API.createElement({ type: "arrow", strokeStyle: "solid" });
      const restored = roundTrip(plain);

      expect(getElementFlow(restored)).toBeNull();
    });
  });
});
