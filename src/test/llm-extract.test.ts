import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildExtractionPrompt,
  extractWithLlm,
  htmlToText,
  parseExtraction,
  type ExtractionSchema,
} from "../../supabase/functions/_shared/llm-extract";

/*
 * The property under test throughout: a model that cannot find something must
 * end up producing null, and a model that produces something unusable must end
 * up producing null too. A wrong number here is far more expensive than a
 * missing one, because nothing downstream can tell the difference.
 */

const schema: ExtractionSchema = {
  issue_size: { type: "number", description: "Total issue size in rupees crore" },
  open_date: { type: "date", description: "Issue opening date, ISO-8601" },
  registrar: { type: "string", description: "Name of the issue registrar" },
};

describe("htmlToText", () => {
  it("drops scripts and styles entirely", () => {
    // A page's inline JSON payload is routinely larger than its visible text,
    // and feeding it in invites the model to answer from a stale blob.
    const html = `<div>Issue size 69.93 Cr</div><script>var data={"issue_size":999}</script><style>.a{color:red}</style>`;

    const text = htmlToText(html);

    expect(text).toContain("69.93");
    expect(text).not.toContain("999");
    expect(text).not.toContain("color:red");
  });

  it("keeps table rows readable as rows", () => {
    // Without the pipe a financial table collapses into unattached numbers and
    // the model has to guess which column each belongs to.
    const html = "<table><tr><td>QIB</td><td>50.00%</td></tr><tr><td>Retail</td><td>35.00%</td></tr></table>";

    const text = htmlToText(html);

    expect(text).toContain("QIB | 50.00%");
    expect(text.split("\n").length).toBeGreaterThan(1);
  });

  it("decodes entities and collapses whitespace", () => {
    expect(htmlToText("<p>Fresh&nbsp;issue&amp;OFS   &#8377;500</p>")).toBe("Fresh issue&OFS ₹500");
  });

  it("truncates to the cap it was given", () => {
    expect(htmlToText(`<p>${"x".repeat(5000)}</p>`, 100)).toHaveLength(100);
  });
});

describe("buildExtractionPrompt", () => {
  it("names every field with its type and description", () => {
    const prompt = buildExtractionPrompt(schema, "page text here");

    for (const field of Object.keys(schema)) expect(prompt).toContain(field);
    expect(prompt).toContain("Total issue size in rupees crore");
    expect(prompt).toContain("page text here");
  });

  it("instructs the model not to invent or compute values", () => {
    // These two lines are the ones doing the work: without them a model fills
    // gaps with plausible figures and computes things it was not asked for.
    const prompt = buildExtractionPrompt(schema, "text");

    expect(prompt).toMatch(/never guess/i);
    expect(prompt).toMatch(/do not calculate/i);
  });
});

describe("parseExtraction", () => {
  it("reads a clean JSON response", () => {
    const result = parseExtraction('{"issue_size": 69.93, "open_date": "2026-09-18", "registrar": "Bigshare"}', schema)!;

    expect(result.values).toEqual({ issue_size: 69.93, open_date: "2026-09-18", registrar: "Bigshare" });
    expect(result.missing).toEqual([]);
  });

  it("survives code fences and a sentence of preamble", () => {
    const raw = 'Here is the data you asked for:\n```json\n{"issue_size": 69.93, "open_date": null, "registrar": "Bigshare"}\n```';

    const result = parseExtraction(raw, schema)!;

    expect(result.values.issue_size).toBe(69.93);
    expect(result.missing).toEqual(["open_date"]);
  });

  it("strips currency, commas and units from a number the model formatted", () => {
    const result = parseExtraction('{"issue_size": "₹1,45,93,023", "open_date": null, "registrar": null}', schema)!;

    expect(result.values.issue_size).toBe(14593023);
  });

  it("treats every spelling of absent as absent", () => {
    for (const absent of ["null", "N/A", "n/a", "None", "not available", ""]) {
      const result = parseExtraction(`{"registrar": ${JSON.stringify(absent)}}`, schema)!;
      expect(result.values.registrar).toBeNull();
      expect(result.missing).toContain("registrar");
    }
  });

  it("rejects a date that is not ISO-8601 rather than storing an ambiguous one", () => {
    // "09/12/2026" is September 12th or December 9th depending on where you
    // are. Guessing would silently shift an IPO's open date by three months.
    const result = parseExtraction('{"open_date": "09/12/2026", "issue_size": 1, "registrar": "X"}', schema)!;

    expect(result.values.open_date).toBeNull();
    expect(result.missing).toContain("open_date");
  });

  it("returns null when the response is not JSON at all", () => {
    // The shape a refusal, a rate-limit message or a truncated reply takes.
    expect(parseExtraction("I'm sorry, I cannot access that page.", schema)).toBeNull();
    expect(parseExtraction("", schema)).toBeNull();
    expect(parseExtraction('{"issue_size": ', schema)).toBeNull();
    expect(parseExtraction('["issue_size"]', schema)).toBeNull();
  });

  it("ignores keys the schema did not ask for", () => {
    const result = parseExtraction('{"issue_size": 10, "open_date": "2026-09-18", "registrar": "X", "extra": "ignored"}', schema)!;

    expect(Object.keys(result.values).sort()).toEqual(["issue_size", "open_date", "registrar"]);
  });
});

describe("extractWithLlm", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const page = "<div><p>Issue size 69.93 Cr</p><p>Opens 2026-09-18</p><p>Registrar Bigshare Services</p></div>";

  it("extracts from a page the selectors could not read", async () => {
    const complete = vi.fn().mockResolvedValue('{"issue_size": 69.93, "open_date": "2026-09-18", "registrar": "Bigshare Services"}');

    const result = (await extractWithLlm(page, schema, complete))!;

    expect(result.values.issue_size).toBe(69.93);
    expect(complete).toHaveBeenCalledOnce();
  });

  it("does not call the model when the page has no readable text", async () => {
    // A bot wall, an empty body or a redirect page. There is no point paying
    // for a call to confirm it.
    const complete = vi.fn();

    expect(await extractWithLlm("<html><body></body></html>", schema, complete)).toBeNull();
    expect(complete).not.toHaveBeenCalled();
  });

  it("returns null when the model found none of the fields", async () => {
    // "We read it and found nothing" is a different and more dangerous claim
    // than "we could not read it", so an all-null extraction is a failure.
    const complete = vi.fn().mockResolvedValue('{"issue_size": null, "open_date": null, "registrar": null}');

    expect(await extractWithLlm(page, schema, complete)).toBeNull();
  });

  it("returns null when the model is unreachable or answers with prose", async () => {
    expect(await extractWithLlm(page, schema, vi.fn().mockResolvedValue(null))).toBeNull();
    expect(await extractWithLlm(page, schema, vi.fn().mockResolvedValue("Sorry!"))).toBeNull();
    expect(await extractWithLlm(page, schema, vi.fn().mockRejectedValue(new Error("429")))).toBeNull();
  });

  it("keeps a partial extraction when at least one field came back", async () => {
    const complete = vi.fn().mockResolvedValue('{"issue_size": 69.93, "open_date": null, "registrar": null}');

    const result = (await extractWithLlm(page, schema, complete))!;

    expect(result.values.issue_size).toBe(69.93);
    expect(result.missing).toEqual(["open_date", "registrar"]);
  });
});
