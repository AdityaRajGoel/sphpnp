/**
 * Schema-guided extraction from a page a selector-based scraper failed on.
 *
 * THE IDEA IS ScrapeGraphAI'S, THE IMPLEMENTATION IS NOT. That library is a
 * Python graph runner with its own LLM stack; nothing here runs Python. What
 * ports is the useful part: instead of encoding WHERE a value sits in the
 * markup, describe WHAT you want and let a model find it. A page restructure
 * breaks the first and usually survives the second.
 *
 * THIS IS A FALLBACK, NOT A SCRAPER. It runs only after the ordinary parse has
 * returned nothing, for three reasons that should survive any future tidying:
 * a model call costs real money and seconds where a selector costs neither; a
 * model will confabulate a plausible number where a selector returns nothing;
 * and a fallback that runs on every page hides the drift it exists to survive,
 * because the selectors stay broken and nobody finds out.
 *
 * Everything here is pure except `extractWithLlm`, which takes the model call
 * as an argument - so the prompt, the HTML reduction and the response
 * validation are all testable without a network or a key.
 */

export type FieldType = "string" | "number" | "date";

export type FieldSpec = {
  type: FieldType;
  /** Plain-language description. This is what the model actually matches on. */
  description: string;
};

export type ExtractionSchema = Record<string, FieldSpec>;

export type ExtractionResult = {
  values: Record<string, string | number | null>;
  /** Fields the model returned nothing usable for. */
  missing: string[];
};

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", ndash: "–", mdash: "—",
};

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (/^#x/i.test(name)) return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return String.fromCodePoint(Number(name.slice(1)));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/**
 * Markup reduced to the text a model should read.
 *
 * Scripts and styles go first and completely: a page's inline JSON payload can
 * be larger than its visible text, and feeding it to the model both costs more
 * and invites the model to answer from a stale blob rather than the rendered
 * figure. Table cells are joined with a pipe so a row survives as a row -
 * without it, a financial table collapses into a wall of unattached numbers
 * and the model has to guess which column each belongs to.
 */
export function htmlToText(html: string, maxLength = 24_000): string {
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(td|th)>\s*<(td|th)\b[^>]*>/gi, " | ")
    .replace(/<\/(tr|p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decode(text)
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n")
    .trim()
    .slice(0, maxLength);
}

/**
 * The prompt. Three instructions carry the weight, and all three exist because
 * of how models fail at this rather than as boilerplate:
 *
 *  - null for anything absent. Without it a model fills gaps with a plausible
 *    figure, which is the single worst outcome here: a wrong number is far more
 *    expensive than a missing one, because nothing downstream can tell.
 *  - values copied, not computed. Asked for a market cap it cannot find, a model
 *    will happily multiply a share count by a price and report the product.
 *  - JSON only, keys exactly as given, so the response is parseable without
 *    guessing at a wrapper.
 */
export function buildExtractionPrompt(schema: ExtractionSchema, text: string): string {
  const fields = Object.entries(schema)
    .map(([name, spec]) => `  "${name}": ${spec.type} - ${spec.description}`)
    .join("\n");

  return [
    "Extract the following fields from the page text below.",
    "",
    "Fields:",
    fields,
    "",
    "Rules:",
    "- Return ONLY a JSON object with exactly these keys, no prose and no code fences.",
    "- Copy values as they appear on the page. Do not calculate, convert or infer anything.",
    "- If a field is not present in the text, return null for it. Never guess a value.",
    "- For number fields, return a bare JSON number with no currency symbol, no commas and no unit.",
    "",
    "Page text:",
    text,
  ].join("\n");
}

/** Numbers arrive as "₹1,45,93,023", "12.4%" or "1234.5" depending on the model's mood. */
function coerceNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[₹$,\s%]/g, "").replace(/(cr\.?|crore|lakh|lacs?)$/i, "");
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** ISO-8601 only. A model's "12 Sep 2026" is not rejected out of pedantry - it is ambiguous across locales. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a model response against the schema.
 *
 * Returns null - not a partial result - when the response is not JSON at all,
 * which is the shape a refusal, a rate-limit message or a truncated reply takes.
 * A per-field miss is ordinary and lands in `missing`.
 */
export function parseExtraction(raw: string, schema: ExtractionSchema): ExtractionResult | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const candidate = (fenced ? fenced[1] : raw).trim();
  // A model that adds a sentence before the object is common enough to handle,
  // but only by finding the object - never by trusting the prose around it.
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const source = parsed as Record<string, unknown>;
  const values: Record<string, string | number | null> = {};
  const missing: string[] = [];

  for (const [name, spec] of Object.entries(schema)) {
    const value = source[name];
    // "null", "N/A" and "" are all how a model spells absent.
    if (value === null || value === undefined || value === "" ||
        (typeof value === "string" && /^(null|n\/?a|none|not (available|found|specified))$/i.test(value.trim()))) {
      values[name] = null;
      missing.push(name);
      continue;
    }

    if (spec.type === "number") {
      const numeric = coerceNumber(value);
      values[name] = numeric;
      if (numeric === null) missing.push(name);
      continue;
    }

    const text = typeof value === "string" ? value.trim() : String(value);
    if (spec.type === "date" && !ISO_DATE.test(text)) {
      values[name] = null;
      missing.push(name);
      continue;
    }
    values[name] = text;
  }

  return { values, missing };
}

export type Completer = (prompt: string) => Promise<string | null>;

/**
 * The whole fallback: reduce the page, ask, validate.
 *
 * Returns null when the model could not be reached or answered with something
 * that was not JSON - the caller then reports the original parse failure, which
 * is the honest outcome. A fallback that turns "we could not read the page"
 * into "we read it and found nothing" would be worse than having no fallback.
 */
export async function extractWithLlm(
  html: string,
  schema: ExtractionSchema,
  complete: Completer,
): Promise<ExtractionResult | null> {
  const text = htmlToText(html);
  // Nothing readable came back - a bot wall, an empty body, a redirect page.
  // There is no point paying for a model call to confirm it.
  if (text.length < 50) return null;

  let raw: string | null = null;
  try {
    raw = await complete(buildExtractionPrompt(schema, text));
  } catch (err) {
    console.error("llm extraction call failed:", (err as Error).message);
    return null;
  }
  if (!raw) return null;

  const result = parseExtraction(raw, schema);
  if (result === null) {
    console.error("llm extraction returned no parseable JSON");
    return null;
  }
  // Every field missing means the model read the page and found none of it,
  // which is a failed extraction rather than a page with empty fields.
  if (result.missing.length === Object.keys(schema).length) return null;
  return result;
}

/**
 * A Completer backed by Groq's OpenAI-compatible endpoint, trying each key in
 * turn - the same cascade shape ai-stock-analysis uses, because the free tier
 * rate-limits per key and a single key is a single point of failure.
 */
export function groqCompleter(apiKeys: string[], model: string, timeoutMs = 25_000): Completer {
  return async (prompt: string) => {
    for (const key of apiKeys.filter(Boolean)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: "You extract structured data from web pages. You return only JSON." },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
            // Deterministic: this is an extraction, not a composition, and a
            // page read twice should answer the same both times.
            temperature: 0,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          console.error(`groq extraction HTTP ${res.status}`);
          continue;
        }
        const json = await res.json();
        const content = json?.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim()) return content;
      } catch (err) {
        console.error("groq extraction attempt failed:", (err as Error).message);
      } finally {
        clearTimeout(timer);
      }
    }
    return null;
  };
}
