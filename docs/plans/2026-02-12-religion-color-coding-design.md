# Religion-Based Color Coding for Table Assignments

**Created:** 2026-02-12
**Feature:** Color-code participant names by religion using BBT brand colors
**Author:** Mark Frankle & Claude

---

## Overview

Replace the arbitrary hash-based color coding of participant names in the Compact assignments view with religion-based colors using the standard Building Bridges Together (BBT) color palette. This allows facilitators to parse the religious distribution across tables at a glance.

**Business Value:**
- Facilitators can instantly see religion distribution by scanning table colors
- Aligns with the BBT brand color palette already familiar to organizers
- Directly addresses the most consistent piece of user feedback from BBT facilitators

**Target Users:**
- Building Bridges Together event facilitators reviewing table assignments

---

## Current State

### Compact View (`CompactAssignments.tsx`)

Participant names are rendered as small colored buttons. Colors are assigned by hashing the participant's name (djb2 hash) into a palette of 12 arbitrary Tailwind colors. This means:

- Colors are **consistent per name** across sessions (same hash = same color)
- Colors have **no semantic meaning** — religion, gender, etc. are not encoded
- Colors provide **visual variety** that makes it easy to track individuals across sessions
- Religion is only visible on **hover** (tooltip shows `religion, gender`)

```typescript
// Current: hash-based, 12 arbitrary colors
const colors = [
  'bg-blue-100 hover:bg-blue-200',
  'bg-green-100 hover:bg-green-200',
  'bg-yellow-100 hover:bg-yellow-200',
  'bg-purple-100 hover:bg-purple-200',
  // ... 8 more
]
const index = Math.abs(hash) % colors.length
```

### Detailed View (`TableAssignments.tsx`)

Participant names are displayed as plain black text. Religion and gender appear as separate colored **badge chips** below the name. The `getReligionColor()` function already maps religions to Tailwind classes, but using generic Tailwind colors (green for Christian, teal for Muslim, indigo for Jewish, etc.) — not the BBT brand palette.

---

## Proposed BBT Color Palette

The standard Building Bridges Together brand colors:

| Religion   | Color       | RGB           | Hex       |
|------------|-------------|---------------|-----------|
| Jewish     | Blue        | 0, 158, 219   | `#009EDB` |
| Christian  | Red         | 233, 40, 43   | `#E9282B` |
| Muslim     | Green       | 100, 170, 62  | `#64AA3E` |
| Other      | Yellow/Gold | 251, 175, 64  | `#FBAF40` |

These need to be adapted for use as **background colors** on name buttons/badges, which requires lighter tinted versions for readability (dark text on light background).

---

## Design Decision: Flat vs. Varied Shades

The core tension: flat per-religion colors give the clearest at-a-glance religious distribution, but the current variety of colors makes it easier to visually distinguish and track individual participants across sessions.

### Option A: Flat Colors Per Religion

Each religion maps to exactly one background color derived from its BBT color.

```
Table 1:  [Sarah]  [David]  [Ahmed]  [Fatima]  [Rachel]  [Omar]
Colors:    blue     blue     green    green      blue     green
```

**Pros:**
- Maximum clarity for parsing religion distribution — the primary user request
- Simplest implementation
- Unambiguous: color = religion, no interpretation needed

**Cons:**
- Loss of individual visual distinction — harder to track a specific person across sessions
- Tables with many same-religion participants become a wall of one color
- Less visually interesting than the current varied palette

### Option B: Shade Variations Within Religion (Recommended)

Each religion has a **base BBT color**, but individual participants get slight shade variations (lighter/darker/warmer/cooler) within that color family. The shade is determined by hashing the participant's name, same as today, but the hash selects from a constrained palette within the religion's color family rather than from an unconstrained global palette.

```
Table 1:  [Sarah]    [David]     [Ahmed]    [Fatima]     [Rachel]   [Omar]
Colors:   blue-100   blue-200    green-100  green-150    blue-150   green-200
          ← clearly blue →      ← clearly green →       blue       green
```

**Pros:**
- Religion is immediately parseable (all blues are Jewish, all greens are Muslim, etc.)
- Individual participants remain visually distinguishable within their religion group
- Preserves the visual variety that users enjoy about the current implementation
- Tracking individuals across sessions is still possible via shade + name

**Cons:**
- Slightly more complex implementation
- Subtle shade differences may not be immediately obvious as "same religion" to new users (mitigated by legend)
- Requires defining 3-4 shade variants per religion color

