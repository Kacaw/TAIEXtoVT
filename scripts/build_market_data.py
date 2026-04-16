from __future__ import annotations

import csv
import io
import json
import re
import ssl
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
INDEX_HTML = ROOT / "index.html"
SSL_CONTEXT = ssl._create_unverified_context()

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

TSMC_BALANCE_SHEET_URL = "https://mopsfin.twse.com.tw/opendata/t187ap07_L_ci.csv"
LISTED_MARKET_OVERVIEW_URL = (
    "https://stat.fsc.gov.tw/FSC_OAS3_RESTORE/api/CSV_EXPORT?DATA_TYPE=1&OUTPUT_FILE=Y&TableID=A01"
)


def iso_date_from_timestamp(timestamp: int) -> str:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%Y-%m-%d")


def month_end_date(year: int, month: int) -> str:
    if month == 12:
        next_month = datetime(year + 1, 1, 1)
    else:
        next_month = datetime(year, month + 1, 1)
    return (next_month.replace(day=1) - timedelta(days=1)).strftime("%Y-%m-%d")


def quarter_end_date(year: int, quarter: int) -> str:
    mapping = {
        1: "03-31",
        2: "06-30",
        3: "09-30",
        4: "12-31",
    }
    return f"{year}-{mapping[quarter]}"


def clean_number(raw: str) -> float:
    return float(raw.replace(",", "").strip().strip('"'))


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


def fetch_text(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "*/*",
        },
    )
    with urllib.request.urlopen(request, timeout=45, context=SSL_CONTEXT) as response:
        return response.read().decode("utf-8-sig", errors="replace")


def fetch_yahoo_chart(symbol: str) -> list[dict[str, float | str]]:
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
    close = result["indicators"]["quote"][0]["close"]

    split_events = []
    for split in ((result.get("events") or {}).get("splits") or {}).values():
        numerator = float(split.get("numerator", 1))
        denominator = float(split.get("denominator", 1))
        if denominator == 0:
            continue
        split_events.append(
            {
                "date": iso_date_from_timestamp(int(split["date"])),
                "factor": numerator / denominator,
            }
        )

    rows: list[dict[str, float | str]] = []
    for timestamp, adj_value, close_value in zip(timestamps, adjusted, close):
        if adj_value is None or close_value is None:
            continue
        rows.append(
            {
                "date": iso_date_from_timestamp(int(timestamp)),
                "adjclose": float(adj_value),
                "close": float(close_value),
                "splitFactor": 1.0,
            }
        )

    rows.sort(key=lambda item: str(item["date"]))
    split_events.sort(key=lambda item: str(item["date"]))
    if split_events:
        split_map = {str(item["date"]): float(item["factor"]) for item in split_events}
        for row in rows:
          row["splitFactor"] = split_map.get(str(row["date"]), 1.0)
    return rows


