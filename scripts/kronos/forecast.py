"""
Kronos forecasts for the most liquid tracked symbols, written to stock_forecasts.

WHAT THIS PRODUCES, AND WHAT IT DOES NOT. Kronos is a foundation model trained on
K-line sequences; given a window of daily bars it samples plausible continuations.
This script draws many independent continuations and stores the RANGE they span -
a 10th, 50th and 90th percentile per horizon - never a single number. That is a
deliberate framing choice, not a presentation detail: the model's own output is a
distribution, and collapsing it to one "target price" would state far more
certainty than the model has. Every surface that renders this must carry the
research disclaimer; see the `disclaimer` column and the UI panel.

Runs on CPU in GitHub Actions. Kronos-small is 24.7M parameters with a 512-bar
context, which is small enough that no GPU is needed for a weekly pass over a few
dozen symbols.

Inputs come from eq_eod (NSE, series EQ) via PostgREST; the service-role key is
supplied by the workflow and never leaves it.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import requests

# Kronos ships as source rather than a package, so the workflow clones it and
# puts the repo root on the path before this module is imported.
from model import Kronos, KronosPredictor, KronosTokenizer  # type: ignore

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
# The anon key reads the public market tables; the shared sync secret is what
# authorises the write, and it goes to an edge function that holds the
# service-role key. The service key itself never reaches this runner - see
# supabase/functions/ingest-forecasts/index.ts for why.
ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
SYNC_SECRET = os.environ["MARKET_SYNC_SECRET"]

TOKENIZER = os.environ.get("KRONOS_TOKENIZER", "NeoQuasar/Kronos-Tokenizer-base")
MODEL = os.environ.get("KRONOS_MODEL", "NeoQuasar/Kronos-small")

# Kronos-small's context is 512 bars; eq_eod holds about a year, so this takes
# whatever is there up to the limit.
MAX_CONTEXT = 512
LOOKBACK = int(os.environ.get("KRONOS_LOOKBACK", "400"))

# Sessions ahead. Two weeks is about as far as a daily model trained on noisy
# retail-heavy markets has any business being asked about.
PRED_LEN = int(os.environ.get("KRONOS_PRED_LEN", "10"))

# Independent draws per symbol. predict()'s own sample_count AVERAGES its samples
# internally and returns one path, which destroys exactly the spread this script
# exists to measure - so the draws are taken one at a time and collected here.
SAMPLES = int(os.environ.get("KRONOS_SAMPLES", "30"))

SYMBOL_LIMIT = int(os.environ.get("KRONOS_SYMBOLS", "50"))

# The same threshold price-analytics.ts refuses at, for the same reason: eq_eod
# closes are not adjusted for splits or bonuses, and a phantom -76% session fed
# to the model is a phantom -76% session learned from.
JUMP_THRESHOLD = 0.35

MIN_BARS = 120

HEADERS = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json",
}


def get(path: str, params: dict) -> list[dict]:
    response = requests.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS, params=params, timeout=60)
    response.raise_for_status()
    return response.json()


def universe() -> list[str]:
    """The most liquid tracked names. Market cap is the proxy - the model is
    least useful on thin counters, where a day's move is one block trade."""
    rows = get(
        "screener_stocks",
        {"select": "symbol,market_cap", "order": "market_cap.desc", "limit": str(SYMBOL_LIMIT)},
    )
    return [row["symbol"] for row in rows if row.get("symbol")]


def bars(symbol: str) -> pd.DataFrame | None:
    rows = get(
        "eq_eod",
        {
            "select": "trade_date,open,high,low,close,volume",
            "symbol": f"eq.{symbol}",
            "exchange": "eq.NSE",
            "series": "eq.EQ",
            "order": "trade_date.desc",
            "limit": str(LOOKBACK),
        },
    )
    if len(rows) < MIN_BARS:
        return None

    frame = pd.DataFrame(rows[::-1])
    frame["timestamps"] = pd.to_datetime(frame["trade_date"])
    for column in ("open", "high", "low", "close", "volume"):
        frame[column] = pd.to_numeric(frame[column], errors="coerce")

    frame = frame.dropna(subset=["open", "high", "low", "close"])
    if len(frame) < MIN_BARS:
        return None
    # Volume is optional to the model but must not be NaN if present.
    frame["volume"] = frame["volume"].fillna(0.0)
    return frame.tail(MAX_CONTEXT).reset_index(drop=True)


def has_unexplained_jump(frame: pd.DataFrame) -> bool:
    moves = frame["close"].pct_change().abs()
    return bool((moves >= JUMP_THRESHOLD).any())


