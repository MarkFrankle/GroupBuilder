from api.utils.seating_arrangement import arrange_circular_seating

def test_distributes_religions_evenly():
    """Religions should not be adjacent when possible"""
    table = [
        {"name": "Alice", "religion": "Christian", "gender": "F", "partner": None},
        {"name": "Bob", "religion": "Christian", "gender": "M", "partner": None},
        {"name": "Carol", "religion": "Muslim", "gender": "F", "partner": None},
        {"name": "Dave", "religion": "Muslim", "gender": "M", "partner": None},
    ]

    arranged = arrange_circular_seating(table)

    # Check no two adjacent seats have same religion
    for i in range(len(arranged)):
        next_i = (i + 1) % len(arranged)
        assert arranged[i]["religion"] != arranged[next_i]["religion"], \
            f"Seats {i} and {next_i} have same religion"

    # All participants should be present
    assert len(arranged) == 4

def test_handles_uneven_religion_distribution():
    """Handle tables like 4 Christians, 1 Muslim"""
    table = [
        {"name": "A", "religion": "Christian", "gender": "F", "partner": None},
        {"name": "B", "religion": "Christian", "gender": "M", "partner": None},
        {"name": "C", "religion": "Christian", "gender": "F", "partner": None},
        {"name": "D", "religion": "Christian", "gender": "M", "partner": None},
        {"name": "E", "religion": "Muslim", "gender": "F", "partner": None},
    ]

    arranged = arrange_circular_seating(table)

    # Should distribute as best as possible
    assert len(arranged) == 5

    # Muslim should be somewhere in the middle (not all Christians clustered)
    muslim_position = next(i for i, p in enumerate(arranged) if p["religion"] == "Muslim")
    assert 0 < muslim_position < 4, "Muslim should be distributed, not at extremes"

def test_handles_single_religion_table():
    """All same religion should just return in order"""
    table = [
        {"name": "A", "religion": "Christian", "gender": "F", "partner": None},
        {"name": "B", "religion": "Christian", "gender": "M", "partner": None},
    ]

    arranged = arrange_circular_seating(table)

    assert len(arranged) == 2
    assert arranged[0]['position'] == 0
    assert arranged[1]['position'] == 1

def test_handles_empty_table():
    """Empty participant list should return empty"""
    arranged = arrange_circular_seating([])
    assert arranged == []
