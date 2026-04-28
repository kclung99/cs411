# scripts/generate_users.py
# reads real user ids from ACN, combines them with mock user profiles,
# and writes data/generated/users.json

import json
from pathlib import Path


ACN_PATH = Path("data/raw/acndata_sessions.json")
MOCK_USERS_PATH = Path("data/mock/users_mock.json")
OUTPUT_PATH = Path("data/generated/users.json")


def normalize_user_id(user_id):
    if user_id is None:
        return None

    # top-level ACN userID is usually already like "000000710"
    # nested userInputs.userID is often numeric like 710
    user_id_str = str(user_id).strip()

    if not user_id_str:
        return None

    if user_id_str.isdigit():
        return user_id_str.zfill(9)

    return user_id_str


def extract_user_ids(acn_data):
    user_ids = set()

    for item in acn_data.get("_items", []):
        top_level_user_id = normalize_user_id(item.get("userID"))
        if top_level_user_id:
            user_ids.add(top_level_user_id)

        user_inputs = item.get("userInputs") or []
        for user_input in user_inputs:
            nested_user_id = normalize_user_id(user_input.get("userID"))
            if nested_user_id:
                user_ids.add(nested_user_id)

    return sorted(user_ids)


def main():
    with ACN_PATH.open("r", encoding="utf-8") as f:
        acn_data = json.load(f)

    with MOCK_USERS_PATH.open("r", encoding="utf-8") as f:
        mock_users = json.load(f)

    user_ids = extract_user_ids(acn_data)

    if len(mock_users) < len(user_ids):
        raise ValueError(
            f"not enough mock users: got {len(mock_users)}, need {len(user_ids)}"
        )

    users = []

    for user_id, mock_user in zip(user_ids, mock_users):
        users.append({
            "user_id": user_id,
            "first_name": mock_user["first_name"],
            "last_name": mock_user["last_name"],
            "email": mock_user["email"],
            "birth_date": mock_user["birth_date"],
            "registered_at": mock_user["registered_at"],
        })

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(users, f, indent=2)

    print(f"extracted {len(user_ids)} user ids")
    print(f"wrote {len(users)} users to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()