# Backend Development Plan

## Overview
Plan of attack for backend improvements to support the table assignments feature.

---

## 1. ✅ Fix Version Metadata (`max_time_seconds`) Not Persisting Correctly

### Issue
When regenerating with `max_time_seconds=60` (1 minute), the frontend logs show the backend is returning `max_time_seconds=120` (2 minutes) for that version.

### Root Cause (FOUND)
In `api/src/api/storage.py` line 404-409, the `version_info` dictionary was missing `max_time_seconds` field.

### Fix Applied
Added `max_time_seconds` to version metadata in `store_result()`:
```python
version_info = {
    "version_id": version_id,
    "created_at": result_with_metadata["created_at"],
    "solve_time": data.get("metadata", {}).get("solve_time"),
    "solution_quality": data.get("metadata", {}).get("solution_quality"),
    "max_time_seconds": data.get("metadata", {}).get("max_time_seconds")  # ADDED
}
```

**File:** `api/src/api/storage.py` line 409

### Testing
1. Deploy backend
2. Regenerate with 60 seconds
3. Frontend console should log: `[Version Metadata] ... max_time_seconds: 60` ✓

---

## 2. ✅ Session/Results TTL Refresh on Access

### Status
**ALREADY IMPLEMENTED** for sessions (line 351 in storage.py)
**NOW IMPLEMENTED** for results

### Current Behavior
- Sessions: TTL already refreshes on `get_session()` ✓
- Results: TTL now refreshes on `get_result()` and `get_result_versions()` ✓

### Implementation Details
Added TTL refresh calls in three locations:

1. **`get_result()`** - Refreshes TTL when fetching specific version (line 453-454, 460-461, 469-471)
2. **`get_result_versions()`** - Refreshes TTL when listing versions (line 486)
3. Refreshes both the specific version key and the versions list

**Files Modified:** `api/src/api/storage.py` lines 437-487

### How It Works
- Every time results are accessed, TTL is extended to 30 days from current time
- Sessions already had this (line 351)
- Users can now plan weeks in advance without data expiring ✓

### Testing
1. Create results
2. Wait 1 day
3. Access results via API
4. Check Redis/Upstash - TTL should be ~29 days (not ~28 days)

---

## 3. Edit Persistence API Endpoint

### Issue
Currently, edits (swaps, marking absent) are saved in browser localStorage. This means:
- Edits are lost if user clears browser data
- Edits don't sync across devices
- Can't share edited assignments with others

### Desired Behavior
- "Done Editing" saves edits to backend
- Edits become the canonical version for that assignment version
- Edits persist across browsers and devices

### API Design

#### Endpoint: `PUT /api/assignments/results/{session_id}/versions/{version_id}`
Update the assignments for a specific version.

**Request Body:**
```json
[
  {
    "session": 1,
    "tables": {
      "1": [
        {"name": "Alice", "religion": "Christian", "gender": "Female", "partner": null},
        {"name": "Bob", "religion": "Muslim", "gender": "Male", "partner": null}
      ],
      "2": [...]
    },
    "absentParticipants": [
      {"name": "Charlie", "religion": "Jewish", "gender": "Male", "partner": null}
    ]
  }
]
```

**Response:**
```json
{
  "success": true,
  "version_id": "v_abc123",
  "updated_at": 1234567890
}
```

#### Endpoint: `GET /api/assignments/results/{session_id}/versions/{version_id}/edited`
Check if a version has been edited.

**Response:**
```json
{
  "has_edits": true,
  "edited_at": 1234567890
}
```

### Implementation Plan
1. Add version update endpoint
   - Validate session exists
   - Validate version exists
   - Validate assignment structure (same participants, same sessions)
   - Update stored assignments
   - Record edit timestamp
2. Update versions list to include edit metadata
3. Consider storing original solver output separately (optional, for reverting)

### Frontend Changes Needed
- Replace localStorage save with API call on "Done Editing"
- Remove localStorage logic, use API for all persistence
- Add loading state while saving

---

## 4. ✅ Per-Session Regeneration

### Issue
Currently regenerating recreates ALL sessions. Users may want to regenerate just one problematic session (e.g., due to absent participants or poor quality).

### API Design

#### Endpoint: `POST /api/assignments/regenerate/{session_id}/session/{session_number}`
Regenerate a specific session while keeping others unchanged.

