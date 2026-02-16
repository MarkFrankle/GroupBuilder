# Frontend Design Conventions

## Buttons

- **Always use `variant="outline"` on all buttons.** This is the app's visual style — no filled/default buttons. Applies everywhere: toolbars, dialogs, forms, alerts.
- Use `size="sm"` for toolbar buttons.
- Use icon + label for action buttons (e.g., `<Printer className="h-4 w-4 mr-2" /> Print Roster`).
- Icon-only buttons (like the ellipsis menu trigger) omit the label but keep the same size/variant.
