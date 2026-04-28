# data/scripts/generate_station_statuses.py
# reads stations.json
# writes data/generated/station_statuses.json
#
# goal:
# - create realistic status history for each station
# - most statuses are active
# - older / lower-power stations have slightly more offline or maintenance events

import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


random.seed(2026)

BASE_DIR = Path(__file__).resolve().parents[1]  # points to data/

STATIONS_PATH = BASE_DIR / "generated" / "stations.json"
OUTPUT_PATH = BASE_DIR / "generated" / "station_statuses.json"


START_DATE = datetime(2020, 1, 1, 0, 0, 0)
END_DATE = datetime(2021, 1, 1, 0, 0, 0)


ACTIVE_NOTES = [
    "station operating normally",
    "station returned to service",
    "routine status check completed",
    "charger available for normal use",
    "station passed daily health check",
]

OFFLINE_NOTES = [
    "station is not responding",
    "network connection lost",
    "charger unavailable to drivers",
    "station failed remote health check",
    "power interruption reported",
]

MAINTENANCE_NOTES = [
    "scheduled maintenance",
    "charging connector inspection required",
    "technician inspection requested",
    "preventive maintenance visit",
    "charging cable needs inspection",
]


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def random_datetime_between(start: datetime, end: datetime) -> datetime:
    delta_seconds = int((end - start).total_seconds())
    return start + timedelta(seconds=random.randint(0, delta_seconds))


def station_issue_weight(station: dict[str, Any]) -> float:
    """
    Returns a small multiplier for issue probability.

    Older stations and lower-power stations get slightly more issue events.
    Keep this subtle so the data does not look too fake.
    """
    installed_at = datetime.strptime(station["installed_at"], "%Y-%m-%d")
    power = float(station["power_rating_kw"])

    weight = 1.0

    if installed_at.year <= 2015:
        weight += 0.35
    elif installed_at.year == 2016:
        weight += 0.20
    elif installed_at.year == 2017:
        weight += 0.10

    if power <= 2.4:
        weight += 0.25
    elif power <= 6.6:
        weight += 0.15

    return weight


def choose_status(station: dict[str, Any]) -> str:
    """
    Base distribution:
    - active: most rows
    - maintenance: some rows
    - offline: fewer rows

    Issue weight slightly increases offline/maintenance probability.
    """
    weight = station_issue_weight(station)

    active_p = max(0.60, 0.78 - ((weight - 1.0) * 0.10))
    maintenance_p = min(0.25, 0.14 * weight)
    offline_p = min(0.18, 0.08 * weight)

    total = active_p + maintenance_p + offline_p
    active_p /= total
    maintenance_p /= total
    offline_p /= total

    r = random.random()

    if r < active_p:
        return "active"
    if r < active_p + maintenance_p:
        return "maintenance"
    return "offline"


def note_for_status(status: str) -> str:
    if status == "active":
        return random.choice(ACTIVE_NOTES)
    if status == "offline":
        return random.choice(OFFLINE_NOTES)
    if status == "maintenance":
        return random.choice(MAINTENANCE_NOTES)

    raise ValueError(f"unsupported status: {status}")


def main() -> None:
    stations = load_json(STATIONS_PATH)

    station_statuses: list[dict[str, Any]] = []

    # roughly 20 rows per station = 1000 rows for 50 stations
    rows_per_station = 20

    status_id = 1

    for station in stations:
        station_id = station["station_id"]

        # generate chronological report times per station
        report_times = sorted(
            random_datetime_between(START_DATE, END_DATE)
            for _ in range(rows_per_station)
        )

        # force first row to active so every station has a baseline
        for idx, reported_at in enumerate(report_times):
            if idx == 0:
                status = "active"
            else:
                status = choose_status(station)

            station_statuses.append({
                "status_id": status_id,
                "station_id": station_id,
                "status": status,
                "reported_at": reported_at.strftime("%Y-%m-%d %H:%M:%S"),
                "note": note_for_status(status),
            })

            status_id += 1

    write_json(OUTPUT_PATH, station_statuses)

    counts = {}
    for row in station_statuses:
        counts[row["status"]] = counts.get(row["status"], 0) + 1

    print(f"wrote {len(station_statuses)} station statuses to {OUTPUT_PATH}")
    print(f"status counts: {counts}")


if __name__ == "__main__":
    main()