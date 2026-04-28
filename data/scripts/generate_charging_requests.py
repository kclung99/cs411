# data/scripts/generate_charging_requests.py
# reads ACN sessions, users.json, stations.json
# writes data/generated/charging_requests.json
#
# important:
# - all requests start as request_status = "incomplete"
# - generate_charging_sessions.py should later update:
#   - latest linked request -> completed
#   - earlier inputs from same session -> cancelled

import json
from datetime import datetime
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parents[1]  # points to data/

ACN_PATH = BASE_DIR / "raw" / "acndata_sessions.json"
USERS_PATH = BASE_DIR / "generated" / "users.json"
STATIONS_PATH = BASE_DIR / "generated" / "stations.json"
OUTPUT_PATH = BASE_DIR / "generated" / "charging_requests.json"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_acn_items(acn_data: Any) -> list[dict[str, Any]]:
    if isinstance(acn_data, list):
        return acn_data

    if isinstance(acn_data, dict) and "_items" in acn_data:
        return acn_data["_items"]

    raise ValueError("unsupported ACN JSON shape; expected list or object with _items")


def normalize_user_id(user_id: Any) -> str | None:
    if user_id is None:
        return None

    user_id_str = str(user_id).strip()

    if not user_id_str:
        return None

    if user_id_str.isdigit():
        return user_id_str.zfill(9)

    return user_id_str


def parse_acn_datetime(value: Any) -> str | None:
    if value is None:
        return None

    value_str = str(value).strip()

    if not value_str:
        return None

    dt = datetime.strptime(value_str, "%a, %d %b %Y %H:%M:%S GMT")
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def make_request_id(session_id: str, input_index: int) -> str:
    return f"REQ-{session_id}-{input_index}"


def main() -> None:
    acn_data = load_json(ACN_PATH)
    users = load_json(USERS_PATH)
    stations = load_json(STATIONS_PATH)

    valid_user_ids = {u["user_id"] for u in users}
    valid_station_ids = {s["station_id"] for s in stations}

    requests: list[dict[str, Any]] = []

    skipped_no_inputs = 0
    skipped_missing_user = 0
    skipped_missing_station = 0
    skipped_bad_datetime = 0
    skipped_bad_value = 0

    for item in get_acn_items(acn_data):
        session_id = item.get("sessionID")
        station_id = item.get("stationID")
        user_inputs = item.get("userInputs") or []

        if not session_id or not user_inputs:
            skipped_no_inputs += 1
            continue

        if station_id not in valid_station_ids:
            skipped_missing_station += 1
            continue

        for idx, user_input in enumerate(user_inputs, start=1):
            user_id = normalize_user_id(user_input.get("userID"))

            if user_id not in valid_user_ids:
                skipped_missing_user += 1
                continue

            try:
                requested_departure = parse_acn_datetime(user_input.get("requestedDeparture"))
                modified_at = parse_acn_datetime(user_input.get("modifiedAt"))

                if requested_departure is None or modified_at is None:
                    skipped_bad_datetime += 1
                    continue

                request = {
                    "request_id": make_request_id(session_id, idx),
                    "user_id": user_id,
                    "station_id": station_id,
                    "wh_per_mile": int(user_input.get("WhPerMile")),
                    "kwh_requested": float(user_input.get("kWhRequested")),
                    "miles_requested": float(user_input.get("milesRequested")),
                    "minutes_available": int(user_input.get("minutesAvailable")),
                    "requested_departure": requested_departure,
                    "payment_required": bool(user_input.get("paymentRequired")),
                    "modified_at": modified_at,

                    # default state; generate_charging_sessions.py updates this later
                    "request_status": "incomplete",
                }

            except Exception:
                skipped_bad_value += 1
                continue

            requests.append(request)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(requests, f, indent=2)

    print(f"wrote {len(requests)} charging requests to {OUTPUT_PATH}")
    print(f"skipped sessions with no userInputs: {skipped_no_inputs}")
    print(f"skipped rows with missing user FK: {skipped_missing_user}")
    print(f"skipped sessions with missing station FK: {skipped_missing_station}")
    print(f"skipped rows with bad datetime: {skipped_bad_datetime}")
    print(f"skipped rows with bad values: {skipped_bad_value}")


if __name__ == "__main__":
    main()