def write_series(name: str, rows: list[tuple[str, float]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / f"{name}.csv"

    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["date", "value"])
        for date, value in rows:
            writer.writerow([date, f"{value:.10f}".rstrip("0").rstrip(".")])


def fetch_current_tsmc_shares() -> float:
    rows = list(csv.DictReader(io.StringIO(fetch_text(TSMC_BALANCE_SHEET_URL))))

    for row in rows:
        if row.get("公司代號") != "2330":
            continue

        capital_thousand_twd = clean_number(row["股本"])
        return capital_thousand_twd * 100

    raise RuntimeError("Could not find latest TSMC capital data")


def fetch_listed_market_value_monthly() -> list[tuple[str, float]]:
    rows = list(csv.DictReader(io.StringIO(fetch_text(LISTED_MARKET_OVERVIEW_URL))))
    parsed = []

    for row in rows:
        ym = row["年月"].strip()
        if len(ym) != 6:
            continue
        year = int(ym[:4])
        month = int(ym[4:6])
        market_value_twd = clean_number(row["上市市值_十億元"]) * 1_000_000_000
        parsed.append((month_end_date(year, month), market_value_twd))

    parsed.sort(key=lambda item: item[0])
    return parsed


def find_at_or_before(series: list[tuple[str, float]], date: str) -> tuple[str, float] | None:
    answer = None
    for item in series:
        if item[0] <= date:
            answer = item
        else:
            break
    return answer


def build_tsmc_shares_estimated(
    month_end_rows: list[tuple[str, float]],
    current_shares: float,
    split_rows: list[tuple[str, float]],
) -> list[tuple[str, float]]:
    rows = []
    for month_end, _ in month_end_rows:
        shares = current_shares
        for split_date, split_factor in split_rows:
            if split_date > month_end:
                shares /= split_factor
        rows.append((month_end, shares))
    return rows


def build_tsmc_weight_series(
    tsmc_close_rows: list[tuple[str, float]],
    shares_rows: list[tuple[str, float]],
    market_value_rows: list[tuple[str, float]],
) -> list[tuple[str, float]]:
    weights: list[tuple[str, float]] = []

    for month_end, total_market_value in market_value_rows:
        close_row = find_at_or_before(tsmc_close_rows, month_end)
        shares_row = find_at_or_before(shares_rows, month_end)
        if not close_row or not shares_row or total_market_value <= 0:
            continue

        _, tsmc_close = close_row
        _, shares = shares_row
        estimated_weight = (tsmc_close * shares) / total_market_value
        estimated_weight = max(0.01, min(estimated_weight, 0.90))
        weights.append((month_end, estimated_weight))

    deduped = {}
    for date, weight in weights:
        deduped[date] = weight

    return sorted(deduped.items())


def build_ex_tsmc_series(
    taiex_rows: list[tuple[str, float]],
    tsmc_adj_rows: list[tuple[str, float]],
    weight_rows: list[tuple[str, float]],
) -> list[tuple[str, float]]:
    taiex_map = {date: value for date, value in taiex_rows}
    tsmc_map = {date: value for date, value in tsmc_adj_rows}
    common_dates = sorted(set(taiex_map).intersection(tsmc_map))

    results: list[tuple[str, float]] = []
    current_level: float | None = None

    for prev_date, date in zip(common_dates, common_dates[1:]):
        prev_weight_row = find_at_or_before(weight_rows, prev_date)
        if prev_weight_row is None:
            continue

        weight = prev_weight_row[1]
        denominator = 1 - weight
        if denominator <= 0.02:
            continue

        taiex_prev = taiex_map[prev_date]
        taiex_curr = taiex_map[date]
        tsmc_prev = tsmc_map[prev_date]
        tsmc_curr = tsmc_map[date]

        r_index = taiex_curr / taiex_prev - 1
        r_tsmc = tsmc_curr / tsmc_prev - 1
        r_ex = (r_index - weight * r_tsmc) / denominator

        if current_level is None:
            current_level = taiex_prev
            results.append((prev_date, current_level))

        current_level *= 1 + r_ex
        results.append((date, current_level))

    deduped = {}
    for date, value in results:
        deduped[date] = value

    return sorted(deduped.items())


def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    for output_name, series_id in LEGACY_DATA_IDS.items():
        existing_path = DATA_DIR / f"{output_name}.csv"
        rows = read_csv_series(existing_path) if existing_path.exists() else read_legacy_series(series_id)
        write_series(output_name, rows)
        print(f"Wrote {output_name}.csv with {len(rows)} rows")

    yahoo_cache: dict[str, list[dict[str, float | str]]] = {}
    for output_name, symbol in YAHOO_SERIES.items():
        rows = fetch_yahoo_chart(symbol)
        yahoo_cache[output_name] = rows
        write_series(output_name, [(str(row["date"]), float(row["adjclose"])) for row in rows])
        print(f"Wrote {output_name}.csv from {symbol} with {len(rows)} rows")

    tsmc_close_rows = [(str(row["date"]), float(row["close"])) for row in yahoo_cache["tsmc_tw"]]
    write_series("tsmc_tw_close", tsmc_close_rows)
    print(f"Wrote tsmc_tw_close.csv with {len(tsmc_close_rows)} rows")

    market_value_rows = fetch_listed_market_value_monthly()
    write_series("tw_listed_market_value_monthly", market_value_rows)
    print(f"Wrote tw_listed_market_value_monthly.csv with {len(market_value_rows)} rows")

    current_tsmc_shares = fetch_current_tsmc_shares()
    split_rows = [
        (str(row["date"]), float(row["splitFactor"]))
        for row in yahoo_cache["tsmc_tw"]
        if float(row["splitFactor"]) != 1.0
    ]
    shares_rows = build_tsmc_shares_estimated(market_value_rows, current_tsmc_shares, split_rows)
    write_series("tsmc_shares_estimated", shares_rows)
    print(f"Wrote tsmc_shares_estimated.csv with {len(shares_rows)} rows")

    weight_rows = build_tsmc_weight_series(tsmc_close_rows, shares_rows, market_value_rows)
    write_series("tsmc_weight_estimate", weight_rows)
    print(f"Wrote tsmc_weight_estimate.csv with {len(weight_rows)} rows")

    taiex_rows = read_csv_series(DATA_DIR / "taiex.csv")
    tsmc_adj_rows = read_csv_series(DATA_DIR / "tsmc_tw.csv")
    ex_tsmc_rows = build_ex_tsmc_series(taiex_rows, tsmc_adj_rows, weight_rows)
    write_series("taiex_ex_tsmc_estimated", ex_tsmc_rows)
    print(f"Wrote taiex_ex_tsmc_estimated.csv with {len(ex_tsmc_rows)} rows")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
