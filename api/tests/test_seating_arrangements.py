from api.utils.seating_arrangement import arrange_circular_seating
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


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
        assert (
            arranged[i]["religion"] != arranged[next_i]["religion"]
        ), f"Seats {i} and {next_i} have same religion"

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
    muslim_position = next(
        i for i, p in enumerate(arranged) if p["religion"] == "Muslim"
    )
    assert 0 < muslim_position < 4, "Muslim should be distributed, not at extremes"


def test_handles_single_religion_table():
    """All same religion should just return in order"""
    table = [
        {"name": "A", "religion": "Christian", "gender": "F", "partner": None},
        {"name": "B", "religion": "Christian", "gender": "M", "partner": None},
    ]

    arranged = arrange_circular_seating(table)

    assert len(arranged) == 2
    assert arranged[0]["position"] == 0
    assert arranged[1]["position"] == 1


def test_handles_empty_table():
    """Empty participant list should return empty"""
    arranged = arrange_circular_seating([])
    assert arranged == []


def test_seating_endpoint_returns_positioned_seats():
    """POST /api/assignments/seating/{session_id} returns circular arrangements"""
    request_body = {
        "assignments": [
            {
                "session": 1,
                "tables": {
                    "1": [
                        {
                            "name": "Alice",
                            "religion": "Christian",
                            "gender": "F",
                            "partner": None,
                        },
                        {
                            "name": "Bob",
                            "religion": "Muslim",
                            "gender": "M",
                            "partner": None,
                        },
                    ],
                    "2": [
                        {
                            "name": "Carol",
                            "religion": "Jewish",
                            "gender": "F",
                            "partner": None,
                        },
                        {
                            "name": "Dave",
                            "religion": "Hindu",
                            "gender": "M",
                            "partner": None,
                        },
                        {
                            "name": "Eve",
                            "religion": "Christian",
                            "gender": "F",
                            "partner": None,
                        },
                    ],
                },
                "absentParticipants": [
                    {
                        "name": "Frank",
                        "religion": "Muslim",
                        "gender": "M",
                        "partner": None,
                    }
                ],
            }
        ]
    }

    response = client.post(
        "/api/assignments/seating/test-session-123?session=1", json=request_body
    )

    assert response.status_code == 200
    data = response.json()

    # Check structure
    assert data["session"] == 1
    assert len(data["tables"]) == 2

    # Check table 1
    table1 = data["tables"][0]
    assert table1["table_number"] == 1
    assert len(table1["seats"]) == 2
    assert all("position" in seat for seat in table1["seats"])
    assert all("name" in seat for seat in table1["seats"])

    # Check table 2
    table2 = data["tables"][1]
    assert table2["table_number"] == 2
    assert len(table2["seats"]) == 3

    # Check absent participants
    assert len(data["absent_participants"]) == 1
    assert data["absent_participants"][0]["name"] == "Frank"


def test_seating_endpoint_handles_missing_session():
    """Should return 404 if session not found"""
    request_body = {
        "assignments": [{"session": 1, "tables": {"1": []}, "absentParticipants": []}]
    }

    response = client.post(
        "/api/assignments/seating/test-session-123?session=99", json=request_body
    )

    assert response.status_code == 404
    assert "Session 99 not found" in response.json()["detail"]