**Path Parameters:**
- `session_id`: UUID of the session
- `session_number`: Which session to regenerate (1-based, e.g., 1, 2, 3)

**Query Parameters:**
- `max_time_seconds`: Solver time limit (default: 120, range: 30-240)
- `version_id`: Which version to base regeneration on (optional, defaults to latest)

**Request Body:**
```json
[
  {"name": "Alice", "religion": "Christian", "gender": "Female", "partner": null},
  {"name": "Bob", "religion": "Muslim", "gender": "Male", "partner": null}
]
```
*List of participants to mark as absent for this session (optional)*

**Response:**
```json
{
  "assignments": [...],  // Full assignments with regenerated session merged in
  "version_id": "v_abc124",
  "session": 2,
  "solve_time": 45.3,
  "quality": "optimal"
}
```

### Implementation ✅

**How It Works:**
1. **Extract historical pairings** from all OTHER sessions (sessions 1, 3, 4 when regenerating session 2)
2. **Filter participants** based on absent list for this specific session
3. **Run solver** with `num_sessions=1` and `historical_pairings` parameter
4. **Merge result** back into full assignments array
5. **Store as new version** with metadata marking which session was regenerated

**Key Insight:** The solver's existing `historical_pairings` infrastructure (used by incremental solving) perfectly supports this use case. When regenerating session 2:
- Pairings from sessions 1, 3, 4 are extracted and passed as historical constraints
- Solver penalizes repeating those pairings in the new session 2
- Works for BOTH past (session 1) and future (sessions 3-4) sessions

**Files Modified:**
- `api/src/api/routers/assignments.py`:
  - Added `_extract_pairings_from_sessions()` helper (lines 22-54)
  - Added `_get_active_participants()` helper (lines 57-72)
  - Added `regenerate_single_session` endpoint (lines 218-368)

**Example Usage:**
```bash
# Regenerate session 2 with Alice and Bob marked absent
curl -X POST "http://localhost:8000/api/assignments/regenerate/{session_id}/session/2?max_time_seconds=60" \
  -H "Content-Type: application/json" \
  -d '[
    {"name": "Alice", "religion": "Christian", "gender": "Female", "partner": null},
    {"name": "Bob", "religion": "Muslim", "gender": "Male", "partner": null}
  ]'
```

### Frontend Integration (Future)
- UI to select which session to regenerate
- Ability to mark participants absent per session
- Show which session was regenerated in version metadata

---

## 5. ✅ Fix Cloud Run Health Check Deployment

### Issue
GitHub Actions deployment failing with:
```
ERROR: unrecognized arguments:
  --startup-probe-http-get-path=/health
  --startup-probe-initial-delay-seconds=10
  ...
```

### Root Cause
The `--startup-probe-*` flags don't exist in the gcloud CLI version used by GitHub Actions.

### Fix Applied
Updated `.github/workflows/deploy-backend.yml`:
- Removed invalid `--startup-probe-*` flags
- Added `--startup-cpu-boost` for faster cold starts
- Added `--min-instances 0` (explicit)
- Health check endpoint `/health` still works, Cloud Run uses it automatically

**File:** `.github/workflows/deploy-backend.yml` lines 45-58

### Result
Deployment should now succeed ✓

---

## Priority Order

### ✅ High Priority (COMPLETED)
1. ✅ **Fix version metadata (`max_time_seconds`)** - Fixed in storage.py
2. ✅ **Session/Results TTL refresh** - Fixed in storage.py
3. ✅ **Cloud Run deployment** - Fixed in GitHub Actions workflow
4. ✅ **Per-session regeneration** - Implemented using historical_pairings mechanism

### Medium Priority (Future)
5. **Edit persistence API** - Currently works with localStorage, but not ideal for cross-device sync

---

## Testing Checklist

After implementing each feature:

- [ ] Unit tests for new endpoints
- [ ] Integration tests with frontend
- [ ] Manual testing with real data
- [ ] Check browser console for logged metadata
- [ ] Verify no regressions in existing functionality

---

## Notes

- All endpoints should maintain backwards compatibility
- Consider adding API versioning if making breaking changes
- Document all new endpoints in API documentation
- Consider rate limiting for regenerate endpoints