def future_sessions(last: pd.Timestamp, count: int) -> pd.Series:
    """Weekday sessions after the last bar. Exchange holidays are not excluded -
    the model consumes these only as calendar features, and a wrong holiday
    shifts a feature rather than a price."""
    days: list[pd.Timestamp] = []
    cursor = last
    while len(days) < count:
        cursor = cursor + timedelta(days=1)
        if cursor.weekday() < 5:
            days.append(cursor)
    return pd.Series(days)


def forecast(predictor: KronosPredictor, frame: pd.DataFrame) -> dict | None:
    history = frame[["open", "high", "low", "close", "volume"]]
    x_timestamp = frame["timestamps"]
    y_timestamp = future_sessions(frame["timestamps"].iloc[-1], PRED_LEN)

    paths: list[np.ndarray] = []
    for _ in range(SAMPLES):
        try:
            predicted = predictor.predict(
                df=history,
                x_timestamp=x_timestamp,
                y_timestamp=y_timestamp,
                pred_len=PRED_LEN,
                T=1.0,
                top_p=0.9,
                sample_count=1,
                verbose=False,
            )
        except Exception as error:  # noqa: BLE001 - one bad draw must not end the pass
            print(f"    draw failed: {error}", file=sys.stderr)
            continue
        paths.append(np.asarray(predicted["close"], dtype=float))

    # A handful of draws is not a distribution. Refuse rather than publish a
    # range built from three samples.
    if len(paths) < max(10, SAMPLES // 3):
        return None

    stacked = np.vstack(paths)
    last_close = float(frame["close"].iloc[-1])
    p10, p50, p90 = (np.percentile(stacked, q, axis=0) for q in (10, 50, 90))

    return {
        "as_of": frame["trade_date"].iloc[-1],
        "last_close": last_close,
        "horizon_days": PRED_LEN,
        "samples": len(paths),
        "band_low": float(p10[-1]),
        "band_mid": float(p50[-1]),
        "band_high": float(p90[-1]),
        "band_low_pct": (float(p10[-1]) / last_close - 1) * 100,
        "band_mid_pct": (float(p50[-1]) / last_close - 1) * 100,
        "band_high_pct": (float(p90[-1]) / last_close - 1) * 100,
        # The whole path, so a chart can show the cone widening rather than just
        # its endpoint.
        "path": [
            {
                "session": index + 1,
                "date": y_timestamp.iloc[index].strftime("%Y-%m-%d"),
                "low": float(p10[index]),
                "mid": float(p50[index]),
                "high": float(p90[index]),
            }
            for index in range(PRED_LEN)
        ],
    }


def main() -> int:
    print(f"loading {MODEL} on CPU")
    tokenizer = KronosTokenizer.from_pretrained(TOKENIZER)
    model = Kronos.from_pretrained(MODEL)
    predictor = KronosPredictor(model, tokenizer, device="cpu", max_context=MAX_CONTEXT)

    symbols = universe()
    print(f"{len(symbols)} symbols")

    rows: list[dict] = []
    skipped_jump = 0
    skipped_thin = 0
    generated_at = datetime.utcnow().isoformat() + "Z"

    for symbol in symbols:
        frame = bars(symbol)
        if frame is None:
            skipped_thin += 1
            continue
        if has_unexplained_jump(frame):
            # Same refusal as the TypeScript analytics: an unadjusted split in
            # the window would be learned from as a real crash.
            print(f"  {symbol}: skipped, unadjusted price jump in window")
            skipped_jump += 1
            continue

        print(f"  {symbol}: {len(frame)} bars, {SAMPLES} draws")
        result = forecast(predictor, frame)
        if result is None:
            print(f"  {symbol}: too few usable draws")
            continue

        rows.append({"symbol": symbol, "model": MODEL, "generated_at": generated_at, **result})

    print(f"forecast {len(rows)} symbols, skipped {skipped_jump} for jumps and {skipped_thin} for thin history")
    if not rows:
        print("nothing to write", file=sys.stderr)
        return 1

    response = requests.post(
        f"{SUPABASE_URL}/functions/v1/ingest-forecasts",
        headers={**HEADERS, "x-sync-secret": SYNC_SECRET},
        json=rows,
        timeout=120,
    )
    if not response.ok:
        print(f"write failed: {response.status_code} {response.text}", file=sys.stderr)
        return 1

    # The function reports what it actually stored; rows it rejected as
    # malformed are a shape change here, not a transport failure, so they are
    # surfaced rather than assumed away by a 200.
    body = response.json()
    print(f"ingest accepted {body.get('written')} rows, rejected {body.get('rejected')}")
    if body.get("rejected"):
        print("some rows were rejected by validation", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
