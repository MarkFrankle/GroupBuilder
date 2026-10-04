# Frontend Testing

Jest + React Testing Library under CRA + craco. Read this before writing or debugging a
frontend test.

## Running and mocking

- **Run tests through `npm test`, never `npx jest` directly.** The transform config comes from
  craco, so a bare `npx jest` fails every suite with "Cannot use import statement outside a
  module". It is a config problem that looks like a code problem.
- **Mock `@/utils/apiClient`, not Firebase SDK internals.**
  `jest.mock('@/utils/apiClient', () => ({ authenticatedFetch: (...args) => fetch(...args) }))`
- **Importing anything from `App.tsx` drags in the whole route tree.** `NavBar` is exported from
  `App.tsx`, so `NavBar.test.tsx` pulls in `RosterPage` and then the ESM-only `uuid` package,
  which craco's Jest does not transform. Add `jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }))`
  (as `RosterPage.test.tsx` already does). Mock `@/contexts/AuthContext`,
  `@/contexts/ProgramContext`, and `@/hooks/queries` so the render doesn't need providers.

## Radix components

- **`user-event` v13 cannot drive a Radix `Select` or `DropdownMenu`.** `userEvent.click` on an
  option leaves the trigger unchanged, even with `skipPointerEventsCheck`, and a synthesized
  `pointerUp` does not select either. Use `fireEvent.keyDown(trigger, { key: 'Enter' })` to open
  and `fireEvent.click(option)` to choose. **`fireEvent.click` on the trigger does not open
  either one** (confirmed for `DropdownMenu` in `SessionCard.test.tsx`), so reach for `keyDown`
  first rather than treating it as a fallback. Tests touching either need
  `Element.prototype.scrollIntoView` stubbed, because Radix calls it on open. See
  `KeepApartSection.test.tsx` and `SessionCard.test.tsx`.
- **A Radix trigger's click bubbles.** Radix opens a `DropdownMenu` on *pointerdown* and does not
  stop the subsequent `click`, so a trigger inside a container with an `onClick` fires that
  container's handler too. Verified on `AssignmentsPage`: a mouse-open of the History menu clears
  `selectedName` via the page's click-outside dismissal. A keyboard-open (`keyDown` Enter) does
  not. Any trigger whose own rendering depends on that state needs `onPointerDown`/`onClick`
  `stopPropagation`.
- **To test that mouse path, dispatch a real `MouseEvent`.** jsdom has no `PointerEvent`, so
  `fireEvent.pointerDown(el, { button: 0 })` never delivers `button` and Radix ignores it. Use
  `fireEvent(el, new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))`
  then `fireEvent.click(el)`. The keyboard open masks trigger-propagation bugs entirely. It hid
  a live one where the Mark present picker unmounted the instant it opened.
- **Don't interpolate into a Radix menu label you plan to query as one string.**
  `<DropdownMenuLabel>Seat {name} at…</DropdownMenuLabel>` renders three text nodes, so
  `getByText('Seat Cara at…')` fails with "the text is broken up by multiple elements". Use a
  single template literal in the component rather than weakening the test to a function matcher.
- **A multi-select popover with checkboxes: use `DropdownMenu` + `DropdownMenuCheckboxItem`, not
  a new Popover dep.** `@radix-ui/react-popover` isn't installed. Give each checkbox item
  `onSelect={e => e.preventDefault()}` or the menu closes on the first tick. It opens in tests
  with `fireEvent.keyDown(trigger, { key: 'Enter' })`, and items are `role="menuitemcheckbox"`.
  See `AwayCell.tsx`.

## Inputs and timing

- **`userEvent.type` is slow enough to blow Jest's 5s timeout.** Seven characters means seven
  keystrokes, each with its own React state update. `RosterGrid.test.tsx` timed out on
  `userEvent.type(input, 'Charlie')`, and because the timeout aborts mid-`await`, teardown left
  React broken and the **next two tests** rendered `<body><div /></body>`. That failure looks
  like a broken component and is really a corpse. Prefer
  `fireEvent.change(input, { target: { value } })`: inputs read `e.target.value` wholesale, so
  per-keystroke typing exercises nothing extra. That one swap took the suite from 33s to 7.5s.
  **But check what the value change is supposed to trigger.** `fireEvent.change` does not
  focus, so a commit hanging off blur needs an explicit `.focus()` first and a real click away
  to move focus out.
- **In `RosterPage.test.tsx`, wait for a grid row before acting on the page.** The grid copies
  the roster into state on an effect, one render after loading ends, so a `findByRole` on a
  button can resolve against an empty grid. A discard prompt then counts the wrong changes.
  `await screen.findByDisplayValue('<name>')` first.

## Queries

- **`aria-live="polite"` alone is not `role="status"`.** Only `<output>` implies that role, so
  `getByRole('status')` cannot find a bare `aria-live` div. Add an explicit `role="status"` if
  you want to query the live region by role. Note `NoticeStrip` also renders `role="status"`, so
  a page can have two.
