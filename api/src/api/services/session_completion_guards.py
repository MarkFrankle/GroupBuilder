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
    completed = completion.get_completed_sessions(program_id)
    if completed:
        raise HTTPException(status_code=409, detail=program_rebuild_refusal(completed))
