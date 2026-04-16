from __future__ import annotations

import csv
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
INDEX_HTML = ROOT / "index.html"

LEGACY_DATA_IDS = {
    "taiex": "taiex-data",
}

YAHOO_SERIES = {
    "vt": "VT",
    "vti": "VTI",
    "ewj": "EWJ",
    "ewy": "EWY",
    "ews": "EWS",
    "ewh": "EWH",
    "tsmc_tw": "2330.TW",
}


def iso_date_from_timestamp(timestamp: int) -> str:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%Y-%m-%d")


def read_legacy_series(series_id: str) -> list[tuple[str, float]]:
    if not INDEX_HTML.exists():
        raise FileNotFoundError(f"Cannot find legacy source: {INDEX_HTML}")

    text = INDEX_HTML.read_text(encoding="utf-8")
    pattern = re.compile(
        rf'<script id="{re.escape(series_id)}" type="text/plain">\s*(.*?)\s*</script>',
        re.DOTALL,
    )
    match = pattern.search(text)
    if not match:
        raise RuntimeError(f"Cannot find legacy series block: {series_id}")

    rows: list[tuple[str, float]] = []
    reader = csv.reader(match.group(1).strip().splitlines())

    for row in reader:
        if len(row) < 2:
            continue

        date = row[0].strip().strip('"')
        value_raw = row[1].strip().strip('"')

        if date.lower() == "date" or value_raw.lower() in {"value", "adjclose"}:
            continue

        try:
            value = float(value_raw)
        except ValueError:
            continue

        rows.append((date, value))

    rows.sort(key=lambda item: item[0])
    return rows


def read_csv_series(path: Path) -> list[tuple[str, float]]:
    rows: list[tuple[str, float]] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        for row in reader:
            if len(row) < 2:
                continue

            date = row[0].strip().strip('"')
            value_raw = row[1].strip().strip('"')

            if date.lower() == "date" or value_raw.lower() in {"value", "adjclose"}:
                continue

            try:
                value = float(value_raw)
            except ValueError:
                continue

            rows.append((date, value))

    rows.sort(key=lambda item: item[0])
    return rows


def fetch_yahoo_series(symbol: str) -> list[tuple[str, float]]:
    now_ts = int(datetime.now(tz=timezone.utc).timestamp())
    query = urllib.parse.urlencode(
        {
            "period1": "0",
            "period2": str(now_ts),
            "interval": "1d",
            "includeAdjustedClose": "true",
            "events": "div,splits",
        }
    )
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(symbol)}?{query}"

    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)

    result = payload["chart"]["result"][0]
    timestamps = result.get("timestamp", [])
    adjusted = result["indicators"]["adjclose"][0]["adjclose"]

    rows = []
    for timestamp, value in zip(timestamps, adjusted):
        if value is None:
            continue
        rows.append((iso_date_from_timestamp(int(timestamp)), float(value)))

    rows.sort(key=lambda item: item[0])
    return rows


def write_series(name: str, rows: list[tuple[str, float]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / f"{name}.csv"

    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["date", "value"])
        for date, value in rows:
            writer.writerow([date, f"{value:.10f}".rstrip("0").rstrip(".")])


def main() -> int:
    for output_name, series_id in LEGACY_DATA_IDS.items():
        existing_path = DATA_DIR / f"{output_name}.csv"
        rows = read_csv_series(existing_path) if existing_path.exists() else read_legacy_series(series_id)
        write_series(output_name, rows)
        print(f"Wrote {output_name}.csv with {len(rows)} rows")

    for output_name, symbol in YAHOO_SERIES.items():
        rows = fetch_yahoo_series(symbol)
        write_series(output_name, rows)
        print(f"Wrote {output_name}.csv from {symbol} with {len(rows)} rows")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
