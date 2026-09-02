from __future__ import annotations

import csv
from datetime import date, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
MAX_AGE_DAYS = 14
CORE_SERIES = (
    "taiex",
    "taiex_ex_tsmc_estimated",
    "vt",
    "vti",
    "ewj",
    "ewy",
    "ews",
    "ewh",
)


def latest_date(path: Path) -> date:
    latest: date | None = None

    with path.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            value = row.get("date")
            if value:
                latest = datetime.strptime(value, "%Y-%m-%d").date()

    if latest is None:
        raise RuntimeError(f"No dated rows found in {path}")

    return latest


def main() -> int:
    today = date.today()
    failures: list[str] = []

    for series in CORE_SERIES:
        path = DATA_DIR / f"{series}.csv"
        latest = latest_date(path)
        age = (today - latest).days
        print(f"{series}: latest={latest.isoformat()}, age={age} days")

        if age > MAX_AGE_DAYS:
            failures.append(f"{series} is {age} days old")

    if failures:
        raise RuntimeError("Stale market data: " + "; ".join(failures))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
