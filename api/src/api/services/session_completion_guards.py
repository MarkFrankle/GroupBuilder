"""Shared refusals for actions that would change a completed Session.

The rule "never change the past" is enforced by more than one router
(``assignments`` shuffles and edits, ``roster`` rebuilds the whole program), so
the guard and its approved copy live here rather than in either router. The
message text is user-facing copy — keep it byte-identical if it moves again.
"""

from typing import List

from fastapi import HTTPException

from .session_completion_storage import SessionCompletionStorage


def program_rebuild_refusal(session_numbers: List[int]) -> str:
    """Message refusing a whole-program rebuild because Sessions are complete.

    Requires a non-empty list of session numbers. Reads as a sentence for one
    Session and for several, and always ends with the two ways out.
    """
    numbers = [str(n) for n in session_numbers]
    if len(numbers) == 1:
        listed = f"Session {numbers[0]} is"
        remedy = "reopen the completed session first"
    else:
        joined = " and ".join([", ".join(numbers[:-1]), numbers[-1]])
        listed = f"Sessions {joined} are"
        remedy = "reopen the completed sessions first"
    return (
        f"{listed} already complete, so the whole program cannot be rebuilt. "
        f"Shuffle a single session instead, or {remedy}."
    )


def refuse_if_any_session_complete(
    completion: SessionCompletionStorage, program_id: str
) -> None:
    """Full-program rebuilds cannot run once any Session is frozen."""
    completed_through = completion.get_completed_through(program_id)
    if completed_through:
        raise HTTPException(
            status_code=409,
            detail=program_rebuild_refusal(list(range(1, completed_through + 1))),
        )


def session_count_floor_refusal(completed_through: int) -> str:
    """Message refusing a session count below the completed prefix."""
    return (
        f"Session {completed_through} is marked complete, so this program "
        f"cannot drop below {completed_through} sessions. "
        f"Reopen Session {completed_through} first."
    )


def refuse_if_below_completed_prefix(
    completion: SessionCompletionStorage, program_id: str, num_sessions: int
) -> None:
    """A program may never have fewer Sessions than it has already completed.

    Completion lives on the Program document and survives a new assignment set,
    so a shrinking session count would otherwise strand a completed Session with
    nothing on screen to reopen it from. The floor makes that state unreachable.
    """
    completed_through = completion.get_completed_through(program_id)
    if num_sessions < completed_through:
        raise HTTPException(
            status_code=409, detail=session_count_floor_refusal(completed_through)
        )


def not_accepted_refusal() -> str:
    return (
        "The rebuilt sessions haven't been confirmed yet. "
        "Accept or undo them on the assignments page first."
    )


def refuse_if_not_accepted(storage, program_id: str, set_id: str) -> None:
    """Mutations are refused while a rebuilt set is still provisional (Item 6b).

    ``accepted`` missing means a set written before 6b - never provisional.
    """
    doc = storage.get_set(program_id, set_id) or {}
    if doc.get("accepted", True) is False:
        raise HTTPException(status_code=409, detail=not_accepted_refusal())
