# scripts/generate_stations.py
# reads real station ids from ACN, combines them with mock station metadata,
# and writes data/generated/stations.json

import json
from pathlib import Path


ACN_PATH = Path("data/raw/acndata_sessions.json")
MOCK_STATIONS_PATH = Path("data/mock/stations_mock.json")
OUTPUT_PATH = Path("data/generated/stations.json")


def extract_station_ids(acn_data):
    station_ids = set()

    for item in acn_data.get("_items", []):
        station_id = item.get("stationID")
        if station_id:
            station_ids.add(str(station_id).strip())

    return sorted(station_ids)


def main():
    with ACN_PATH.open("r", encoding="utf-8") as f:
        acn_data = json.load(f)

    with MOCK_STATIONS_PATH.open("r", encoding="utf-8") as f:
        mock_stations = json.load(f)

    station_ids = extract_station_ids(acn_data)

    if len(mock_stations) < len(station_ids):
        raise ValueError(
            f"not enough mock stations: got {len(mock_stations)}, need {len(station_ids)}"
        )

    stations = []

    for station_id, mock_station in zip(station_ids, mock_stations):
        stations.append({
            "station_id": station_id,
            "station_name": mock_station["station_name"],
            "location_label": mock_station["location_label"],
            "charger_type": mock_station["charger_type"],
            "power_rating_kw": mock_station["power_rating_kw"],
            "installed_at": mock_station["installed_at"],
        })

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(stations, f, indent=2)

    print(f"extracted {len(station_ids)} station ids")
    print(f"wrote {len(stations)} stations to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()