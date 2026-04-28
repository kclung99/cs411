# data/scripts/generate_charging_sessions.py
# reads ACN sessions, users.json, stations.json, charging_requests.json
# writes data/generated/charging_sessions.json
# also updates data/generated/charging_requests.json statuses:
# - linked latest request -> completed
# - earlier requests from same session -> cancelled
# - unlinked request-only rows -> remain incomplete

import json
from datetime import datetime
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parents[1]  # points to data/

ACN_PATH = BASE_DIR / "raw" / "acndata_sessions.json"
USERS_PATH = BASE_DIR / "generated" / "users.json"
STATIONS_PATH = BASE_DIR / "generated" / "stations.json"
REQUESTS_PATH = BASE_DIR / "generated" / "charging_requests.json"
SESSIONS_OUTPUT_PATH = BASE_DIR / "generated" / "charging_sessions.json"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


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


def parse_acn_datetime_obj(value: Any) -> datetime | None:
    if value is None:
        return None

    value_str = str(value).strip()

    if not value_str:
        return None

    return datetime.strptime(value_str, "%a, %d %b %Y %H:%M:%S GMT")


def parse_acn_datetime(value: Any) -> str | None:
    dt = parse_acn_datetime_obj(value)
    if dt is None:
        return None
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def make_request_id(session_id: str, input_index: int) -> str:
    return f"REQ-{session_id}-{input_index}"


def get_latest_request_id_for_session(
    session: dict[str, Any],
    valid_request_ids: set[str],
) -> tuple[str | None, set[str]]:
    session_id = session.get("sessionID")
    user_inputs = session.get("userInputs") or []

    if not session_id or not user_inputs:
        return None, set()

    parsed_inputs = []

    for idx, user_input in enumerate(user_inputs, start=1):
        request_id = make_request_id(session_id, idx)

        if request_id not in valid_request_ids:
            continue

        try:
            modified_at = parse_acn_datetime_obj(user_input.get("modifiedAt"))
        except Exception:
            continue

        if modified_at is None:
            continue

        parsed_inputs.append((idx, request_id, modified_at))

    if not parsed_inputs:
        return None, set()

    latest = max(parsed_inputs, key=lambda x: x[2])
    latest_request_id = latest[1]
    all_request_ids_for_session = {x[1] for x in parsed_inputs}

    return latest_request_id, all_request_ids_for_session


def main() -> None:
    acn_data = load_json(ACN_PATH)
    users = load_json(USERS_PATH)
    stations = load_json(STATIONS_PATH)
    requests = load_json(REQUESTS_PATH)

    valid_user_ids = {u["user_id"] for u in users}
    valid_station_ids = {s["station_id"] for s in stations}
    valid_request_ids = {r["request_id"] for r in requests}

    # start from current request json
    # most rows should currently be "incomplete"
    request_by_id = {r["request_id"]: r for r in requests}

    sessions: list[dict[str, Any]] = []

    skipped_missing_session_id = 0
    skipped_missing_station = 0
    skipped_bad_datetime = 0
    skipped_bad_time_order = 0
    skipped_bad_energy = 0
    null_user_count = 0
    null_request_count = 0
    linked_request_ids: set[str] = set()
    cancelled_request_ids: set[str] = set()

    for item in get_acn_items(acn_data):
        session_id = item.get("sessionID")
        station_id = item.get("stationID")

        if not session_id:
            skipped_missing_session_id += 1
            continue

        if station_id not in valid_station_ids:
            skipped_missing_station += 1
            continue

        user_id = normalize_user_id(item.get("userID"))

        if user_id not in valid_user_ids:
            user_id = None
            null_user_count += 1

        request_id, request_ids_for_session = get_latest_request_id_for_session(
            item,
            valid_request_ids,
        )

        if request_id is None:
            null_request_count += 1
        else:
            linked_request_ids.add(request_id)
            cancelled_request_ids.update(request_ids_for_session - {request_id})

        try:
            connection_time_obj = parse_acn_datetime_obj(item.get("connectionTime"))
            disconnect_time_obj = parse_acn_datetime_obj(item.get("disconnectTime"))
            done_charging_time_obj = parse_acn_datetime_obj(item.get("doneChargingTime"))
        except Exception:
            skipped_bad_datetime += 1
            continue

        if connection_time_obj is None or disconnect_time_obj is None:
            skipped_bad_datetime += 1
            continue

        if disconnect_time_obj < connection_time_obj:
            skipped_bad_time_order += 1
            continue

        if done_charging_time_obj is not None:
            if (
                done_charging_time_obj < connection_time_obj
                or done_charging_time_obj > disconnect_time_obj
            ):
                done_charging_time_obj = None

        try:
            energy_kwh = float(item.get("kWhDelivered"))
        except Exception:
            skipped_bad_energy += 1
            continue

        if energy_kwh < 0:
            skipped_bad_energy += 1
            continue

        sessions.append({
            "session_id": session_id,
            "request_id": request_id,
            "user_id": user_id,
            "station_id": station_id,
            "connection_time": connection_time_obj.strftime("%Y-%m-%d %H:%M:%S"),
            "disconnect_time": disconnect_time_obj.strftime("%Y-%m-%d %H:%M:%S"),
            "done_charging_time": (
                done_charging_time_obj.strftime("%Y-%m-%d %H:%M:%S")
                if done_charging_time_obj is not None
                else None
            ),
            "energy_kwh": energy_kwh,
        })

    # update request statuses
    # linked latest request -> completed
    # other requests from same session -> cancelled
    # all other requests remain incomplete
    for request in requests:
        rid = request["request_id"]

        if rid in linked_request_ids:
            request["request_status"] = "completed"
        elif rid in cancelled_request_ids:
            request["request_status"] = "cancelled"
        else:
            request["request_status"] = "incomplete"

    write_json(SESSIONS_OUTPUT_PATH, sessions)
    write_json(REQUESTS_PATH, requests)

    print(f"wrote {len(sessions)} charging sessions to {SESSIONS_OUTPUT_PATH}")
    print(f"updated request statuses in {REQUESTS_PATH}")
    print(f"completed requests: {len(linked_request_ids)}")
    print(f"cancelled requests: {len(cancelled_request_ids)}")
    print(f"incomplete requests: {sum(1 for r in requests if r['request_status'] == 'incomplete')}")
    print(f"skipped missing session_id: {skipped_missing_session_id}")
    print(f"skipped missing station FK: {skipped_missing_station}")
    print(f"skipped bad datetime: {skipped_bad_datetime}")
    print(f"skipped bad time order: {skipped_bad_time_order}")
    print(f"skipped bad energy: {skipped_bad_energy}")
    print(f"sessions with null user_id: {null_user_count}")
    print(f"sessions with null request_id: {null_request_count}")


if __name__ == "__main__":
    main()