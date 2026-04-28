# data/scripts/generate_maintenance_tickets.py
# reads stations.json and station_statuses.json
# writes data/generated/maintenance_tickets.json
#
# goal:
# - create maintenance tickets from offline / maintenance station status rows
# - keep ticket data correlated with station status data
# - add realistic variety in priority, ticket_status, closed_at, and description

import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


random.seed(2027)

BASE_DIR = Path(__file__).resolve().parents[1]  # points to data/

STATIONS_PATH = BASE_DIR / "generated" / "stations.json"
STATUSES_PATH = BASE_DIR / "generated" / "station_statuses.json"
OUTPUT_PATH = BASE_DIR / "generated" / "maintenance_tickets.json"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def parse_datetime(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")


def choose_issue_type(status: str) -> str:
    if status == "offline":
        return random.choices(
            ["offline", "hardware_issue", "inspection"],
            weights=[0.75, 0.20, 0.05],
            k=1,
        )[0]

    if status == "maintenance":
        return random.choices(
            ["maintenance", "inspection", "hardware_issue"],
            weights=[0.80, 0.15, 0.05],
            k=1,
        )[0]

    raise ValueError(f"unsupported status for ticket generation: {status}")


def choose_priority(issue_type: str, status: str) -> str:
    if status == "offline":
        return random.choices(
            ["high", "medium", "low"],
            weights=[0.70, 0.25, 0.05],
            k=1,
        )[0]

    if issue_type == "hardware_issue":
        return random.choices(
            ["high", "medium", "low"],
            weights=[0.45, 0.45, 0.10],
            k=1,
        )[0]

    if issue_type == "maintenance":
        return random.choices(
            ["medium", "low", "high"],
            weights=[0.65, 0.25, 0.10],
            k=1,
        )[0]

    # inspection
    return random.choices(
        ["low", "medium", "high"],
        weights=[0.55, 0.40, 0.05],
        k=1,
    )[0]


def choose_ticket_status(opened_at: datetime) -> tuple[str, str | None]:
    ticket_status = random.choices(
        ["open", "in_progress", "resolved", "closed"],
        weights=[0.42, 0.23, 0.25, 0.10],
        k=1,
    )[0]

    if ticket_status in ("open", "in_progress"):
        return ticket_status, None

    # resolved/closed tickets get a realistic close time after opened_at
    hours_to_close = random.randint(4, 14 * 24)
    closed_at = opened_at + timedelta(hours=hours_to_close)

    return ticket_status, closed_at.strftime("%Y-%m-%d %H:%M:%S")


def description_for_issue(issue_type: str, status: str, station_id: str) -> str:
    affected_parts = [
        "connector handle",
        "charging cable",
        "payment screen",
        "network module",
        "power relay",
        "RFID reader",
        "display panel",
        "cooling fan",
        "ground fault sensor",
        "parking bay sensor",
    ]

    symptoms = {
        "offline": [
            "stopped responding to remote health checks",
            "appeared unavailable in the operator dashboard",
            "failed to accept new charging sessions",
            "lost network connectivity during a status check",
            "reported repeated communication timeouts",
            "showed no response after the last status update",
            "was unavailable during a high-demand period",
        ],
        "maintenance": [
            "was flagged for scheduled inspection",
            "needs preventive maintenance before peak usage",
            "requires a routine connector and cable check",
            "was marked for technician review",
            "needs follow-up after a maintenance status report",
            "requires cleaning and safety inspection",
            "was placed into maintenance for reliability review",
        ],
        "hardware_issue": [
            "reported inconsistent charging behavior",
            "may have a worn connector or cable issue",
            "showed repeated hardware warnings",
            "needs hardware inspection after reliability alerts",
            "may require replacement of a charger component",
            "reported abnormal behavior during recent sessions",
            "needs technician review for possible equipment failure",
        ],
        "inspection": [
            "needs manual inspection after a status change",
            "should be reviewed before returning to normal service",
            "was flagged for operator follow-up",
            "needs site staff to verify physical condition",
            "requires visual inspection and service confirmation",
            "should be checked after unusual status history",
            "needs confirmation from the facilities team",
        ],
    }

    actions = [
        "Create a work order and confirm the station condition on site.",
        "Assign a technician and update the ticket after inspection.",
        "Check recent usage logs before closing this ticket.",
        "Verify the issue and mark the station active only after repair.",
        "Inspect the station and record whether parts need replacement.",
        "Review recent failed or incomplete charging attempts.",
        "Confirm that the station can start a new charging session.",
        "Update station status after the issue is resolved.",
    ]

    urgency_phrases = {
        "offline": [
            "Drivers may not be able to start a session.",
            "This may reduce available charging capacity.",
            "This could affect station reliability metrics.",
            "The issue should be prioritized if demand is high.",
        ],
        "maintenance": [
            "The station can remain limited until the check is complete.",
            "This should be handled before the next busy period.",
            "The issue is not necessarily urgent but should be tracked.",
            "Preventive work may reduce future downtime.",
        ],
        "hardware_issue": [
            "The station may continue to fail until inspected.",
            "A hardware problem could affect multiple future sessions.",
            "Parts replacement may be needed if the issue repeats.",
            "This should be escalated if another alert appears.",
        ],
        "inspection": [
            "No repair is confirmed yet, but follow-up is needed.",
            "The operator should verify the station before closing.",
            "This is a low-risk item unless more alerts appear.",
            "Inspection results should determine the next action.",
        ],
    }

    part = random.choice(affected_parts)
    symptom = random.choice(symptoms[issue_type])
    urgency = random.choice(urgency_phrases[issue_type])
    action = random.choice(actions)

    templates = [
        f"Station {station_id} {symptom}. Check the {part}. {urgency} {action}",
        f"{issue_type.replace('_', ' ').title()} ticket opened because the station {symptom}. Inspect the {part}. {action}",
        f"Operator review needed: station {station_id} {symptom}. {urgency} Focus inspection on the {part}.",
        f"The {part} may need attention after the station {symptom}. {action}",
        f"Reliability workflow created after the station {symptom}. {urgency} {action}",
    ]

    return random.choice(templates)


def main() -> None:
    stations = load_json(STATIONS_PATH)
    statuses = load_json(STATUSES_PATH)

    valid_station_ids = {station["station_id"] for station in stations}

    tickets: list[dict[str, Any]] = []
    ticket_id = 1

    skipped_invalid_station = 0

    for status_row in statuses:
        station_id = status_row["station_id"]
        status = status_row["status"]

        if station_id not in valid_station_ids:
            skipped_invalid_station += 1
            continue

        # active statuses do not create maintenance tickets
        if status == "active":
            continue

        # not every status issue needs a persisted ticket, but most do
        # this avoids making the ticket table look like a perfect copy of StationStatus
        create_probability = 0.90 if status == "offline" else 0.75
        if random.random() > create_probability:
            continue

        opened_at = parse_datetime(status_row["reported_at"])
        issue_type = choose_issue_type(status)
        priority = choose_priority(issue_type, status)
        ticket_status, closed_at = choose_ticket_status(opened_at)

        tickets.append({
            "ticket_id": ticket_id,
            "station_id": station_id,
            "status_id": status_row["status_id"],
            "opened_at": opened_at.strftime("%Y-%m-%d %H:%M:%S"),
            "closed_at": closed_at,
            "issue_type": issue_type,
            "priority": priority,
            "ticket_status": ticket_status,
            "description": description_for_issue(issue_type, status, station_id),
        })

        ticket_id += 1

    write_json(OUTPUT_PATH, tickets)

    status_counts = {}
    priority_counts = {}
    issue_counts = {}

    for ticket in tickets:
        status_counts[ticket["ticket_status"]] = (
            status_counts.get(ticket["ticket_status"], 0) + 1
        )
        priority_counts[ticket["priority"]] = (
            priority_counts.get(ticket["priority"], 0) + 1
        )
        issue_counts[ticket["issue_type"]] = (
            issue_counts.get(ticket["issue_type"], 0) + 1
        )

    print(f"wrote {len(tickets)} maintenance tickets to {OUTPUT_PATH}")
    print(f"ticket_status counts: {status_counts}")
    print(f"priority counts: {priority_counts}")
    print(f"issue_type counts: {issue_counts}")
    print(f"skipped invalid station refs: {skipped_invalid_station}")


if __name__ == "__main__":
    main()