### Shade Variant Palette (Option B)

Each religion gets 3-4 shade variants. The participant's name hash selects which shade they get (consistent across all views/sessions).

**Jewish (Blue family) — base `#009EDB`:**

| Variant | Background  | Text Color | CSS/Tailwind Approach |
|---------|-------------|------------|----------------------|
| 1       | `#D6F0FB`   | `#005F83`  | Lightest tint        |
| 2       | `#B0E0F6`   | `#005F83`  | Light tint           |
| 3       | `#8AD0F1`   | `#004A66`  | Medium tint          |
| 4       | `#CCE8F4`   | `#005F83`  | Cool light tint      |

**Christian (Red family) — base `#E9282B`:**

| Variant | Background  | Text Color | CSS/Tailwind Approach |
|---------|-------------|------------|----------------------|
| 1       | `#FDE2E2`   | `#8B1A1A`  | Lightest tint        |
| 2       | `#F9C4C4`   | `#8B1A1A`  | Light tint           |
| 3       | `#F5A6A7`   | `#6B1414`  | Medium tint          |
| 4       | `#FCDADA`   | `#8B1A1A`  | Warm light tint      |

**Muslim (Green family) — base `#64AA3E`:**

| Variant | Background  | Text Color | CSS/Tailwind Approach |
|---------|-------------|------------|----------------------|
| 1       | `#E2F2DA`   | `#3D6625`  | Lightest tint        |
| 2       | `#C6E5B8`   | `#3D6625`  | Light tint           |
| 3       | `#AAD896`   | `#2E4D1C`  | Medium tint          |
| 4       | `#D8EDCF`   | `#3D6625`  | Cool light tint      |

**Other (Yellow/Gold family) — base `#FBAF40`:**

| Variant | Background  | Text Color | CSS/Tailwind Approach |
|---------|-------------|------------|----------------------|
| 1       | `#FEF0D8`   | `#7A5410`  | Lightest tint        |
| 2       | `#FDE1B1`   | `#7A5410`  | Light tint           |
| 3       | `#FCD28A`   | `#5C3F0C`  | Medium tint          |
| 4       | `#FDE9C5`   | `#7A5410`  | Warm light tint      |

---

## Implementation Plan

### Scope

This is a **frontend-only change**. No backend or database modifications needed — the `religion` field already flows through the full data pipeline from Excel upload to the rendered components.

### Files to Change

| File | Change |
|------|--------|
| `frontend/tailwind.config.js` | Add custom BBT color palette under `theme.extend.colors` |
| `frontend/src/constants/colors.ts` | **New file.** Centralized religion→color mapping, shared between components |
| `frontend/src/components/CompactAssignments/CompactAssignments.tsx` | Replace `getPersonColor(name)` with religion-based color function |
| `frontend/src/components/TableAssignments/TableAssignments.tsx` | Update `getReligionColor()` to use BBT palette instead of generic Tailwind colors |
| `frontend/src/components/CompactAssignments/__tests__/CompactAssignments.test.tsx` | Update tests for new color behavior |
| `frontend/src/components/TableAssignments/__tests__/TableAssignments.test.tsx` | Update tests for new color values |

### 1. Define BBT Color Constants

Create `frontend/src/constants/colors.ts`:

