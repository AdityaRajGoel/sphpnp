/**
 * Role-specialised analysis passes, then a synthesis - the structure
 * TradingAgents demonstrates, applied to the facts this repo already gathers.
 *
 * WHY A SHAPE RATHER THAN A LIBRARY. TradingAgents is a Python framework with
 * its own agent runtime; none of it runs here. What is worth taking is its
 * finding that asking one model for "an analysis" produces a blandly balanced
 * paragraph, while asking separate passes to build the strongest case FOR, the
 * strongest case AGAINST, and the case that the whole thing is riskier than it
 * looks, then having a fourth pass weigh them, surfaces the disagreements a
 * single pass smooths over.
 *
 * THE ROLES ARE ADVERSARIAL BY CONSTRUCTION AND THE SYNTHESIS IS NOT. A bull
 * pass is explicitly told to argue one side; its output is an argument, not a
 * finding, and it is never shown to a reader on its own. Only the synthesis is
 * rendered, and it is instructed to report where the cases actually conflict
 * rather than to pick a winner.
 *
 * Pure string building - no I/O, no Deno APIs - so the prompts are testable.
 */

export type Role = "bull" | "bear" | "risk";

export const ROLES: Role[] = ["bull", "bear", "risk"];

type RoleSpec = { label: string; instruction: string };

const ROLE_SPECS: Record<Role, RoleSpec> = {
  bull: {
    label: "Bull case",
    instruction: [
      "Build the strongest honest case FOR this stock from the data above.",
      "Lead with the two or three facts that carry the most weight, and say why each matters.",
      "You are arguing one side deliberately. Do not hedge it into balance - another pass is arguing the other side.",
    ].join(" "),
  },
  bear: {
    label: "Bear case",
    instruction: [
      "Build the strongest honest case AGAINST this stock from the data above.",
      "Lead with the two or three facts that carry the most weight, and say why each matters.",
      "You are arguing one side deliberately. Do not hedge it into balance - another pass is arguing the other side.",
    ].join(" "),
  },
  risk: {
    label: "Risk review",
    instruction: [
      "Ignore whether this stock is attractive. Identify what would hurt a holder of it:",
      "leverage, earnings quality, concentration, liquidity, promoter pledging, regulatory action, and how far it can fall.",
      "Say plainly which risks the data above cannot speak to at all.",
    ].join(" "),
  },
};

/**
 * The instruction every pass carries.
 *
 * The N/A rule is repeated per role rather than stated once at the top because
 * it is the failure that matters most here: a role told to argue a side will
 * reach for a number to argue it with, and a model that fills an N/A with a
 * plausible figure produces a confident claim about a real listed company that
 * nothing downstream can catch.
 */
const SHARED_RULES = [
  "Rules for this pass:",
  "- Use only the data given. Any field marked N/A was never retrieved - do not estimate it, infer it, or write around it as though you had it.",
  "- Quote figures exactly as given. Do not compute derived ratios the data does not contain.",
  "- No price targets, no buy/sell/hold call, no allocation advice. This pass is an input to a research summary, not a recommendation.",
  "- Be specific and short. Six sentences at most.",
].join("\n");

/** One role's prompt over the shared facts block. */
export function buildRolePrompt(role: Role, facts: string): string {
  const spec = ROLE_SPECS[role];
  return [facts, "", `## Your task: ${spec.label}`, spec.instruction, "", SHARED_RULES].join("\n");
}

export type RoleOutput = { role: Role; text: string };

/**
 * The synthesis prompt.
 *
 * Told to weigh the cases rather than average them: the point of running three
 * passes is to find where they disagree, and a synthesis that splits the
 * difference throws away exactly what the extra calls bought. It is also the
 * only pass whose output a reader sees, so the disclaimers live here.
 */
export function buildSynthesisPrompt(facts: string, outputs: RoleOutput[]): string {
  const sections = outputs
    .filter((output) => output.text.trim().length > 0)
    .map((output) => `### ${ROLE_SPECS[output.role].label}\n${output.text.trim()}`)
    .join("\n\n");

  return [
    facts,
    "",
    "## Three analysts reviewed the data above independently",
    "",
    sections,
    "",
    "## Your task: the research summary",
    "Weigh these three against each other and the data. Specifically:",
    "- Say where they genuinely disagree and which side the data actually supports. Do not split the difference.",
    "- Name any claim a pass made that the data above does not support, and discount it.",
    "- State what would have to be true for the bull case to hold, and what would break it.",
    "- Finish with what a reader should watch next - events or figures, not a price.",
    "",
    "Rules:",
    "- Only the data given. N/A means never retrieved; say so rather than filling it in.",
    "- No price target, no buy/sell/hold call, no allocation advice.",
    "- This is a research summary for an Indian retail reader. Plain language, no jargon left unexplained.",
  ].join("\n");
}

/**
 * Whether the debate produced enough to synthesise.
 *
 * One surviving role is not a debate - if two of the three passes failed, the
 * synthesis would be a restatement of a single argument wearing the authority
 * of a balanced review, which is worse than falling back to the ordinary
 * single-pass report.
 */
export function hasQuorum(outputs: RoleOutput[]): boolean {
  return outputs.filter((output) => output.text.trim().length > 40).length >= 2;
}
