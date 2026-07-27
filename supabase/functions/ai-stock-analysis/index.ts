/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cached AI reports are served for this long before recomputing.
const REPORT_CACHE_TTL_MS = 15 * 60 * 1000;
// Recompute early if the live price has drifted more than this from the
// cached report's price (keeps the verdict aligned with current price).
const REPORT_CACHE_PRICE_DRIFT = 0.02;

// Per-client rate limit: max requests per rolling window (protects LLM spend).
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// Report model is configurable via env (default: fast + cheap flash).
// Set REPORT_MODEL to "google/gemini-2.5-pro" for deeper reasoning (higher cost/latency).
const REPORT_MODEL = Deno.env.get("REPORT_MODEL") || "google/gemini-2.5-flash";
// Free open-weight models tried BEFORE the paid model (OpenRouter ":free" tier,
// zero cost). Order = preference. Overridable via FREE_REPORT_MODELS (comma-sep).
// If a free model returns malformed JSON or errors, the cascade silently moves
// on - the paid model remains the reliability backstop.
// Verified against OpenRouter's live :free catalogue — qwen3-next-80b and
// llama-3.3-70b:free were withdrawn ("This model is unavailable for free")
// and 404'd every attempt, wasting a cascade step each. These three were
// confirmed to return parseable JSON under response_format: json_object.
const FREE_REPORT_MODELS = (Deno.env.get("FREE_REPORT_MODELS") ??
  "nvidia/nemotron-3-super-120b-a12b:free,nvidia/nemotron-3-ultra-550b-a55b:free,openai/gpt-oss-20b:free")
  .split(",").map((s) => s.trim()).filter(Boolean);
// Per-attempt timeout for free models (they can be slower/oversubscribed).
const FREE_MODEL_TIMEOUT_MS = 22_000;
// Stop STARTING free-model attempts once this much of the 60s budget is spent
// (worst case: attempt starts just under the deadline and runs its full
// timeout, leaving the 12s minimum paid budget still inside the hard limit).
const FREE_TIER_DEADLINE_MS = 24_000;
// Free model tried first for Q&A chat (falls back to the paid chat model).
// llama-3.3-70b:free was withdrawn from OpenRouter's free tier, so every chat
// request paid a 404 before falling back. gpt-oss-20b:free is current and fast.
const FREE_CHAT_MODEL = Deno.env.get("FREE_CHAT_MODEL") ?? "openai/gpt-oss-20b:free";
// Groq free-tier models, tried in order (a decommissioned model 404s and the
// cascade just moves to the next one). Overridable via GROQ_MODELS (comma-sep).
const GROQ_MODELS = (Deno.env.get("GROQ_MODELS") ?? "llama-3.3-70b-versatile,openai/gpt-oss-120b")
  .split(",").map((s) => s.trim()).filter(Boolean);
// Cerebras free tier (fastest inference available). Optional: skipped entirely
// unless CEREBRAS_API_KEY is set as a Supabase secret.
const CEREBRAS_API_KEY = Deno.env.get("CEREBRAS_API_KEY");
// llama-3.3-70b was decommissioned on Cerebras and now 404s; gpt-oss-120b is
// current. Override via CEREBRAS_MODEL — /v1/models lists what your account has.
const CEREBRAS_MODEL = Deno.env.get("CEREBRAS_MODEL") ?? "gpt-oss-120b";
// Gemini-direct fallback model name (strip the "google/" prefix if present).
// Gemini-direct model ids, kept separate from REPORT_MODEL: that value is an
// OpenRouter model id and the two catalogs have diverged. gemini-2.5-flash is
// closed to newly-created Google projects ("no longer available to new users",
// 404) while OpenRouter still serves it, so deriving one from the other breaks
// the direct-Gemini fallback depending on which project issued the key.
// GEMINI_MODEL overrides; REPORT_MODEL is still honoured for back-compat.
const GEMINI_REPORT_MODEL = (Deno.env.get("GEMINI_MODEL") ?? Deno.env.get("REPORT_MODEL") ?? "gemini-3.5-flash").replace(/^google\//, "");
const GEMINI_CHAT_MODEL = Deno.env.get("GEMINI_CHAT_MODEL") ?? "gemini-3.5-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

// Multiple keys per provider multiply the free-tier quota: when one key is
// rate-limited or exhausted the cascade retries the same request on the next
// key before falling through to a slower provider. Order = preference.
// Unset names are dropped, so configuring only GROQ_API_KEY behaves as before.
const readKeys = (...names: string[]): string[] =>
  names.map((n) => Deno.env.get(n)?.trim()).filter((k): k is string => !!k);

const GROQ_API_KEYS = readKeys(
  "GROQ_API_KEY",
  "GROQ_API_KEY_SECOND",
  "GROQ_API_KEY_THIRD",
  "GROQ_API_KEY_FOURTH",
);
// "GEMENI_..." is a misspelling, but it is the name the secret is actually
// provisioned under in Supabase. Both spellings are read so the pool works
// either way and renaming the secret later needs no code change.
const GEMINI_API_KEYS = readKeys(
  "GEMINI_API_KEY",
  "GEMINI_API_KEY_SECOND",
  "GEMENI_API_KEY_SECOND",
);

// Retained for the "is this provider available?" checks in the cascade below.
const GROQ_API_KEY = GROQ_API_KEYS[0];
const GEMINI_API_KEY = GEMINI_API_KEYS[0];

// HTTP statuses where a DIFFERENT key can plausibly succeed: quota/rate limit,
// or a dead/revoked/unfunded key. Any other status is a request-level fault
// (bad model name, malformed body) that every key would hit identically, so we
// fail fast instead of burning the whole pool on it.
const KEY_ROTATION_STATUSES = new Set([401, 402, 403, 429]);

// Message-based rotation for failures whose status code lies about the cause:
//  - Gemini reports a revoked/invalid key as 400 API_KEY_INVALID, not 401.
//  - Gemini gates model access per Google project, returning 404 "no longer
//    available to new users" — so the SAME model can 404 on one key and serve
//    fine on another. That is key-specific, not a request-level fault.
const KEY_ROTATION_MESSAGES = [
  /api[_ ]key[_ ]invalid/i,
  /api key not valid/i,
  /no longer available to new users/i,
];

const shouldRotateKey = (error: unknown): boolean => {
  if (!(error instanceof ProviderHttpError)) return false;
  if (KEY_ROTATION_STATUSES.has(error.status)) return true;
  return KEY_ROTATION_MESSAGES.some((re) => re.test(error.message));
};

class ProviderHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ProviderHttpError";
    this.status = status;
  }
}

/**
 * Runs `attempt` against each key in turn, advancing only when the failure
 * looks key-specific. Throws the last error once the pool is exhausted.
 */
