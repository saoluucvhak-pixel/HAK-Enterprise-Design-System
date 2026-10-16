# HAK Enterprise Design System V10.4

Reusable UI specification for offline Electron and HAK WebApps. This branch is a design/reference branch, not the production payroll branch.

## Theme identifiers
- `luxe` — **default**: V10.3 original navy + champagne, warm ivory. Do not overwrite original tokens.
- `classic` — teal / light or dark.
- `neutral` — business slate / light or dark.
- `champagne` — warm gold / light or dark.
- Theme and skin are independent user preferences; persist without altering business records.

## Reusable patterns
- Navigation: compact nested sidebar, keyboard-visible focus, active path, collapse, search.
- Data grid: filter bar, sorting, pagination, row selection, empty/loading/error states, keyboard navigation.
- Master–detail: list parent entities; detail child versions with status and validity; review and audit history; readonly on closed periods.
- Formula workspace: human-language explanation, raw expression, applied version and period, preview-only calculation, warnings.
- Salary by location: employee-period parent, DQ/QC/location rows as children; location totals then consolidated employee total. This is an approved target rule, **not yet implemented in the payroll engine**.

## Source of truth
Current working application branch: `feature/luong-hak-v10-4-enterprise-ui`.
Reusable assets in `design-system/` can be ported to other apps after integration tests. Do not import a mockup as business logic.

## QA acceptance
- All themes render in 1366×768 and 1920×1080.
- No horizontal overflow of modal controls; large tables scroll inside their region.
- Light and dark text/controls maintain usable contrast.
- Switching themes never mutates payroll data.
- Formula and payroll results remain unchanged until separate reviewed business logic release.
