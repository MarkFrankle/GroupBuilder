from assignment_logic.group_builder import GroupBuilder

def handle_generate_assignments(input_data):
    # Validate input (optional)
    # validate_input(input_data)

    # Extract required data
    participants, tables, sessions = input_data.values()

    # Use the core logic
    builder = GroupBuilder(participants, sessions)
    assignments = builder.generate_assignments()

    # Post-process and return API-ready response
    return {"assignments": assignments}
