from collections import defaultdict
from typing import List, Dict, Any

def arrange_circular_seating(participants: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Arrange participants around a circular table, distributing religions evenly.

    Args:
        participants: List of participant dicts with 'name', 'religion', 'gender', 'partner'

    Returns:
        List of participants with 'position' field added (0-indexed around circle)
    """
    if not participants:
        return []

    # Group by religion
    religion_groups = defaultdict(list)
    for p in participants:
        religion_groups[p['religion']].append(p)

    # Sort by group size (largest first) for better distribution
    sorted_groups = sorted(religion_groups.values(), key=len, reverse=True)

    # Round-robin distribution
    result = []
    while any(len(group) > 0 for group in sorted_groups):
        for group in sorted_groups:
            if group:
                result.append(group.pop(0))

    # Assign position indices
    for i, participant in enumerate(result):
        participant['position'] = i

    return result
