from collections import defaultdict
import pandas as pd
import re


def _sanitize_name(name: str) -> str:
    """
    Sanitize participant names to prevent injection attacks and ensure data integrity.

    - Removes potentially dangerous characters (<, >, &, ", ', /, \)
    - Limits length to 100 characters
    - Strips leading/trailing whitespace
    - Collapses multiple spaces to single space
    """
    if not name or pd.isnull(name):
        return ""

    # Convert to string and strip whitespace
    name = str(name).strip()

    # Remove potentially dangerous characters (XSS, injection)
    dangerous_chars = ["<", ">", "&", '"', "'", "/", "\\", "{", "}", "[", "]"]
    for char in dangerous_chars:
        name = name.replace(char, "")

    # Collapse multiple spaces to single space
    name = re.sub(r"\s+", " ", name)

    # Limit length
    max_length = 100
    if len(name) > max_length:
        name = name[:max_length].strip()

    return name


def _validate_partner_relationships(participants: list[dict]) -> None:
    """
    Validate partner relationships to ensure data integrity.

    Raises ValueError if:
    - Partner name doesn't exist in participant list
    - Partner relationship is asymmetric (A→B but B→C)
    - Participant is their own partner
    """
    # Create name lookup for fast validation
    participant_names = {p["name"] for p in participants}

    for participant in participants:
        partner_name = participant.get("partner")
        if not partner_name:
            continue

        # Check 1: Self-referential partnership
        if partner_name == participant["name"]:
            raise ValueError(
                f"Invalid partnership: {participant['name']} cannot be their own partner. "
                f"Please check row {participant['id']} in your Excel file."
            )

        # Check 2: Partner exists in participant list
        if partner_name not in participant_names:
            raise ValueError(
                f"Invalid partnership: {participant['name']} lists '{partner_name}' as partner, "
                f"but '{partner_name}' is not in the participant list. "
                f"Please check row {participant['id']} in your Excel file."
            )

        # Check 3: Symmetric partnership (A→B implies B→A)
        partner = next((p for p in participants if p["name"] == partner_name), None)
        if partner:
            partner_of_partner = partner.get("partner")
            if partner_of_partner != participant["name"]:
                raise ValueError(
                    f"Asymmetric partnership detected: {participant['name']} lists '{partner_name}' as partner, "
                    f"but '{partner_name}' lists '{partner_of_partner or 'no one'}' as partner. "
                    f"Both partners must list each other. Please check rows {participant['id']} and {partner['id']} in your Excel file."
                )


def dataframe_to_participant_dict(df: pd.DataFrame):
    # Sanitize all name fields to prevent injection attacks
    df["Name"] = df["Name"].apply(_sanitize_name)
    df["Partner"] = df["Partner"].apply(
        lambda x: _sanitize_name(x) if x and not pd.isnull(x) else None
    )

    # Handle other fields
    df["Religion"] = df["Religion"].apply(
        lambda x: "" if pd.isnull(x) else str(x).strip()
    )
    df["Gender"] = df["Gender"].apply(lambda x: "" if pd.isnull(x) else str(x).strip())

    participants = df.to_dict("records")

    has_facilitator_col = "Facilitator" in df.columns

    transformed_participants = []
    for index, row in enumerate(participants):
        is_facilitator = False
        if has_facilitator_col:
            fac_val = str(row.get("Facilitator", "")).strip().lower()
            is_facilitator = fac_val in ("yes", "y", "true", "1")
        transformed_participants.append(
            {
                "id": index + 1,
                "name": row["Name"],
                "religion": row["Religion"],
                "gender": row["Gender"],
                "partner": row["Partner"],
                "couple_id": None,
                "is_facilitator": is_facilitator,
            }
        )

    # Validate partner relationships before assigning couple IDs
    _validate_partner_relationships(transformed_participants)

    transformed_participants = _assign_couple_ids(transformed_participants)
    return transformed_participants


def _assign_couple_ids(data):
    couple_map = defaultdict(lambda: next_couple_id[0])
    next_couple_id = [1]

    for row in data:
        partner_name = row.get("partner")
        if partner_name:
            couple_key = tuple(sorted([row["name"], partner_name]))

            couple_id = couple_map[couple_key]
            row["couple_id"] = couple_id

            if couple_id == next_couple_id[0]:
                next_couple_id[0] += 1
        else:
            row["couple_id"] = None

    return data


if __name__ == "__main__":
    data = {
        "Name": [
            "John Doe",
            "Jane Doe",
            "Ali Hassan",
            "Rachel Green",
            "Ross Green",
            "Chandler Bing",
            "Monica",
            "Joey",
            "Phoebe",
            "Akshay",
        ],
        "Religion": [
            "Christian",
            "Christian",
            "Muslim",
            "Jewish",
            "Jewish",
            "other",
            "Muslim",
            "Jewish",
            "Christian",
            "Muslim",
        ],
        "Gender": [
            "Male",
            "Female",
            "Male",
            "Female",
            "Male",
            "Male",
            "Female",
            "Male",
            "Female",
            "Male",
        ],
        "Partner": [
            "Jane Doe",
            "John Doe",
            None,
            "Ross Green",
            "Rachel Green",
            None,
            None,
            None,
            None,
            None,
        ],
    }

    df = pd.DataFrame(data)
    print(dataframe_to_participant_dict(df))
