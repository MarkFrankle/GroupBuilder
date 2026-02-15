# Styling Framework Proposal for GroupBuilder

**Date:** January 2026  
**Status:** Proposal  
**Scope:** Small application (~15 components, single developer/small team)

---

## Current State

The frontend currently uses **inline styles** via React's `style` prop:

```tsx
<div style={{ 
  minHeight: '100vh', 
  display: 'flex', 
  alignItems: 'center',
  backgroundColor: '#f9fafb' 
}}>
```

### Problems with Inline Styles

| Issue | Impact |
|-------|--------|
| Verbose | Each component has 20-50 lines of style objects |
| No hover/focus states | Can't do `:hover`, `:focus` without JS workarounds |
| No media queries | Responsive design requires JS-based breakpoints |
| No reuse | Same styles copied across components |
| Hard to theme | Color changes require find-and-replace |
| No pseudo-elements | Can't use `::before`, `::after` |

---

## Recommendation: **Tailwind CSS**

For a small project like GroupBuilder, **Tailwind CSS** is the ideal choice.

### Why Tailwind?

| Factor | Tailwind | CSS Modules | Styled Components |
|--------|----------|-------------|-------------------|
| Setup complexity | Low | Low | Medium |
| Learning curve | Low (utility names) | None | Medium (CSS-in-JS) |
| Bundle size | Small (purged) | Smallest | Larger (runtime) |
| Developer velocity | Fastest | Medium | Medium |
| Responsive design | Built-in | Manual | Manual |
| Dark mode | Built-in | Manual | Manual |
| Component co-location | Yes | Separate files | Yes |
| Suitable for small teams | ✅ Best | ✅ Good | ⚠️ Overhead |

### Before/After Example

**Current (inline styles):**
```tsx
<button
  style={{
    width: '100%',
    padding: '0.5rem 1rem',
    backgroundColor: loading ? '#9ca3af' : '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: loading ? 'not-allowed' : 'pointer',
    fontWeight: '500'
  }}
>
```

**With Tailwind:**
```tsx
<button
  className={`
    w-full px-4 py-2 rounded-md font-medium text-white
    ${loading 
      ? 'bg-gray-400 cursor-not-allowed' 
      : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'}
  `}
>
```

### Key Benefits for GroupBuilder

1. **Hover states work:** `hover:bg-blue-700`
2. **Focus rings for a11y:** `focus:ring-2 focus:ring-blue-500`
3. **Responsive built-in:** `md:flex-row` (column on mobile, row on desktop)
4. **Consistent spacing:** Uses 4px grid (`p-2` = 8px, `p-4` = 16px)
5. **Design tokens:** Colors like `blue-600` are consistent everywhere
6. **Tiny production bundle:** Only ships CSS you actually use

---

## Implementation Plan

### Phase 1: Setup (30 minutes)

```bash
cd frontend
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**tailwind.config.js:**
```js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Match current brand colors
        primary: {
          600: '#2563eb',
          700: '#1d4ed8',
        }
      }
    }
  },
  plugins: [],
}
```

**src/index.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Phase 2: Migrate Components (2-3 hours)

Priority order (based on complexity):
1. `LoginPage.tsx` - simple form
2. `AuthVerifyPage.tsx` - loading/error states
3. `LandingPage.tsx` - main upload form
4. `TableAssignmentsPage.tsx` - data table
5. Admin components

### Phase 3: Extract Common Patterns (1 hour)

Create reusable utility classes for repeated patterns:

```css
/* src/index.css */
@layer components {
  .btn-primary {
    @apply w-full px-4 py-2 bg-blue-600 text-white rounded-md font-medium
           hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
           disabled:bg-gray-400 disabled:cursor-not-allowed;
  }
  
  .card {
    @apply bg-white rounded-lg shadow-md p-6;
  }
  
  .page-container {
    @apply min-h-screen flex items-center justify-center bg-gray-50;
  }
}
```

---

## Alternative: CSS Modules

If the team prefers traditional CSS, **CSS Modules** is a good alternative:

```tsx
// LoginPage.module.css
.container {
  min-height: 100vh;
  display: flex;
  align-items: center;
}

// LoginPage.tsx
import styles from './LoginPage.module.css';
<div className={styles.container}>
```

**Pros:** Familiar CSS, scoped by default, no new syntax  
**Cons:** Separate files, more verbose, manual responsive design

---

## Not Recommended for This Project

### Styled Components / Emotion

```tsx
const Button = styled.button`
  background: ${props => props.loading ? '#9ca3af' : '#2563eb'};
`;
```

**Why not:** Runtime overhead, additional bundle size, overkill for 15 components.

### Material UI / Chakra UI

**Why not:** Heavy dependencies, opinionated design, learning curve. GroupBuilder has custom branding needs.

### Plain CSS

**Why not:** Global scope issues, no purging, harder to maintain.

---

## Estimated Effort

| Task | Time |
|------|------|
| Tailwind setup | 30 min |
| Migrate auth pages (3) | 1 hour |
| Migrate main pages (3) | 1.5 hours |
| Migrate admin pages (3) | 1 hour |
| Extract common patterns | 30 min |
| **Total** | **~4-5 hours** |

---

## Decision

**Recommended:** Tailwind CSS

- Fastest development velocity for small team
- Best-in-class responsive design and accessibility utilities  
- Minimal bundle size in production
- Easy to learn (just CSS class names)
- No runtime overhead

---

## Next Steps

1. [ ] Team reviews this proposal
2. [ ] Decision made (Tailwind vs CSS Modules vs status quo)
3. [ ] If Tailwind: Set up in a separate PR before migrating
4. [ ] Migrate components incrementally (can be done page-by-page)
