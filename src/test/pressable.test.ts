import { describe, it, expect, vi } from "vitest";
import type { KeyboardEvent } from "react";
import { pressable } from "@/lib/pressable";

const key = (k: string, same = true) => {
  const target = {};
  return { key: k, target, currentTarget: same ? target : {}, preventDefault: vi.fn() } as unknown as KeyboardEvent<HTMLElement>;
};

describe("pressable", () => {
  it("activates on Enter and Space, like a button", () => {
    const fn = vi.fn();
    const p = pressable(fn);
    p.onKeyDown(key("Enter"));
    p.onKeyDown(key(" "));
    p.onKeyDown(key("a"));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(p.tabIndex).toBe(0);
    expect(p.role).toBe("button");
  });

  it("leaves keys on a nested control alone and can keep row semantics", () => {
    const fn = vi.fn();
    pressable(fn).onKeyDown(key("Enter", false));
    expect(fn).not.toHaveBeenCalled();
    expect(pressable(fn, { role: null }).role).toBeUndefined();
  });
});
