import { describe, expect, it } from "vitest";
import { badgeFor, emptyStatus, type Status } from "./status";

const ok = (patch: Partial<Status>): Status => ({ ...emptyStatus("ok"), ...patch });

describe("badgeFor", () => {
  it("OFF・動作中・倍速中・解析不可を区別する", () => {
    expect(badgeFor(emptyStatus("off")).text).toBe("OFF");
    expect(badgeFor(ok({ judgement: "speech", playbackRate: 1 })).text).toBe("ON");
    expect(badgeFor(ok({ judgement: "silent", playbackRate: 3 })).text).toBe("3x");
    expect(badgeFor(emptyStatus("unavailable", "音声トラックがありません"))).toMatchObject({
      text: "!",
      title: "hayame: 解析できません（音声トラックがありません）",
    });
    expect(badgeFor(emptyStatus("idle")).text).toBe("");
  });

  it("倍速中の速度は 4 文字に収める", () => {
    expect(badgeFor(ok({ judgement: "silent", playbackRate: 2.5 })).text).toBe("2.5x");
    expect(badgeFor(ok({ judgement: "silent", playbackRate: 2.75 })).text).toBe("2.75");
  });
});
