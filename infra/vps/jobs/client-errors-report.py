#!/usr/bin/env python3
"""Turn nginx's client-errors.log (JSON lines, newest last) into a readable report.

Reads log lines on stdin, newest first (admin-reports.sh pipes `tac`), and prints
one block per browser error: time, kind, page, message, source, a few stack frames
and the browser. Lines that are not valid reports are skipped.
"""
import json
import sys


def main() -> None:
    for line in sys.stdin:
        try:
            row = json.loads(line)
            report = json.loads(row.get("report") or "{}")
        except (ValueError, TypeError):
            continue
        # nginx also logs refused GETs and empty bodies; only real reports have a message.
        if not isinstance(report, dict) or not (report.get("message") or report.get("stack")):
            continue
        time = row.get("time", "")
        kind = report.get("kind", "?")
        page = report.get("page", "")
        print(f"{time}  {kind}  {page}")
        print(f"  {report.get('message', '')}")
        if report.get("source"):
            print(f"  at {report['source']}")
        frames = (report.get("stack") or "").strip().splitlines()[1:6]
        for frame in frames:
            print(f"    {frame.strip()}")
        print(f"  {str(row.get('ua', ''))[:120]}")
        print()


if __name__ == "__main__":
    main()