```typescript
import { Religion } from '@/types/roster'

// Standard Building Bridges Together brand colors
export const BBT_COLORS = {
  Jewish:    { base: '#009EDB', bg: '#D6F0FB', text: '#005F83' },
  Christian: { base: '#E9282B', bg: '#FDE2E2', text: '#8B1A1A' },
  Muslim:    { base: '#64AA3E', bg: '#E2F2DA', text: '#3D6625' },
  Other:     { base: '#FBAF40', bg: '#FEF0D8', text: '#7A5410' },
} as const

// Shade variants for Option B (varied shades within religion)
// Each religion has 4 background variants; text color stays consistent per religion
export const BBT_SHADE_VARIANTS: Record<Religion, { bg: string; text: string }[]> = {
  Jewish: [
    { bg: '#D6F0FB', text: '#005F83' },
    { bg: '#B0E0F6', text: '#005F83' },
    { bg: '#8AD0F1', text: '#004A66' },
    { bg: '#CCE8F4', text: '#005F83' },
  ],
  Christian: [
    { bg: '#FDE2E2', text: '#8B1A1A' },
    { bg: '#F9C4C4', text: '#8B1A1A' },
    { bg: '#F5A6A7', text: '#6B1414' },
    { bg: '#FCDADA', text: '#8B1A1A' },
  ],
  Muslim: [
    { bg: '#E2F2DA', text: '#3D6625' },
    { bg: '#C6E5B8', text: '#3D6625' },
    { bg: '#AAD896', text: '#2E4D1C' },
    { bg: '#D8EDCF', text: '#3D6625' },
  ],
  Other: [
    { bg: '#FEF0D8', text: '#7A5410' },
    { bg: '#FDE1B1', text: '#7A5410' },
    { bg: '#FCD28A', text: '#5C3F0C' },
    { bg: '#FDE9C5', text: '#7A5410' },
  ],
}

// djb2 hash (same as current implementation) for consistent per-name shade selection
function hashName(name: string): number {
  let hash = 5381
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash) + name.charCodeAt(i)
  }
  return Math.abs(hash)
}

/**
 * Get religion-based color for a participant.
 * Returns inline style object (not Tailwind classes) since BBT colors
 * are custom values that don't map to default Tailwind palette.
 *
 * If `varied` is true (Option B), uses name hash to select a shade variant.
 * If `varied` is false (Option A), uses the single base shade.
 */
export function getReligionStyle(
  religion: string,
  name: string,
  varied: boolean = true
): { backgroundColor: string; color: string } {
  const religionKey = (religion in BBT_SHADE_VARIANTS ? religion : 'Other') as Religion

  if (!varied) {
    const base = BBT_COLORS[religionKey]
    return { backgroundColor: base.bg, color: base.text }
  }

  const variants = BBT_SHADE_VARIANTS[religionKey]
  const index = hashName(name) % variants.length
  return { backgroundColor: variants[index].bg, color: variants[index].color }
}
```

### 2. Update Compact View

In `CompactAssignments.tsx`, replace the `getPersonColor` function and switch from Tailwind class-based coloring to inline styles:

```typescript
// Before
const colorClass = getPersonColor(participant.name)
// ...
className={`px-2 py-1 rounded text-xs font-medium ${colorClass} ...`}

// After
const religionStyle = getReligionStyle(participant.religion, participant.name)
// ...
className="px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer ..."
style={religionStyle}
```

The hover darkening effect (currently via `hover:bg-*-200`) would need to be handled differently with inline styles — either via a CSS class that applies `filter: brightness(0.92)` on hover, or by computing a hover color. A simple approach:

```css
/* In index.css or a component-scoped style */
.religion-chip:hover {
  filter: brightness(0.92);
}
```

### 3. Update Detailed View

In `TableAssignments.tsx`, update the `getReligionColor()` function to return BBT-based styles for the religion badge:

```typescript
// Before: returns Tailwind classes
const getReligionColor = (religion: string): string => {
  const colors: { [key: string]: string } = {
    'Christian': 'bg-green-100 text-green-800',
    // ...
  }
  return colors[religion] || 'bg-gray-100 text-gray-800'
}

// After: returns inline style using BBT colors (flat, no variation — badges don't need it)
const getReligionBadgeStyle = (religion: string) => {
  return getReligionStyle(religion, '', false)  // flat color for badges
}
```

Additionally, **color the participant name background** in the detailed view to match the compact view, giving both views consistent religion-based name coloring:

```typescript
// Current: plain text name
<span className="font-medium">{participant.name}</span>

// Proposed: name gets a subtle religion-tinted background
<span
  className="font-medium px-1.5 py-0.5 rounded"
  style={getReligionStyle(participant.religion, participant.name)}
>
  {participant.name}
</span>
```

### 4. Add Color Legend

Add a small legend to both views showing the color-religion mapping. This is especially important for first-time users and for the shade-variation approach where the exact shade differs per person.

```
┌─────────────────────────────────────────────────────┐
│  ● Jewish    ● Christian    ● Muslim    ● Other     │
│   (blue)      (red)         (green)     (yellow)    │
└─────────────────────────────────────────────────────┘
```

Implementation: a small row of colored dots/chips with labels, rendered above the assignments grid. Uses the base BBT color (not a variant) for the legend dot.

```typescript
const ColorLegend: React.FC = () => (
  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-3">
    {Object.entries(BBT_COLORS).map(([religion, colors]) => (
      <div key={religion} className="flex items-center gap-1.5">
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ backgroundColor: colors.base }}
        />
        <span>{religion}</span>
      </div>
    ))}
  </div>
)
```

