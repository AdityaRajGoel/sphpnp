import { describe, it, expect } from "vitest";
import {
  ROLES,
  buildRolePrompt,
  buildSynthesisPrompt,
  hasQuorum,
  type RoleOutput,
} from "../../supabase/functions/_shared/analysis-roles";

const facts = "## Stock Data\n| **CMP** | ₹1,257 |\n| **ROE** | N/A |";

describe("buildRolePrompt", () => {
  it("carries the facts and the role's own task", () => {
    const bull = buildRolePrompt("bull", facts);

    expect(bull).toContain("₹1,257");
    expect(bull).toContain("Bull case");
    expect(bull).toMatch(/strongest honest case FOR/);
  });

  it("tells each side not to hedge into balance", () => {
    // The whole point of separate passes: a bull pass that argues both sides
    // produces the same bland paragraph a single pass would.
    for (const role of ["bull", "bear"] as const) {
      expect(buildRolePrompt(role, facts)).toMatch(/do not hedge it into balance/i);
    }
  });

  it("repeats the N/A rule in every role", () => {
    // A role told to argue a side will reach for a number to argue with. This
    // is the failure that matters most, so it is restated per pass rather than
    // assumed from a system prompt.
    for (const role of ROLES) {
      const prompt = buildRolePrompt(role, facts);
      expect(prompt).toMatch(/N\/A was never retrieved/);
      expect(prompt).toMatch(/do not estimate it/i);
    }
  });

  it("forbids a recommendation in every role", () => {
    for (const role of ROLES) {
      expect(buildRolePrompt(role, facts)).toMatch(/no price targets, no buy\/sell\/hold call/i);
    }
  });

  it("asks the risk pass what the data cannot speak to", () => {
    expect(buildRolePrompt("risk", facts)).toMatch(/cannot speak to/i);
  });
});

describe("buildSynthesisPrompt", () => {
  const outputs: RoleOutput[] = [
    { role: "bull", text: "Delivery is rising and the balance sheet is net cash." },
    { role: "bear", text: "Profit growth has stalled for three quarters." },
    { role: "risk", text: "Promoter pledging is not disclosed in the data provided." },
  ];

  it("includes every role's argument under its own heading", () => {
    const prompt = buildSynthesisPrompt(facts, outputs);

    expect(prompt).toContain("Bull case");
    expect(prompt).toContain("Bear case");
    expect(prompt).toContain("Risk review");
    expect(prompt).toContain("Profit growth has stalled");
  });

  it("tells the synthesis not to split the difference", () => {
    // A synthesis that averages the cases throws away exactly what the extra
    // calls bought.
    expect(buildSynthesisPrompt(facts, outputs)).toMatch(/do not split the difference/i);
  });

  it("asks it to discount claims the data does not support", () => {
    expect(buildSynthesisPrompt(facts, outputs)).toMatch(/does not support, and discount it/i);
  });

  it("drops a role that returned nothing rather than leaving an empty heading", () => {
    const prompt = buildSynthesisPrompt(facts, [...outputs.slice(0, 2), { role: "risk", text: "   " }]);

    expect(prompt).not.toContain("Risk review");
    expect(prompt).toContain("Bull case");
  });

  it("still forbids a price target in the only output a reader sees", () => {
    expect(buildSynthesisPrompt(facts, outputs)).toMatch(/no price target/i);
  });
});

describe("hasQuorum", () => {
  const substantial = (role: RoleOutput["role"]): RoleOutput => ({
    role,
    text: "A substantial paragraph of argument that comfortably exceeds the minimum length.",
  });

  it("needs at least two substantial passes", () => {
    expect(hasQuorum([substantial("bull"), substantial("bear")])).toBe(true);
    expect(hasQuorum([substantial("bull"), substantial("bear"), substantial("risk")])).toBe(true);
  });

  it("refuses a single surviving pass", () => {
    // One argument synthesised alone would wear the authority of a balanced
    // review while being a restatement of one side.
    expect(hasQuorum([substantial("bull")])).toBe(false);
    expect(hasQuorum([substantial("bull"), { role: "bear", text: "" }])).toBe(false);
    expect(hasQuorum([substantial("bull"), { role: "bear", text: "Too short." }])).toBe(false);
  });

  it("refuses an empty debate", () => {
    expect(hasQuorum([])).toBe(false);
  });
});
