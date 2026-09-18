import { describe, it, expect, beforeAll } from "vitest";
import { installDomMutationGuard } from "@/lib/dom-mutation-guard";

describe("installDomMutationGuard", () => {
  beforeAll(() => installDomMutationGuard());

  it("ignores removing a node that translation already moved elsewhere", () => {
    const parent = document.createElement("p");
    const text = document.createTextNode("Hello");
    parent.appendChild(text);
    const font = document.createElement("font");
    parent.replaceChild(font, text);
    font.appendChild(text);
    expect(() => parent.removeChild(text)).not.toThrow();
  });

  it("still removes a real child", () => {
    const parent = document.createElement("div");
    const child = parent.appendChild(document.createElement("span"));
    parent.removeChild(child);
    expect(parent.childNodes.length).toBe(0);
  });

  it("appends instead of throwing when the reference node was moved", () => {
    const parent = document.createElement("div");
    const moved = document.createElement("span");
    document.createElement("font").appendChild(moved);
    const added = document.createElement("b");
    expect(() => parent.insertBefore(added, moved)).not.toThrow();
    expect(parent.lastChild).toBe(added);
  });
});