---

## Affected Features

### Participant Highlighting (Compact View)

The "click a name to highlight across sessions" feature currently uses a blue ring (`ring-2 ring-blue-500`). This should continue to work unchanged — the ring overlays the background color regardless of whether it's hash-based or religion-based.

However, since Jewish participants will have blue backgrounds, the blue highlight ring may not be as visible. Consider switching the highlight ring to a neutral color:

```typescript
// Current
'ring-2 ring-blue-500 ring-offset-1'

// Proposed: neutral dark ring that contrasts against all BBT colors
'ring-2 ring-gray-800 ring-offset-1'
```

### Hover Tooltips (Compact View)

The tooltip currently shows `religion, gender`. With religion now encoded in the color, the tooltip remains useful for confirming religion and showing gender/partner info, but religion is no longer tooltip-only information.

### Print Styles

The compact view is not typically printed (seating charts are the print path), so no print-specific changes are needed. The detailed view's religion badge color update will carry through to print naturally.

### Edit Mode (Detailed View)

The drag-and-swap edit mode highlights participants with blue/green/amber rings for selection states. These ring colors should remain distinguishable against the new BBT background colors. The current ring colors (blue for selected, green for swap target, amber for absent placement) will work fine since they are border effects, not background colors.

---

## Tailwind vs. Inline Styles

Since the BBT colors are custom brand values that don't correspond to default Tailwind palette stops, the implementation has two approaches:

### Approach A: Inline Styles (Recommended)

Use `style={{ backgroundColor: '...', color: '...' }}` directly. This is simpler, requires no Tailwind config changes, and makes the exact brand colors explicit in the code.

**Tradeoff:** Loses Tailwind's `hover:` pseudo-class support — need a CSS class or JavaScript for hover states.

### Approach B: Custom Tailwind Colors

Add BBT colors to `tailwind.config.js`:

```javascript
colors: {
  bbt: {
    blue:   { 100: '#D6F0FB', 200: '#B0E0F6', 300: '#8AD0F1', 800: '#005F83' },
    red:    { 100: '#FDE2E2', 200: '#F9C4C4', 300: '#F5A6A7', 800: '#8B1A1A' },
    green:  { 100: '#E2F2DA', 200: '#C6E5B8', 300: '#AAD896', 800: '#3D6625' },
    gold:   { 100: '#FEF0D8', 200: '#FDE1B1', 300: '#FCD28A', 800: '#7A5410' },
  }
}
```

**Tradeoff:** More setup, but gets full Tailwind utility support (`hover:bg-bbt-blue-200`, etc.).

Given that the color usage is confined to a small set of components and the hover behavior is simple, **inline styles with a brightness hover class** is the simpler approach.

---

## Testing Strategy

### Unit Tests

```typescript
// constants/colors.test.ts
test('getReligionStyle returns blue family for Jewish', () => {
  const style = getReligionStyle('Jewish', 'Sarah')
  // Background should be one of the Jewish blue variants
  expect(style.backgroundColor).toMatch(/^#(D6F0FB|B0E0F6|8AD0F1|CCE8F4)$/)
  expect(style.color).toMatch(/^#00(5F83|4A66)$/)
})

test('same name always gets same shade', () => {
  const style1 = getReligionStyle('Muslim', 'Ahmed')
  const style2 = getReligionStyle('Muslim', 'Ahmed')
  expect(style1).toEqual(style2)
})

test('different names can get different shades within same religion', () => {
  // Not guaranteed for any two names, but statistically likely over many
  const styles = new Set(
    ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Hank']
      .map(name => getReligionStyle('Christian', name).backgroundColor)
  )
  expect(styles.size).toBeGreaterThan(1)
})

test('unknown religion falls back to Other colors', () => {
  const style = getReligionStyle('Zoroastrian', 'Cyrus')
  const otherStyle = getReligionStyle('Other', 'Cyrus')
  expect(style).toEqual(otherStyle)
})

test('flat mode returns consistent base color regardless of name', () => {
  const style1 = getReligionStyle('Jewish', 'Sarah', false)
  const style2 = getReligionStyle('Jewish', 'David', false)
  expect(style1).toEqual(style2)
})
```

### Component Tests

