from assignment_logic.group_builder import GroupBuilder

def handle_generate_assignments(participants_df, numTables, numSessions):
    # validate_input(input_data)
    builder = GroupBuilder(participants_df, numTables, numSessions)
    results = builder.generate_assignments()

    return results
