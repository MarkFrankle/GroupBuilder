# Frontend Design Conventions

## Buttons

- **Always use `variant="outline"` on all buttons.** This is the app's visual style — no filled/default buttons. Applies everywhere: toolbars, dialogs, forms, alerts.
- Use `size="sm"` for toolbar buttons.
- Use icon + label for action buttons (e.g., `<Printer className="h-4 w-4 mr-2" /> Print Roster`).
- Icon-only buttons (like the ellipsis menu trigger) omit the label but keep the same size/variant.

## Dialogs (Radix)

- **Always clean up `pointer-events` when closing a Dialog.** Radix Dialog sets `pointer-events: none` on `<body>` and sometimes fails to remove it, leaving the page unclickable. In `onOpenChange`, call `document.body.style.removeProperty('pointer-events')` when the dialog closes. Do the same on any button that programmatically closes the dialog.