```typescript
// CompactAssignments.test.tsx
test('participant buttons have religion-based background colors', () => {
  render(<CompactAssignments assignments={mockAssignments} />)
  const button = screen.getByText('Sarah Cohen')
  // Should have inline style with a Jewish-blue background
  expect(button).toHaveStyle({ backgroundColor: expect.stringMatching(/#/) })
})

test('color legend is displayed', () => {
  render(<CompactAssignments assignments={mockAssignments} />)
  expect(screen.getByText('Jewish')).toBeInTheDocument()
  expect(screen.getByText('Christian')).toBeInTheDocument()
  expect(screen.getByText('Muslim')).toBeInTheDocument()
  expect(screen.getByText('Other')).toBeInTheDocument()
})
```

### Visual/Manual Testing

- Verify color contrast meets readability standards (dark text on light tinted backgrounds)
- Check that all 4 religion colors are distinguishable from each other
- Confirm the highlight ring is visible against all background colors
- Test with real BBT roster data to validate realistic distributions
- Verify hover darkening effect works across all colors

---

## Accessibility Considerations

- **Color blindness:** The BBT palette (blue, red, green, yellow) presents challenges for red-green color blindness (protanopia/deuteranopia). However, the existing tooltip and detailed-view badges provide text-based religion information as a fallback. The color legend also includes text labels.
- **Contrast ratios:** All text/background combinations in the shade variant table should meet WCAG AA (4.5:1 for normal text). The darkened text colors are chosen to ensure this. Should be validated during implementation.
- **Non-color indicators:** The detailed view retains explicit religion text badges, so color is not the sole indicator of religion in that view.

---

## Edge Cases

1. **Unknown religion values** — Any religion not in `{Jewish, Christian, Muslim, Other}` falls back to the "Other" (yellow/gold) palette. The `getReligionStyle` function handles this via the fallback.

2. **Absent participants** — Currently rendered with `opacity-60`. This should continue to work with religion-based colors; the opacity reduces the color intensity but maintains the hue, so religion is still parseable.

3. **Empty name string** — The hash function handles empty strings (returns consistent value). Not expected in practice since names are validated on upload.

4. **Very long religion strings** — Only affects the fallback path. Not a concern since the roster type constrains religion to the 4 known values.

---

## Open Questions

1. **Flat vs. varied shades?** — Option B (varied) is recommended in this doc, but this is a UX preference call. Could implement Option A first for simplicity and add variation later if the flat look feels too monotone.

2. **Should the detailed view name also get a colored background?** — Currently names are plain text with separate religion/gender badges below. Adding a religion-tinted background to the name itself would make detailed view consistent with compact view, but may feel visually heavy. Could keep it as-is (badges only) or add a subtle background.

3. **Hover state implementation** — CSS `filter: brightness()` vs. computed darker color vs. Tailwind custom classes. Minor implementation detail to resolve during development.

---

## Implementation Scope

### In Scope
- Replace hash-based coloring in CompactAssignments with religion-based BBT colors
- Update religion badge colors in TableAssignments to use BBT palette
- Add color legend component
- Centralize color constants in shared module
- Update highlight ring color for contrast against blue backgrounds
- Update existing tests

### Out of Scope
- Backend changes (none needed)
- User-configurable color preferences
- Color coding by gender (separate feature if ever requested)
- Dark mode color variants (no dark mode currently)
- Exporting/printing compact view

---

## Dependencies

- Existing `religion` field in participant data model (already present end-to-end)
- Existing `Religion` type definition in `frontend/src/types/roster.ts`
- No new library dependencies

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Red-green color blindness makes Christian/Muslim hard to distinguish | Med | Med | Text labels in legend + tooltip + detailed view badges provide non-color fallback |
| Shade variations too subtle to read as "same religion" | Low | Low | Legend helps; can fall back to flat colors if feedback is negative |
| Inline styles break hover/focus states | Low | Med | Use CSS class for hover brightness filter; test across browsers |
| Existing tests rely on specific Tailwind color classes | Low | High | Update tests to check inline styles instead of class names |

---

## Notes

- The compact view is the primary target — it's the view facilitators use most for at-a-glance distribution checks
- The detailed view already communicates religion via badges; updating badge colors to BBT palette is a nice-to-have alignment
- The `getReligionStyle` utility function is designed to be reusable if other components (e.g., seating charts) want religion-based coloring in the future
- Real BBT hex values should be validated against the official brand guide if one exists
