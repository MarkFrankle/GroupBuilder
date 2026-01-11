# Feature Specification: Phase 1 UX Improvements

**Created:** 2026-01-11
**Status:** Draft
**Author:** Mark Frankle & Claude

---

## Overview

Simplify the results sharing workflow and improve upfront capacity visibility for event organizers using GroupBuilder. This feature replaces the current email-based sharing with a direct link copying mechanism and adds visible participant capacity information to the main page.

**Business Value:**
- **Simpler workflow**: Event organizers can instantly share results without waiting for email delivery or managing email addresses
- **Better planning**: Organizers know capacity limits before uploading participant data, preventing wasted effort
- **Reduced complexity**: Eliminates SendGrid dependency and email configuration requirements

**Target Users:**
- Event organizers for Building Bridges Together (BBT) interfaith dialogue seminars
- Volunteer coordinators managing participant assignments for multi-session events

---

## User Scenarios

### As an event organizer
I want to copy a shareable link to the assignment results
So that I can quickly share it with my team or save it for later access

**Acceptance Criteria:**
- [ ] A "Copy Link" button is visible on the results page
- [ ] Clicking the button copies the results URL to clipboard
- [ ] Visual feedback confirms the link was copied successfully
- [ ] The copied link allows anyone to view and edit the assignments (magic link behavior)
- [ ] The link remains valid for 30 days (existing behavior preserved)

### As an event organizer
I want to see the maximum participant limit on the main upload page
So that I know if my participant list will fit within system constraints before uploading

**Acceptance Criteria:**
- [ ] Maximum participant count (200) is displayed prominently on the main page
- [ ] The display appears before file upload so organizers can validate their data first
- [ ] The limit is shown in clear, non-technical language

---

## Functional Requirements

### Link Sharing

- The results page must display a "Copy Link" button that is easily discoverable
- Clicking the "Copy Link" button must copy the current page URL to the user's clipboard
- The system must provide visual feedback when the link is successfully copied (e.g., button text change, toast notification, or checkmark)
- The copied link must use the same magic link format as the current email functionality (bookmarkable, 30-day expiration)
- The link must provide access to the assignment editor, allowing recipients to view and modify assignments

### Capacity Display

- The main upload page must display "Maximum participants: 200" in a visible location
- The capacity information must appear before the file upload section
- The display must use plain language understandable to non-technical users

### Email Functionality Removal

- The email input field must be removed from the upload form
- SendGrid integration code must be removed
- Email-related configuration variables must be removed or marked deprecated
- No email functionality should remain in the results workflow

---

## Success Criteria

- Event organizers can copy the results link in under 2 seconds
- Users report the link sharing workflow is easier than the previous email method (qualitative feedback)
- 100% of users can see the participant limit before uploading files
- Zero email delivery failures or delays (since email is removed)
- Reduction in support questions about email functionality

---

## Assumptions

- The current magic link generation and 30-day expiration logic will remain unchanged
- Users have modern browsers with clipboard API support (Chrome, Firefox, Safari, Edge - last 2 versions)
- The 200 participant limit is a hard constraint that will not change in this feature scope
- The magic link format allows direct access to the assignment editor (no additional authentication required)

---

## Out of Scope

- Changing the 30-day expiration period for magic links
- Adding user authentication or access control to magic links
- Modifying the magic link URL format or generation logic
- Adding analytics tracking for link copying or sharing behavior
- Social media sharing buttons or other sharing mechanisms
- Changing the participant limit from 200

---

## Open Questions

- None at this time (feature scope is well-defined from customer feedback)

---

## Dependencies

- Existing magic link generation system must continue to function
- Clipboard API support in target browsers (standard in modern browsers)
- Frontend routing must support direct navigation to assignment editor via magic links

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Clipboard API not supported in older browsers | Med | Low | Display fallback message with manual copy instructions if API unavailable |
| Users don't notice the max participants display | Med | Med | Place in prominent location with clear visual hierarchy (tested in UI design) |
| Removing email breaks existing workflows | High | Low | Validate with customer (BBT) that copy link is acceptable replacement |

---

## Notes

- Customer feedback session on 2026-01-10 specifically requested these changes
- Email functionality removal reduces operational complexity (no SendGrid API keys to manage)
- These are "quick wins" designed to ship rapidly - estimated 1-2 hours total implementation time
- Part of Phase 1 UX improvements; Phase 2 will focus on output quality (CSV export, PDFs, validation)
