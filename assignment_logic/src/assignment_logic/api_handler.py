from assignment_logic.group_builder import GroupBuilder

def handle_generate_assignments(input_data):
    # Validate input (optional)
    # validate_input(input_data)

    # Extract required data
    participants = input_data["participants"]
    sessions = input_data["sessions"]

    # Use the core logic
    builder = GroupBuilder(participants, sessions)
    assignments = builder.generate_assignments()

    # Post-process and return API-ready response
    return {"assignments": assignments}