async function withKeyRotation<T>(
  provider: string,
  keys: string[],
  attempt: (key: string) => Promise<T>,
): Promise<T> {
  if (keys.length === 0) throw new Error(`${provider} API key not configured`);

  let lastError: unknown;
  for (let i = 0; i < keys.length; i++) {
    try {
      return await attempt(keys[i]);
    } catch (error) {
      lastError = error;
      const isLast = i === keys.length - 1;
      if (shouldRotateKey(error) && !isLast) {
        const status = error instanceof ProviderHttpError ? error.status : "?";
        console.warn(`${provider} key #${i + 1}/${keys.length} failed (${status}); rotating to key #${i + 2}`);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

const BOT_USER_AGENTS = [
  "googlebot", "bingbot", "yandexbot", "duckduckbot", "slurp", "baiduspider", "ia_archiver",
  "facebot", "facebookexternalhit", "twitterbot", "rogerbot", "linkedinbot", "embedly",
  "quora link preview", "showyoubot", "outbrain", "pinterest/0.", "developers.google.com/+/web/snippet",
  "slackbot", "vkShare", "W3C_Validator", "redditbot", "Applebot", "WhatsApp", "flipboard",
  "Tumblr", "bitlybot", "SkypeShell", "TelegramBot", "Skype", "node-fetch", "axios", "python-requests"
];

// ─────────────────────────────────────────────────────────────
// Timeout wrapper - abort any AI call that takes > 55s
// (Supabase edge functions have a 60s hard limit)
// ─────────────────────────────────────────────────────────────
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// ─────────────────────────────────────────────────────────────
// System prompts
// ─────────────────────────────────────────────────────────────
const CHAT_SYSTEM_PROMPT = `You are 'Parasram Intelligence', a seasoned Indian stock market expert at Parasram India - one of India's legacy brokerages (since 1970, SEBI registered).
Your tone should be friendly, confident, and professional - like a veteran NSE/BSE analyst talking to a client.
Use conversational markers like 'Looking at the charts...', 'In my view...', 'The data suggests...'.
AVOID robotic 'As an AI' boilerplate. Be direct, specific, and helpful. Use markdown for clarity.

IMPORTANT RULES:
- Always mention specific price levels, not vague terms
- When giving price targets, mention the timeframe and your reasoning
- When discussing risks, quantify them (e.g., "could see 5-8% downside if Nifty corrects")
- Reference Indian market specifics: NSE/BSE, SEBI regulations, FII/DII flows, RBI policy impact
- If asked about fundamentals you don't have, say "based on the available data" rather than making up numbers
- Be opinionated - clients want conviction, not hedging
- Keep responses concise but actionable (aim for 150-300 words)
- Never use em dashes (the long dash character). Use hyphens, commas, or colons instead.`;

const REPORT_SYSTEM_PROMPT = `You are an elite Indian stock market analyst for 'Parasram Intelligence' - the research desk of Parasram India, one of India's oldest brokerages (SEBI registered since 1970).

CRITICAL INSTRUCTION: Return your entire response as a single valid JSON object with exactly two keys: "markdown_report" and "structured_data".

THE markdown_report MUST:
- Use ### headers for each section
- Use markdown tables (| Col | Col |) for financial metrics - at least 2 tables
- CRITICAL FORMATTING: Do NOT output your markdown tables on a single line! You MUST use literal newline characters (\n) to separate every single row of the table.
- Use bullet points for pros/cons/risks - never long paragraphs
- Keep every paragraph to MAX 2 sentences
- Include specific ₹ price levels, not vague language
- Reference Indian market context (NSE, BSE, SEBI, FII/DII, RBI, Nifty, sectoral indices)
- Include a "### Financial Overview" table summarizing key metrics
- Include a "### Trade Setup" section with Entry, Stop-Loss, Target 1, Target 2, Risk-Reward ratio
- End with a "### Verdict" section with a clear BUY/SELL/HOLD/WATCH recommendation

JSON STRUCTURE:
{
  "markdown_report": "<rich markdown analysis as described above>",
  "structured_data": {
    "sentiment_score": <number 0-100>,
    "technical_signals": ["<4-6 specific signals like 'RSI at 62 - neutral zone' or 'Price above 200-DMA'>"],
    "bullish_signals": ["<3-5 specific positive factors with numbers>"],
    "bearish_signals": ["<3-5 specific risk factors with numbers>"],
    "action_verdict": "<exactly one of: BUY | SELL | HOLD | WATCH>",
    "insights": { "quality": <0-100>, "valuation": <0-100>, "growth": <0-100> },
    "key_indicators": {
      "RSI": "<value and interpretation, e.g. '58.3 - Neutral'>",
      "MACD": "<signal, e.g. 'Bullish crossover'>",
      "SMA_50": "<above/below CMP with distance>",
      "SMA_200": "<above/below CMP with distance>",
      "Beta": "<estimated value>",
      "ADX": "<value and trend strength>"
    },
    "sector_comparison": {
      "pe_avg": <sector avg PE number>,
      "roe_avg": <sector avg ROE number>,
      "valuation_status": "<e.g. '12% Premium to sector' or '8% Discount to peers'>"
    },
    "price_targets": {
      "support": <nearest strong support price>,
      "resistance": <nearest resistance price>,
      "target_1m": <1-month price target>,
      "target_3m": <3-month price target>
    },
    "momentum_score": <0-100>,
    "volume_signal": "<High | Normal | Low>"
  }
}

QUALITY RULES:
- Every number in structured_data must be a real number, not a string (except where strings are specified)
- price_targets must be realistic - derived from 52W range, not arbitrary percentages
- support should be BELOW current price, resistance ABOVE
- target_1m and target_3m should account for the current trend direction
- sentiment_score must align with action_verdict (BUY=60-90, HOLD=40-60, SELL=10-40)
- Provide at least 4 technical_signals, 3 bullish_signals, and 3 bearish_signals
- Never use em dashes (the long dash character) anywhere in the markdown_report. Use hyphens, commas, or colons instead.`;

// ─────────────────────────────────────────────────────────────
// Response validator - ensures structured_data has valid types
// ─────────────────────────────────────────────────────────────
function validateAndFixStructuredData(data: any): any {
  if (!data || typeof data !== 'object') return null;

  // Ensure numeric fields are actually numbers
  const numericFields = ['sentiment_score', 'momentum_score'];
  for (const field of numericFields) {
    if (typeof data[field] === 'string') data[field] = parseFloat(data[field]) || 50;
    if (typeof data[field] !== 'number') data[field] = 50;
  }

  // Validate insights
  if (data.insights) {
    for (const key of ['quality', 'valuation', 'growth']) {
      if (typeof data.insights[key] === 'string') data.insights[key] = parseFloat(data.insights[key]) || 50;
      if (typeof data.insights[key] !== 'number') data.insights[key] = 50;
    }
  }

  // Validate price_targets
  if (data.price_targets) {
    for (const key of ['support', 'resistance', 'target_1m', 'target_3m']) {
      if (typeof data.price_targets[key] === 'string') {
        data.price_targets[key] = parseFloat(data.price_targets[key].replace(/[₹,]/g, '')) || 0;
      }
      if (typeof data.price_targets[key] !== 'number') data.price_targets[key] = 0;
    }
  }

  // Validate sector_comparison
  if (data.sector_comparison) {
    for (const key of ['pe_avg', 'roe_avg']) {
      if (typeof data.sector_comparison[key] === 'string') {
        data.sector_comparison[key] = parseFloat(data.sector_comparison[key]) || 0;
      }
    }
  }

  // Ensure arrays exist
  if (!Array.isArray(data.technical_signals)) data.technical_signals = [];
  if (!Array.isArray(data.bullish_signals)) data.bullish_signals = [];
  if (!Array.isArray(data.bearish_signals)) data.bearish_signals = [];

  // Validate action_verdict
  const validVerdicts = ['BUY', 'SELL', 'HOLD', 'WATCH'];
  if (!validVerdicts.includes(data.action_verdict)) {
    data.action_verdict = data.sentiment_score > 60 ? 'BUY' : data.sentiment_score > 40 ? 'HOLD' : 'SELL';
  }

  // Validate volume_signal
  const validVolume = ['High', 'Normal', 'Low'];
  if (!validVolume.includes(data.volume_signal)) data.volume_signal = 'Normal';

  return data;
}

// ─────────────────────────────────────────────────────────────
// Provider 1: OpenRouter (Primary)
// ─────────────────────────────────────────────────────────────
async function askOpenRouter(prompt: string, isChat: boolean = false, modelOverride?: string) {
  if (!OPENROUTER_API_KEY) throw new Error("OpenRouter API key not configured");

  const systemMsg = isChat ? CHAT_SYSTEM_PROMPT : REPORT_SYSTEM_PROMPT;
  const model = modelOverride ?? (isChat
    ? "google/gemini-2.0-flash-lite-001"
    : REPORT_MODEL);
  // Free-tier models must produce parseable JSON or we fall through to the
  // next provider; the paid default is allowed to degrade to raw markdown.
  const strictJson = !isChat && !!modelOverride;

  const messages = [
    { role: "system", content: systemMsg },
    { role: "user", content: prompt + (isChat ? "" : "\n\nRespond with ONLY valid JSON. No text before or after the JSON object.") }
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://www.sphpnp.com",
      "X-Title": "Parasram Intelligence"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: isChat ? 0.35 : 0.1,
      max_tokens: isChat ? 1024 : 4096,
      ...(isChat ? {} : { response_format: { type: "json_object" } })
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("OpenRouter Error:", err);
    throw new Error(`OpenRouter API Error (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content;
  const usedModel = data.model || model;

  if (!content) throw new Error("Empty response from OpenRouter");

  if (!isChat) {
    try {
      const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      // A structurally useless report (no markdown) also counts as a failure
      // for strict free-tier attempts.
      if (strictJson && typeof parsed.markdown_report !== "string") {
        throw new Error("free model returned JSON without markdown_report");
      }
      // Validate structured data
      if (parsed.structured_data) {
        parsed.structured_data = validateAndFixStructuredData(parsed.structured_data);
      }
      content = parsed;
    } catch (e) {
      if (strictJson) throw new Error(`Malformed JSON from ${model}: ${e instanceof Error ? e.message : e}`);
      console.warn("OpenRouter JSON parse failed, wrapping:", e);
      content = { markdown_report: typeof content === 'string' ? content : "Report parsing error." };
    }
  }

  return { result: content, model: `${usedModel} (OpenRouter)` };
}

// ─────────────────────────────────────────────────────────────
// Provider 2: Groq (Fallback 1)
// ─────────────────────────────────────────────────────────────
async function askGroq(prompt: string, isChat: boolean = false, model = "llama-3.3-70b-versatile") {
  const systemMsg = isChat ? CHAT_SYSTEM_PROMPT : REPORT_SYSTEM_PROMPT;

  // Groq has a strict token limit - aggressively truncate
  const maxPromptLen = isChat ? 2000 : 4000;
  const truncatedPrompt = prompt.length > maxPromptLen
    ? prompt.slice(0, maxPromptLen) + "\n[Data truncated]"
    : prompt;

  const response = await withKeyRotation("Groq", GROQ_API_KEYS, async (apiKey) => {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: truncatedPrompt + (isChat ? "" : "\n\nRespond with ONLY valid JSON.") }
        ],
        response_format: { type: isChat ? "text" : "json_object" },
        temperature: 0.1,
        max_tokens: isChat ? 2000 : 6000
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new ProviderHttpError(`Groq API Error (${res.status}): ${err.slice(0, 100)}`, res.status);
    }
    return res;
  });

  const data = await response.json();
  let content = data.choices[0].message.content;

  if (!isChat) {
    try {
      const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.structured_data) {
        parsed.structured_data = validateAndFixStructuredData(parsed.structured_data);
      }
      content = parsed;
    } catch (e) {
      content = { markdown_report: typeof content === 'string' ? content : "Report parsing error." };
    }
  }

  return { result: content, model: `${model} (Groq)` };
}

// ─────────────────────────────────────────────────────────────
// Provider: Cerebras (free tier, fastest inference). OpenAI-compatible.
// Optional - skipped unless CEREBRAS_API_KEY is configured.
// ─────────────────────────────────────────────────────────────
async function askCerebras(prompt: string, isChat: boolean = false) {
  if (!CEREBRAS_API_KEY) throw new Error("Cerebras API key not configured");

  const systemMsg = isChat ? CHAT_SYSTEM_PROMPT : REPORT_SYSTEM_PROMPT;
  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CEREBRAS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CEREBRAS_MODEL,
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: prompt + (isChat ? "" : "\n\nRespond with ONLY valid JSON. No text before or after the JSON object.") },
      ],
      temperature: isChat ? 0.35 : 0.1,
      max_tokens: isChat ? 1024 : 6000,
      ...(isChat ? {} : { response_format: { type: "json_object" } }),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cerebras API Error (${response.status}): ${err.slice(0, 100)}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from Cerebras");

  if (!isChat) {
    try {
      const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.structured_data) {
        parsed.structured_data = validateAndFixStructuredData(parsed.structured_data);
      }
      content = parsed;
    } catch {
      content = { markdown_report: typeof content === "string" ? content : "Report parsing error." };
    }
  }

  return { result: content, model: `${CEREBRAS_MODEL} (Cerebras)` };
}

// ─────────────────────────────────────────────────────────────
// Provider 3: Gemini Direct (Fallback 2)
// ─────────────────────────────────────────────────────────────
async function askGemini(prompt: string, isChat: boolean = false, useWebSearch: boolean = false) {
  const systemMsg = isChat ? CHAT_SYSTEM_PROMPT : REPORT_SYSTEM_PROMPT;
  const geminiModel = isChat ? GEMINI_CHAT_MODEL : GEMINI_REPORT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;

  const bodyData: any = {
    system_instruction: { parts: { text: systemMsg } },
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 20000,
      // Gemini JSON mode combined with tools can sometimes conflict; 
      // but if supported, it stays. Otherwise text/plain.
      responseMimeType: isChat ? "text/plain" : "application/json"
    }
  };

  if (useWebSearch) {
    bodyData.tools = [{ googleSearch: {} }];
  }

  const response = await withKeyRotation("Gemini", GEMINI_API_KEYS, async (apiKey) => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": apiKey
      },
      body: JSON.stringify(bodyData)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new ProviderHttpError(`Gemini API Error (${res.status}): ${err.slice(0, 100)}`, res.status);
    }
    return res;
  });

  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");

  if (!isChat) {
    try {
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.structured_data) {
        parsed.structured_data = validateAndFixStructuredData(parsed.structured_data);
      }
      text = parsed;
    } catch (e) {
      text = { markdown_report: typeof text === 'string' ? text : "Report parsing error." };
    }
  }

  return { result: text, model: geminiModel };
}

// ─────────────────────────────────────────────────────────────
// Real historical data from Yahoo Finance
// ─────────────────────────────────────────────────────────────
async function fetchHistoricalData(symbol: string) {
  try {
    let ySymbol = symbol;
    if (!symbol.includes('.') && !symbol.startsWith('^') && !symbol.includes('=')) {
      ySymbol = `${symbol}.NS`;
    }
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?range=1y&interval=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const q = result.indicators?.quote?.[0] || {};
    // Align OHLCV row-by-row (keep only days where close is present) so
    // candlestick patterns compare matching open/high/low/close values.
    const opens: number[] = [], highs: number[] = [], lows: number[] = [], closes: number[] = [], volumes: number[] = [];
    const rawClose = q.close || [];
    for (let i = 0; i < rawClose.length; i++) {
      if (rawClose[i] == null) continue;
      closes.push(rawClose[i]);
      opens.push(q.open?.[i] ?? rawClose[i]);
      highs.push(q.high?.[i] ?? rawClose[i]);
      lows.push(q.low?.[i] ?? rawClose[i]);
      volumes.push(q.volume?.[i] ?? 0);
    }
    if (closes.length < 20) return null;
    return { opens, closes, highs, lows, volumes };
  } catch { return null; }
}

// ── Real candlestick pattern detection on the most recent 1-2 candles ──
function detectCandlestickPatterns(opens: number[], highs: number[], lows: number[], closes: number[]): string[] {
  const n = closes.length;
  if (n < 2) return [];
  const patterns: string[] = [];
  const o = opens[n - 1], h = highs[n - 1], l = lows[n - 1], c = closes[n - 1];
  const po = opens[n - 2], pc = closes[n - 2];
  const body = Math.abs(c - o);
  const range = h - l || 1e-9;
  const upperWick = h - Math.max(o, c);
  const lowerWick = Math.min(o, c) - l;

  // Doji — very small body relative to range
  if (body / range < 0.1) patterns.push("Doji");
  // Hammer — small body near top, long lower wick (bullish reversal)
  if (body / range < 0.35 && lowerWick > body * 2 && upperWick < body) patterns.push("Hammer");
  // Shooting Star — small body near bottom, long upper wick (bearish reversal)
  if (body / range < 0.35 && upperWick > body * 2 && lowerWick < body) patterns.push("Shooting Star");
  // Marubozu — full body, tiny wicks (strong conviction)
  if (body / range > 0.9) patterns.push(c > o ? "Bullish Marubozu" : "Bearish Marubozu");
  // Engulfing — current body engulfs previous body
  if (c > o && pc < po && c >= po && o <= pc) patterns.push("Bullish Engulfing");
  if (c < o && pc > po && o >= pc && c <= po) patterns.push("Bearish Engulfing");

  return [...new Set(patterns)].slice(0, 3);
}

// ─────────────────────────────────────────────────────────────
// Real fundamentals + Wall Street analyst consensus
// (Yahoo quoteSummary - crumb-gated; fails gracefully → null)
// ─────────────────────────────────────────────────────────────
const YAHOO_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
let _crumbCache: { crumb: string; cookie: string; ts: number } | null = null;

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  try {
    if (_crumbCache && Date.now() - _crumbCache.ts < 30 * 60 * 1000) {
      return { crumb: _crumbCache.crumb, cookie: _crumbCache.cookie };
    }
    const cookieRes = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": YAHOO_UA } });
    const cookie = (cookieRes.headers.get("set-cookie") || "").split(";")[0];
    if (!cookie) return null;
    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": YAHOO_UA, "Cookie": cookie },
    });
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.includes("<") || crumb.length > 40) return null;
    _crumbCache = { crumb, cookie, ts: Date.now() };
    return { crumb, cookie };
  } catch { return null; }
}

async function fetchYahooFundamentals(symbol: string) {
  try {
    let ySymbol = symbol;
    if (!symbol.includes('.') && !symbol.startsWith('^') && !symbol.includes('=')) ySymbol = `${symbol}.NS`;
    const cc = await getYahooCrumb();
    const modules = "financialData,defaultKeyStatistics,summaryDetail";
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySymbol)}?modules=${modules}${cc ? `&crumb=${encodeURIComponent(cc.crumb)}` : ""}`;
    const res = await fetch(url, { headers: { "User-Agent": YAHOO_UA, ...(cc ? { Cookie: cc.cookie } : {}) } });
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.quoteSummary?.result?.[0];
    if (!r) return null;
    const fd = r.financialData || {}, ks = r.defaultKeyStatistics || {}, sd = r.summaryDetail || {};
    const n = (x: any) => (typeof x?.raw === "number" ? x.raw : null);
    const pct = (x: any) => { const v = n(x); return v != null ? +(v * 100).toFixed(1) : null; };
    return {
      roe: pct(fd.returnOnEquity),
      debtToEquity: n(fd.debtToEquity) != null ? +(n(fd.debtToEquity)! / 100).toFixed(2) : null,
      profitMargin: pct(fd.profitMargins),
      revenueGrowth: pct(fd.revenueGrowth),
      earningsGrowth: pct(fd.earningsGrowth),
      trailingPE: n(sd.trailingPE),
      forwardPE: n(ks.forwardPE),
      pegRatio: n(ks.pegRatio),
      beta: n(ks.beta) ?? n(sd.beta),
      dividendYield: pct(sd.dividendYield),
      analystRecMean: n(fd.recommendationMean),   // 1 = Strong Buy … 5 = Sell
      analystRecKey: fd.recommendationKey || null,
      targetMean: n(fd.targetMeanPrice),
      targetHigh: n(fd.targetHighPrice),
      targetLow: n(fd.targetLowPrice),
      numAnalysts: n(fd.numberOfAnalystOpinions),
    };
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────
// Recent per-symbol news headlines (Yahoo Finance search endpoint).
// Crumb-free; fails soft -> [] so a news outage never blocks a report.
// ─────────────────────────────────────────────────────────────
type NewsHeadline = { title: string; publisher: string; ageDays: number | null; link: string };

// Strips tags to a fixed point (not just one pass) so a malformed/nested
// fragment like "<<script>script>" can't leave a live tag behind after a
// single regex sweep.
function stripTags(s: string): string {
  let prev: string;
  let out = s;
  do {
    prev = out;
    out = out.replace(/<[^>]+>/g, "");
  } while (out !== prev);
  return out;
}

function decodeEntities(s: string): string {
  // Decode entities before stripping tags, so an entity-encoded "<script>" can't
  // survive the tag strip and reappear as a live tag. "&amp;" is decoded last so
  // a double-encoded entity (e.g. "&amp;lt;") isn't unescaped twice in one pass.
  const decoded = s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, "&");
  return stripTags(decoded).trim();
}

// Recent per-symbol news headlines via Google News RSS (India edition).
// A quoted company-name search (e.g. "Reliance Industries") on the IN edition
// returns genuinely company-specific Indian-market news - earnings, broker
// calls, regulatory actions - which Yahoo's US-centric feed does not. Fails
// soft to [] so a news outage never blocks a report.
async function fetchStockNews(symbol: string, rawName?: string): Promise<NewsHeadline[]> {
  const name = String(rawName || "").replace(/[.,]/g, " ").trim() || symbol;
  try {
    const q = `"${name}" (stock OR shares OR results OR NSE) when:35d`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;
    const res = await fetch(url, { headers: { "User-Agent": YAHOO_UA } });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10);
    const now = Date.now();
    const seen = new Set<string>();
    const out: NewsHeadline[] = [];
    for (const [, block] of items) {
      const rawTitle = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
      const source = decodeEntities(block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "");
      let title = decodeEntities(rawTitle);
      // Google News appends " - <Source>" to titles; strip it.
      if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)).trim();
      if (!title) continue;
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const pub = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
      const ts = pub ? Date.parse(pub) : NaN;
      const ageDays = Number.isNaN(ts) ? null : Math.floor((now - ts) / 86_400_000);
      if (ageDays != null && ageDays > 45) continue;
      const link = decodeEntities(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
      out.push({
        title,
        publisher: source,
        ageDays,
        link: /^https?:\/\//.test(link) ? link : "",
      });
      if (out.length >= 6) break;
    }
    return out;
  } catch { return []; }
}

// ── Real Technical Indicator Calculations ──
function _calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema = [data[0]];
  for (let i = 1; i < data.length; i++) ema.push(data[i] * k + ema[i - 1] * (1 - k));
  return ema;
}

function realRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  return +(100 - 100 / (1 + rs)).toFixed(1);
}

function realSMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;
  return +(data.slice(-period).reduce((a, b) => a + b, 0) / period).toFixed(2);
}

function realMACD(closes: number[]) {
  if (closes.length < 26) return { value: 0, signal: 0, histogram: 0, trend: "Insufficient data" };
  const ema12 = _calcEMA(closes, 12);
  const ema26 = _calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const sigLine = _calcEMA(macdLine.slice(-35), 9);
  const m = macdLine[macdLine.length - 1];
  const s = sigLine[sigLine.length - 1];
  const h = m - s;
  const prevH = macdLine[macdLine.length - 2] - sigLine[sigLine.length - 2];
  let trend = "Neutral";
  if (h > 0 && prevH <= 0) trend = "Bullish Crossover";
  else if (h < 0 && prevH >= 0) trend = "Bearish Crossover";
  else if (h > 0) trend = "Bullish - Above Signal";
  else trend = "Bearish - Below Signal";
  return { value: +m.toFixed(2), signal: +s.toFixed(2), histogram: +h.toFixed(2), trend };
}

function realADX(highs: number[], lows: number[], closes: number[], period = 14): number {
  const len = Math.min(highs.length, lows.length, closes.length);
  if (len < period + 1) return 25;
  let sumDX = 0, count = 0;
  for (let i = len - period; i < len; i++) {
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    const pDM = Math.max(0, highs[i] - highs[i - 1]);
    const mDM = Math.max(0, lows[i - 1] - lows[i]);
    if (tr > 0) { const s = (pDM / tr) * 100 + (mDM / tr) * 100; if (s > 0) { sumDX += Math.abs((pDM / tr) * 100 - (mDM / tr) * 100) / s * 100; count++; } }
  }
  return count > 0 ? +((sumDX / count).toFixed(1)) : 25;
}

function avgVolume(volumes: number[], period = 20): number {
  if (volumes.length < period) return volumes.reduce((a, b) => a + b, 0) / (volumes.length || 1);
  return volumes.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function realATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  const len = Math.min(highs.length, lows.length, closes.length);
  if (len < period + 1) return 0;
  let sum = 0;
  for (let i = len - period; i < len; i++) {
    sum += Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  }
  return +(sum / period).toFixed(2);
}

const _clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// ─────────────────────────────────────────────────────────────
// Deterministic quant engine - grounds the rating/verdict/targets
// in REAL data so they are consistent & defensible (not LLM-invented).
// ─────────────────────────────────────────────────────────────
function computeQuant(s: any, f: any) {
  // ── Technical sub-score (always available from 1Y daily OHLCV) ──
  let tech = 50;
  if (s.price > s.sma200) tech += 8; else tech -= 8;
  if (s.price > s.sma50) tech += 6; else tech -= 6;
  if (s.price > s.sma20) tech += 4; else tech -= 4;
  tech += s.sma50 > s.sma200 ? 5 : -3;                 // golden / death cross alignment
  const rsi = s.rsiVal;
  if (rsi >= 45 && rsi <= 65) tech += 6;                // healthy momentum band
  else if (rsi > 70) tech -= 6;                         // overbought
  else if (rsi > 65) tech += 2;
  else if (rsi < 30) tech -= 2;                         // oversold (mild - may bounce)
  if (/Bullish Crossover/i.test(s.macd.trend)) tech += 8;
  else if (/Bullish/i.test(s.macd.trend)) tech += 4;
  else if (/Bearish Crossover/i.test(s.macd.trend)) tech -= 8;
  else if (/Bearish/i.test(s.macd.trend)) tech -= 4;
  const dir = tech >= 50 ? 1 : -1;
  if (s.adxVal > 25) tech += dir * Math.min(8, (s.adxVal - 25) / 3); // strong trend amplifies direction
  tech += (s.pos52w - 50) * 0.10;                       // 52W positioning context
  if (/High/i.test(s.volSignal)) tech += s.changePct >= 0 ? 3 : -3; // volume confirmation
  tech = _clamp(tech);

  // ── Fundamental sub-score (only when real data available) ──
  let fund = 50; let fundAvail = false;
  if (f) {
    fundAvail = true;
    if (f.roe != null) fund += _clamp((f.roe - s.secROE) * 1.2, -12, 15);
    if (f.debtToEquity != null && !s.isFinancial)
      fund += f.debtToEquity < s.secDE ? 8 : -Math.min(12, (f.debtToEquity - s.secDE) * 6);
    const pe = f.trailingPE ?? s.pe;
    if (pe && pe > 0) fund += _clamp((s.secPE - pe) / s.secPE * 20, -12, 12);
    if (f.earningsGrowth != null) fund += _clamp(f.earningsGrowth * 0.4, -10, 12);
    if (f.revenueGrowth != null) fund += _clamp(f.revenueGrowth * 0.3, -6, 8);
    if (f.pegRatio != null && f.pegRatio > 0) fund += f.pegRatio < 1 ? 6 : f.pegRatio > 2 ? -6 : 0;
    fund = _clamp(fund);
  }

  // ── Analyst consensus overlay (recMean 1..5 → 100..0) ──
  let analyst: number | null = null;
  if (f?.analystRecMean != null && f.numAnalysts > 0) analyst = _clamp((5 - f.analystRecMean) / 4 * 100);

  // ── Composite (weights shift by data availability) ──
  let composite: number;
  if (fundAvail && analyst != null) composite = tech * 0.45 + fund * 0.30 + analyst * 0.25;
  else if (fundAvail) composite = tech * 0.6 + fund * 0.4;
  else composite = tech;
  composite = Math.round(_clamp(composite));

  const rating_label = composite >= 68 ? "BUY" : composite >= 55 ? "ACCUMULATE"
    : composite >= 45 ? "HOLD" : composite >= 32 ? "REDUCE" : "SELL";
  const verdictUI = composite >= 62 ? "BUY" : composite >= 45 ? "HOLD" : composite <= 32 ? "SELL" : "WATCH";

  // ── Confidence: trend strength + data breadth + tech/fundamental agreement ──
  let confidence = 55;
  if (s.adxVal > 25) confidence += 10;
  if (fundAvail) confidence += 10;
  if (analyst != null) confidence += 10;
  if (fundAvail) confidence += Math.abs(tech - fund) < 15 ? 8 : -5;
  confidence = Math.round(_clamp(confidence, 30, 95));

  const insights = {
    quality: Math.round(_clamp(fundAvail ? (f.roe ?? s.secROE) * 2 + (f.profitMargin ?? 10) : 50 + (s.price > s.sma200 ? 15 : -15))),
    valuation: Math.round(_clamp(fundAvail ? ((s.secPE - (f.trailingPE ?? s.pe ?? s.secPE)) / s.secPE) * 40 + 50 : 60 - (s.pos52w - 50) * 0.4)),
    growth: Math.round(_clamp(fundAvail ? 50 + (f.earningsGrowth ?? 0) * 0.8 + (f.revenueGrowth ?? 0) * 0.5 : 50 + s.changePct * 3)),
  };
  const momentum_score = Math.round(_clamp(50 + (rsi - 50) * 0.6 + (s.pos52w - 50) * 0.3 + (/Bullish/i.test(s.macd.trend) ? 10 : -10)));

  return {
    tech: Math.round(tech), fund: Math.round(fund), analyst: analyst != null ? Math.round(analyst) : null,
    composite, rating_label, verdictUI, confidence, insights, momentum_score, fundAvail,
  };
}

// ATR-based targets, anchored to analyst consensus when available
function computeTargets(s: any, atr: number, f: any, verdictUI: string) {
  const price = s.price;
  const a = atr > 0 ? atr : price * 0.03;
  const bull = verdictUI === "BUY", bear = verdictUI === "SELL";
  let target_1m = bull ? price + 2 * a : bear ? price - 2 * a : price + a * 0.5;
  let target_3m = bull ? price + 4 * a : bear ? price - 4 * a : price + a;
  if (f?.targetMean && f.numAnalysts > 0) {
    target_3m = (target_3m + f.targetMean) / 2;
    target_1m = (target_1m + (price + (f.targetMean - price) * 0.4)) / 2;
  }
  return {
    support: Math.round(s.nearestSupport),
    resistance: Math.round(s.nearestResistance),
    target_1m: Math.round(target_1m),
    target_3m: Math.round(target_3m),
    atr: a,
  };
}

// ─────────────────────────────────────────────────────────────
// Enrich stock data - uses REAL historical data when available
// ─────────────────────────────────────────────────────────────
async function enrichStockData(raw: any, opts: { withFundamentals?: boolean; withNews?: boolean } = {}) {
  const price = parseFloat(String(raw.price).replace(/[₹,]/g, '')) || 0;
  const high52 = raw.high_52 || price * 1.15;
  const low52 = raw.low_52 || price * 0.85;
  const range52 = high52 - low52;
  const pos52w = range52 > 0 ? Math.round(((price - low52) / range52) * 100) : 50;

  const dayHigh = raw.day_high || price;
  const dayLow = raw.day_low || price;
  const dayRange = dayHigh - dayLow;
  const dayPos = dayRange > 0 ? Math.round(((price - dayLow) / dayRange) * 100) : 50;

  const changePct = parseFloat(raw.change_pct) || 0;
  const prevClose = raw.prev_close || (price / (1 + changePct / 100));
  const openPrice = raw.open_price || prevClose;

  const gapVsPrevClose = prevClose > 0 ? ((price - prevClose) / prevClose * 100).toFixed(2) : "0";
  const gapVsOpen = openPrice > 0 ? ((price - openPrice) / openPrice * 100).toFixed(2) : "0";

  const vol = raw.volume || 0;
  const volInMillions = vol > 0 ? (vol / 1_000_000).toFixed(2) : "N/A";

  const mcap = raw.market_cap || 0;
  const mcapTier = mcap > 100000 ? "Large Cap" : mcap > 20000 ? "Mid Cap" : mcap > 5000 ? "Small Cap" : "Micro Cap";

  // ── Fetch REAL historical data + fundamentals + recent news in parallel ──
  const [hist, fundamentals, newsItems] = await Promise.all([
    fetchHistoricalData(raw.symbol),
    opts.withFundamentals ? fetchYahooFundamentals(raw.symbol) : Promise.resolve(null),
    opts.withNews ? fetchStockNews(raw.symbol, raw.name) : Promise.resolve([] as NewsHeadline[]),
  ]);
  let rsiVal = 50, rsiSignal = "N/A";
  let sma20 = 0, sma50 = 0, sma200 = 0;
  let macd = { value: 0, signal: 0, histogram: 0, trend: "N/A" };
  let adxVal = 25;
  let volAvg20 = 0, volSignal = "Normal";
  let atr = 0;
  let detectedPatterns: string[] = [];
  let dataSource = "Approximated";

  if (hist) {
    dataSource = "Real (Yahoo Finance 1Y Daily)";
    const { closes, highs, lows, volumes } = hist;
    detectedPatterns = detectCandlestickPatterns(hist.opens, highs, lows, closes);
    rsiVal = realRSI(closes);
    rsiSignal = rsiVal > 70 ? "Overbought" : rsiVal < 30 ? "Oversold" : rsiVal > 60 ? "Mildly Bullish" : rsiVal < 40 ? "Mildly Bearish" : "Neutral";
    sma20 = realSMA(closes, 20);
    sma50 = realSMA(closes, 50);
    sma200 = closes.length >= 200 ? realSMA(closes, 200) : realSMA(closes, Math.min(closes.length, 100));
    macd = realMACD(closes);
    adxVal = realADX(highs, lows, closes);
    atr = realATR(highs, lows, closes);
    volAvg20 = avgVolume(volumes, 20);
    const volRatio = volAvg20 > 0 ? vol / volAvg20 : 1;
    volSignal = volRatio > 1.5 ? "High (abnormal)" : volRatio < 0.6 ? "Low (quiet)" : "Normal";
  } else {
    // Fallback approximations only when Yahoo is unreachable
    rsiVal = Math.max(15, Math.min(85, Math.round(50 + changePct * 2 + (pos52w - 50) / 2)));
    rsiSignal = rsiVal > 70 ? "Overbought" : rsiVal < 30 ? "Oversold" : "Neutral";
    sma20 = Math.round(price * (1 - changePct / 100 * 0.3));
    sma50 = Math.round(price * (1 - (pos52w - 50) / 100 * 0.12));
    sma200 = Math.round(low52 + range52 * 0.50);
    macd = { value: 0, signal: 0, histogram: 0, trend: changePct > 1 ? "Slightly Bullish" : changePct < -1 ? "Slightly Bearish" : "Neutral" };
  }

  // Sector averages
  const sStr = String(raw.sector || "").toUpperCase() + " " + String(raw.name || "").toUpperCase() + " " + String(raw.symbol || "").toUpperCase();
  const isFin = sStr.includes("FINAN") || sStr.includes("BANK") || sStr.includes("NBFC");
  const isTech = sStr.includes("IT") || sStr.includes("TECH") || sStr.includes("SOFTWARE");
  const isEnergy = sStr.includes("ENERGY") || sStr.includes("OIL") || sStr.includes("GAS") || sStr.includes("POWER");
  const isFMCG = sStr.includes("FMCG") || sStr.includes("CONSUMER");
  const isPharma = sStr.includes("PHARMA") || sStr.includes("HEALTH") || sStr.includes("MEDICAL");
  const isAuto = sStr.includes("AUTO");
  const isMetal = sStr.includes("METAL") || sStr.includes("STEEL");
  let secPE = 22, secROE = 15, secDE = 0.4;
  if (isFin) { secPE = 18; secROE = 14; secDE = 4.0; }
  else if (isTech) { secPE = 30; secROE = 22; secDE = 0.1; }
  else if (isFMCG) { secPE = 45; secROE = 25; secDE = 0.2; }
  else if (isPharma) { secPE = 35; secROE = 18; secDE = 0.3; }
  else if (isAuto) { secPE = 25; secROE = 16; secDE = 0.5; }
  else if (isMetal) { secPE = 12; secROE = 12; secDE = 1.0; }
  else if (isEnergy) { secPE = 15; secROE = 12; secDE = 0.8; }

  // Fibonacci levels from 52W
  const fib382 = Math.round(high52 - range52 * 0.382);
  const fib618 = Math.round(high52 - range52 * 0.618);
  const fibLevels = [low52, high52 - range52 * 0.786, fib618, high52 - range52 * 0.5, fib382, high52 - range52 * 0.236, high52].sort((a, b) => a - b);
  let nearestSupport = low52, nearestResistance = high52;
  for (const l of fibLevels) { if (l < price) nearestSupport = l; }
  for (let i = fibLevels.length - 1; i >= 0; i--) { if (fibLevels[i] > price) nearestResistance = fibLevels[i]; }
  if (nearestSupport >= price) nearestSupport = price * 0.95;
  if (nearestResistance <= price) nearestResistance = price * 1.05;

  const base = {
    ...raw, price, high52, low52, pos52w,
    dayHigh, dayLow, dayPos, prevClose, openPrice,
    gapVsPrevClose, gapVsOpen, vol, volInMillions,
    mcap, mcapTier, changePct, dataSource,
    rsiVal, rsiSignal,
    macd, adxVal, volSignal, atr,
    sma20, sma50, sma200,
    secPE, secROE, secDE,
    nearestSupport: Math.round(nearestSupport),
    nearestResistance: Math.round(nearestResistance),
    fib382, fib618,
    isFinancial: isFin,
    // Real detected candlestick patterns (overrides the empty client value)
    patterns: detectedPatterns.length > 0 ? detectedPatterns : (raw.patterns || []),
    // Prefer REAL fundamentals from Yahoo; fall back to whatever the client sent
    roe: fundamentals?.roe ?? raw.roe ?? null,
    debt_equity: fundamentals?.debtToEquity ?? raw.debt_equity ?? null,
    fundamentals,
    newsItems,
  };

  // Deterministic quant engine - authoritative score/verdict/targets
  const quant = computeQuant(base, fundamentals);
  const targets = computeTargets(base, atr, fundamentals, quant.verdictUI);

  return { ...base, quant, targets };
}

// ─────────────────────────────────────────────────────────────
// Build the analysis prompt
// ─────────────────────────────────────────────────────────────
function buildAnalysisPrompt(s: any): string {
  return `Analyze this LIVE NSE/BSE stock for an Indian retail investor:

**Data Source: ${s.dataSource}**

## Stock Data
| Metric | Value |
|--------|-------|
| **Name** | ${s.name} (${s.symbol}) |
| **Sector** | ${s.sector || "N/A"} |
| **Market Cap** | ₹${s.mcap ? s.mcap.toLocaleString('en-IN') + ' Cr' : 'N/A'} (${s.mcapTier}) |
| **CMP** | ₹${s.price.toLocaleString('en-IN')} |
| **Day Change** | ${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}% |
| **Open** | ₹${s.openPrice} |
| **Prev Close** | ₹${s.prevClose} |
| **Gap vs Prev Close** | ${s.gapVsPrevClose}% |
| **Gap vs Open** | ${s.gapVsOpen}% |
| **Day Range** | ₹${s.dayLow} – ₹${s.dayHigh} (Currently at ${s.dayPos}% of range) |
| **52W High** | ₹${s.high52} |
| **52W Low** | ₹${s.low52} |
| **52W Position** | ${s.pos52w}% (0%=at Low, 100%=at High) |
| **P/E Ratio** | ${s.pe || "N/A"} |
| **Volume** | ${s.volInMillions}M shares |
| **Volume Signal** | ${s.volSignal} |
| **ROE** | ${s.roe || "N/A"} |
| **Debt/Equity** | ${s.debt_equity || "N/A"} |

## Fundamental Comparison
| Metric | Stock Value | Sector/Peer Avg |
|--------|-------------|-----------------|
| **P/E Ratio** | ${s.pe || "N/A"} | ${s.secPE} |
| **ROE** | ${s.roe ? s.roe + "%" : "N/A"} | ${s.secROE}% |
| **Debt/Equity** | ${s.debt_equity || "N/A"} | ${s.secDE} |

## Technical Indicators (Computed from Real 1Y Daily Data)
| Indicator | Value |
|-----------|-------|
| **RSI (14)** | ${s.rsiVal} (${s.rsiSignal}) |
| **MACD** | Value: ${s.macd.value}, Signal: ${s.macd.signal}, Histogram: ${s.macd.histogram} - ${s.macd.trend} |
| **ADX (14)** | ${s.adxVal} (${s.adxVal > 25 ? 'Strong Trend' : 'Weak/Range-bound'}) |
| **SMA 20** | ₹${s.sma20} (Price is ${s.price > s.sma20 ? 'Above ✅' : 'Below ❌'}) |
| **SMA 50** | ₹${s.sma50} (Price is ${s.price > s.sma50 ? 'Above ✅' : 'Below ❌'}) |
| **SMA 200** | ₹${s.sma200} (Price is ${s.price > s.sma200 ? 'Above ✅' : 'Below ❌'}) |
| **Fibonacci 38.2%** | ₹${s.fib382} |
| **Fibonacci 61.8%** | ₹${s.fib618} |
| **Support** | ₹${s.nearestSupport} |
| **Resistance** | ₹${s.nearestResistance} |
| **ATR (14)** | ₹${s.atr} (volatility) |
| **Detected Pattern** | ${s.patterns?.join(', ') || "N/A"} |
| **Momentum** | ${s.isBullish ? "Bullish" : "Bearish"} |

${s.fundamentals ? `## Real Fundamentals (Yahoo Finance)
| Metric | Value |
|--------|-------|
| **ROE** | ${s.fundamentals.roe ?? "N/A"}% |
| **Debt/Equity** | ${s.fundamentals.debtToEquity ?? "N/A"} |
| **Profit Margin** | ${s.fundamentals.profitMargin ?? "N/A"}% |
| **Revenue Growth (YoY)** | ${s.fundamentals.revenueGrowth ?? "N/A"}% |
| **Earnings Growth (YoY)** | ${s.fundamentals.earningsGrowth ?? "N/A"}% |
| **Trailing P/E** | ${s.fundamentals.trailingPE ?? "N/A"} |
| **Forward P/E** | ${s.fundamentals.forwardPE ?? "N/A"} |
| **PEG** | ${s.fundamentals.pegRatio ?? "N/A"} |
| **Beta** | ${s.fundamentals.beta ?? "N/A"} |
| **Dividend Yield** | ${s.fundamentals.dividendYield ?? "N/A"}% |` : "## Fundamentals\nReal fundamentals unavailable - base your assessment on technicals, valuation (P/E) and price action."}

${s.fundamentals?.numAnalysts ? `## Wall Street Analyst Consensus (${s.fundamentals.numAnalysts} analysts)
- Recommendation: **${(s.fundamentals.analystRecKey || "N/A").toUpperCase()}** (mean ${s.fundamentals.analystRecMean}/5 - 1=Strong Buy, 5=Sell)
- Price Targets → Mean ₹${s.fundamentals.targetMean ?? "N/A"} · High ₹${s.fundamentals.targetHigh ?? "N/A"} · Low ₹${s.fundamentals.targetLow ?? "N/A"}` : ""}

${s.newsItems && s.newsItems.length > 0 ? `## 📰 Recent News & Events (Yahoo Finance, last ~45 days)
${s.newsItems.map((n: NewsHeadline) => `- ${n.ageDays != null ? `${n.ageDays}d ago` : "recent"}: ${n.title}${n.publisher ? ` (${n.publisher})` : ""}`).join("\n")}

Factor these headlines into your Executive Summary, Risk Factors and Verdict reasoning. If any headline signals a material event (quarterly result, regulatory/SEBI action, management change, rating downgrade/upgrade, large order win/loss, M&A, fraud/probe), call it out explicitly and let it shape your conviction and the risk section. A materially negative event MUST appear as a key risk and should temper conviction; a strong positive catalyst should be noted as support. Do NOT let a single headline override the QUANT ENGINE score below, but your narrative verdict must acknowledge the news backdrop.` : "## 📰 Recent News\nNo recent headlines retrieved - base the verdict on price action, technicals and fundamentals."}

## ⚙️ QUANT ENGINE OUTPUT - AUTHORITATIVE (computed deterministically from the real data above)
- **Composite Score: ${s.quant.composite}/100** - Technical ${s.quant.tech} · Fundamental ${s.quant.fundAvail ? s.quant.fund : "N/A"} · Analyst ${s.quant.analyst ?? "N/A"}
- **Rating: ${s.quant.rating_label}** → Verdict: **${s.quant.verdictUI}** · Confidence ${s.quant.confidence}%
- **Computed levels** → Support ₹${s.targets.support} · Resistance ₹${s.targets.resistance} · 1M Target ₹${s.targets.target_1m} · 3M Target ₹${s.targets.target_3m}

⚠️ CRITICAL: The QUANT ENGINE score, rating, verdict and price targets above are computed from real market data and are AUTHORITATIVE. Your report MUST explain and justify these numbers. Do NOT invent a different verdict, score, or targets that contradict them. Build your Trade Setup around the computed support/resistance/targets.

Provide a comprehensive professional analysis. The markdown_report must include:
1. **Executive Summary** - 2-line verdict with conviction level
2. **Financial Overview** - table of key metrics with sector comparison
3. **Price Action & Volume** - gap analysis, intraday positioning (${s.dayPos}% of day range), volume assessment (${s.volSignal})
4. **Technical Analysis** - RSI (${s.rsiVal}), MACD (${s.macd.trend}), ADX (${s.adxVal}), key moving averages (SMA 20: ₹${s.sma20}, SMA 50: ₹${s.sma50}, SMA 200: ₹${s.sma200}), support ₹${s.nearestSupport} / resistance ₹${s.nearestResistance}
5. **Fundamental Assessment** - P/E vs Sector Avg (${s.secPE}), ROE quality vs peers (${s.secROE}%), debt health vs peers (${s.secDE}), ${s.mcapTier} considerations
6. **Risk Factors** - 3 specific risks with estimated % impact
7. **Trade Setup** - table with Entry Zone, Stop-Loss, Target 1, Target 2, Risk-Reward Ratio
8. **Verdict** - final BUY/SELL/HOLD/WATCH call with timeframe

For structured_data price_targets: support ≈ ₹${s.nearestSupport}, resistance ≈ ₹${s.nearestResistance}. Calculate realistic target_1m and target_3m from these levels.`;
}

function buildChatPrompt(s: any, context: string, chatHistory: any[], chatMessage: string): string {
  let prompt = `## Stock Context
${context}

`;

  // Include the AI report context if available
  if (s.ai_report_summary) {
    prompt += `## Previous AI Analysis Summary\n${s.ai_report_summary}\n\n`;
  }

  if (chatHistory && chatHistory.length > 0) {
    prompt += `## Conversation History
${chatHistory.map((m: any) => `**${m.role === 'user' ? 'CLIENT' : 'ANALYST'}:** ${m.text}`).join('\n\n')}

`;
  }

  prompt += `## Client's Question
${chatMessage}

Provide a direct, actionable answer. Reference specific price levels and data from the context above.`;
  return prompt;
}

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userAgent = req.headers.get("user-agent")?.toLowerCase() || "";
  if (BOT_USER_AGENTS.some(bot => userAgent.includes(bot))) {
    return new Response(JSON.stringify({ success: false, error: "Bot access denied." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const payload = await req.json();
    const { is_chat, chat_message, chat_history, context, use_web_search, committee, ...stockData } = payload;
    const committeeMode = !!committee && !is_chat;

    // Supabase client (service role) for the report cache
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const currentPrice = parseFloat(String(stockData.price).replace(/[₹,]/g, "")) || 0;

    // ── Per-client rate limit (fails OPEN if the RPC/table isn't available,
    //    so a DB hiccup never blocks all users) ──
    try {
      const clientId =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "anon";
      const bucket = `ai:${clientId}`;
      const { data: allowed, error: rlError } = await sb.rpc("check_ai_rate_limit", {
        p_bucket: bucket,
        p_max: RATE_LIMIT_MAX,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      });
      if (!rlError && allowed === false) {
        console.warn(`Rate limit exceeded for ${clientId}`);
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS) } },
        );
      }
    } catch (e) {
      console.warn("Rate limit check failed (non-fatal):", e instanceof Error ? e.message : e);
    }

    // Committee and plain reports cache under separate keys ("SYM#committee"
    // vs "SYM") so each mode stays fresh without clobbering the other.
    const cacheKey = committeeMode ? `${stockData.symbol}#committee` : stockData.symbol;

    // ── Serve a fresh cached report if one exists and the price hasn't
    //    drifted materially. One computation serves every viewer for the TTL. ──
    if (!is_chat && stockData.symbol) {
      try {
        const { data: cached } = await sb
          .from("ai_stock_reports")
          .select("report, model, price, created_at")
          .eq("symbol", cacheKey)
          .gte("created_at", new Date(Date.now() - REPORT_CACHE_TTL_MS).toISOString())
          .maybeSingle();
        if (cached) {
          const drift = cached.price > 0 ? Math.abs(currentPrice - cached.price) / cached.price : 1;
          if (drift <= REPORT_CACHE_PRICE_DRIFT) {
            const ageS = Math.round((Date.now() - new Date(cached.created_at).getTime()) / 1000);
            console.log(`✓ Cache hit ${stockData.symbol} (age ${ageS}s, drift ${(drift * 100).toFixed(1)}%)`);
            return new Response(
              JSON.stringify({ success: true, verdict: cached.report, model: cached.model, cached: true }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
      } catch (e) {
        console.warn("Cache read failed (non-fatal):", e instanceof Error ? e.message : e);
      }
    }

    // Enrich stock data with REAL historical indicators from Yahoo Finance
    const enriched = await enrichStockData(stockData, { withFundamentals: !is_chat, withNews: !is_chat });
    let finalPrompt = "";

    if (is_chat) {
      console.log(`[AI Chat] ${stockData.symbol || 'unknown'}: "${chat_message?.slice(0, 50)}..."`);
      finalPrompt = buildChatPrompt(enriched, context || "", chat_history, chat_message);
    } else {
      console.log(`[AI Report] ${stockData.symbol} @ ₹${enriched.price} (${enriched.changePct}%) | Data: ${enriched.dataSource} | RSI: ${enriched.rsiVal} | MACD: ${enriched.macd.trend}`);
      finalPrompt = buildAnalysisPrompt(enriched);
    }

    let result;
    const errors: string[] = [];
    const committeeMembers: { model: string; verdict: string | null; conviction: number | null }[] = [];
    const webSearchEnabled = !!use_web_search;

    if (webSearchEnabled) {
      // If Web Search is explicitly requested, skip to Gemini directly, as it supports Google Grounding
      console.log(`→ Web Search Requested. Routing natively to Gemini with Google Grounding...`);
      if (!GEMINI_API_KEY) throw new Error("Web search requested but Gemini API key is missing.");
      try {
        result = await withTimeout(askGemini(finalPrompt, !!is_chat, true), 35000, "GeminiWeb");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("✗ GeminiWeb:", msg);
        errors.push(`Gemini Web Search Error: ${msg}`);
      }
    } else {
      // Standard cascade: free open-weight models → paid OpenRouter → Groq → Cerebras → Gemini
      const cascadeStart = Date.now();

      // ── Committee mode (opt-in "Deep"): multiple free models in parallel,
      //    each also giving an INDEPENDENT verdict. Members are drawn from
      //    EVERY available free provider (OpenRouter free tier, Groq,
      //    Cerebras) so the committee still convenes when one provider is
      //    down. Falls back to the normal cascade when nobody responds. ──
      if (committeeMode) {
        const committeePrompt = finalPrompt + `\n\nADDITIONALLY: in structured_data include "independent_verdict" (exactly one of BUY | SELL | HOLD | WATCH) - YOUR OWN independent judgement from the raw market data above, which MAY differ from the quant engine - and "independent_conviction" (a number 0-100). Everything else must still respect the quant engine as instructed.`;
        const candidates: { name: string; run: () => Promise<{ result: unknown; model: string }> }[] = [];
        if (OPENROUTER_API_KEY && FREE_REPORT_MODELS[0]) {
          const m = FREE_REPORT_MODELS[0];
          candidates.push({ name: m, run: () => askOpenRouter(committeePrompt, false, m) });
        }
        if (GROQ_API_KEY) {
          // Most capable / most distinct Groq model first for diversity...
          const gm = GROQ_MODELS[GROQ_MODELS.length - 1] ?? "llama-3.3-70b-versatile";
          candidates.push({ name: `groq:${gm}`, run: () => askGroq(committeePrompt, false, gm) });
          // ...but also field the known-good workhorse so the committee still
          // convenes if the capable model is decommissioned/unavailable.
          const g0 = GROQ_MODELS[0];
          if (g0 && g0 !== gm) {
            candidates.push({ name: `groq:${g0}`, run: () => askGroq(committeePrompt, false, g0) });
          }
        }
        if (CEREBRAS_API_KEY) {
          candidates.push({ name: `cerebras:${CEREBRAS_MODEL}`, run: () => askCerebras(committeePrompt, false) });
        }
        const chosen = candidates.slice(0, 4);
        console.log(`→ Committee: ${chosen.map((c) => c.name).join(" + ")} in parallel...`);
        const settled = await Promise.allSettled(
          chosen.map((c) => withTimeout(c.run(), FREE_MODEL_TIMEOUT_MS, c.name)),
        );
        for (const s of settled) {
          if (s.status !== "fulfilled") {
            const msg = s.reason instanceof Error ? s.reason.message : String(s.reason);
            errors.push(`committee: ${msg.slice(0, 120)}`);
            continue;
          }
          const sd = (s.value.result as any)?.structured_data ?? {};
          committeeMembers.push({
            model: s.value.model,
            verdict: typeof sd.independent_verdict === "string" ? sd.independent_verdict.toUpperCase() : null,
            conviction: typeof sd.independent_conviction === "number" ? Math.round(sd.independent_conviction) : null,
          });
          if (!result) result = s.value; // first fulfilled member authors the report
        }
        console.log(`Committee members responded: ${committeeMembers.length}/${chosen.length}`);
      }

      // ── Free tier (reports AND chat) ──
      if (!result && OPENROUTER_API_KEY) {
        const freeModels = is_chat ? [FREE_CHAT_MODEL] : FREE_REPORT_MODELS;
        for (const freeModel of freeModels) {
          if (Date.now() - cascadeStart > FREE_TIER_DEADLINE_MS) {
            console.warn("Free-tier deadline reached; moving to paid model");
            break;
          }
          try {
            console.log(`→ OpenRouter FREE (${freeModel})...`);
            result = await withTimeout(askOpenRouter(finalPrompt, !!is_chat, freeModel), FREE_MODEL_TIMEOUT_MS, freeModel);
            break;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(`✗ ${freeModel}:`, msg);
            errors.push(`${freeModel}: ${msg.slice(0, 120)}`);
          }
        }
      }

      if (!result && OPENROUTER_API_KEY) {
        try {
          // Stay inside the 60s edge-function limit even after free-tier attempts.
          const remaining = Math.max(12_000, 52_000 - (Date.now() - cascadeStart));
          console.log(`→ OpenRouter (${REPORT_MODEL}, ${Math.round(remaining / 1000)}s budget)...`);
          result = await withTimeout(askOpenRouter(finalPrompt, !!is_chat), remaining, "OpenRouter");
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("✗ OpenRouter:", msg);
          errors.push(`OpenRouter: ${msg}`);
        }
      }

      if (!result && GROQ_API_KEY) {
        for (const groqModel of GROQ_MODELS) {
          try {
            console.log(`→ Groq (${groqModel})...`);
            result = await withTimeout(askGroq(finalPrompt, !!is_chat, groqModel), 20000, `Groq:${groqModel}`);
            break;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(`✗ Groq ${groqModel}:`, msg);
            errors.push(`Groq ${groqModel}: ${msg.slice(0, 120)}`);
          }
        }
      }

      if (!result && CEREBRAS_API_KEY) {
        try {
          console.log(`→ Cerebras (${CEREBRAS_MODEL})...`);
          result = await withTimeout(askCerebras(finalPrompt, !!is_chat), 20000, "Cerebras");
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn("✗ Cerebras:", msg);
          errors.push(`Cerebras: ${msg.slice(0, 120)}`);
        }
      }

      // Gemini fallback - ensures at least one provider can respond
      if (!result && GEMINI_API_KEY) {
        try {
          console.log("→ Gemini Direct (fallback)...");
          result = await withTimeout(askGemini(finalPrompt, !!is_chat, false), 35000, "GeminiDirect");
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("✗ Gemini Direct:", msg);
          errors.push(`Gemini: ${msg}`);
        }
      }
    }

    if (!result) {
      throw new Error(`All AI providers failed. ${errors.join(' | ')}`);
    }

    // ── Reconcile: override LLM-invented numbers with the deterministic
    //    quant engine so the displayed rating/verdict/targets are grounded
    //    in real data and consistent across runs. The LLM keeps ownership of
    //    the narrative, signal lists and indicator commentary. ──
    if (!is_chat && result.result && typeof result.result === "object") {
      const q = enriched.quant;
      const t = enriched.targets;
      const f = enriched.fundamentals;
      const sd = validateAndFixStructuredData((result.result as any).structured_data || {}) || {};

      sd.sentiment_score = q.composite;
      sd.action_verdict = q.verdictUI;
      sd.rating_label = q.rating_label;
      sd.confidence = q.confidence;
      sd.momentum_score = q.momentum_score;
      sd.insights = q.insights;
      sd.score_breakdown = { technical: q.tech, fundamental: q.fundAvail ? q.fund : null, analyst: q.analyst };
      sd.price_targets = { support: t.support, resistance: t.resistance, target_1m: t.target_1m, target_3m: t.target_3m };
      sd.volume_signal = /High/i.test(enriched.volSignal) ? "High" : /Low/i.test(enriched.volSignal) ? "Low" : "Normal";
      sd.sector_comparison = {
        pe_avg: enriched.secPE,
        roe_avg: enriched.secROE,
        valuation_status: (() => {
          const pe = f?.trailingPE ?? enriched.pe;
          if (!pe || !enriched.secPE) return "In-line with sector";
          const d = (pe - enriched.secPE) / enriched.secPE * 100;
          return d > 8 ? `${Math.round(d)}% Premium to sector` : d < -8 ? `${Math.round(-d)}% Discount to peers` : "In-line with sector";
        })(),
      };
      if (f?.numAnalysts > 0) {
        sd.analyst_consensus = {
          rating: f.analystRecKey, mean: f.analystRecMean, count: f.numAnalysts,
          target_mean: f.targetMean, target_high: f.targetHigh, target_low: f.targetLow,
        };
      }
      sd.data_source = enriched.dataSource;
      sd.detected_patterns = enriched.patterns || [];
      sd.news_headlines = (enriched.newsItems || []).map((n: NewsHeadline) => ({
        title: n.title, publisher: n.publisher, ageDays: n.ageDays, link: n.link,
      }));
      // Committee overlay: each member's independent verdict vs the quant engine.
      if (committeeMembers.length > 0) {
        const verdicts = committeeMembers.map((m) => m.verdict).filter((v): v is string => !!v);
        const allAgreeQuant = verdicts.length > 0 && verdicts.every((v) => v === q.verdictUI);
        const membersAgree = verdicts.length > 1 && verdicts.every((v) => v === verdicts[0]);
        const agreement = allAgreeQuant
          ? "Unanimous"
          : membersAgree
          ? "Models diverge from quant"
          : verdicts.length <= 1
          ? "Partial"
          : "Split";
        sd.committee = { members: committeeMembers, quant_verdict: q.verdictUI, agreement };
      }
      (result.result as any).structured_data = sd;
    }

    console.log(`✓ Analysis served by ${result.model}${webSearchEnabled ? ' [Web Grounded]' : ''} | Verdict ${enriched.quant?.verdictUI} (${enriched.quant?.composite}/100)`);

    // Persist to cache so subsequent viewers of this symbol are served instantly
    if (!is_chat && stockData.symbol && result.result && typeof result.result === "object") {
      try {
        await sb.from("ai_stock_reports").upsert({
          symbol: cacheKey,
          report: result.result,
          model: result.model,
          price: enriched.price ?? currentPrice,
          created_at: new Date().toISOString(),
        }, { onConflict: "symbol" });
      } catch (e) {
        console.warn("Cache write failed (non-fatal):", e instanceof Error ? e.message : e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        verdict: result.result,
        model: result.model,
        // Self-diagnosis for committee runs: which members were fielded and
        // why any failed. Also proves which code version is deployed.
        ...(committeeMode
          ? { committee_debug: { members_responded: committeeMembers.length, errors: errors.slice(0, 6) } }
          : {}),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
