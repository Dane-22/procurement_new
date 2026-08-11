# Preview Modals Review (UI/UX)

This note documents issues found in the current “Preview” modals across the frontend. The main theme is that most previews are intentionally built with an Excel/spreadsheet-like grid (heavy borders + rigid 12-col rows), which makes them feel less like a modern “preview” and more like a data sheet.

## Where the Excel/spreadsheet look comes from

Most preview components use:
- A border-wrapped container: `border border-gray-300 rounded overflow-hidden`
- Repeated “row” blocks: `grid grid-cols-12 border-b border-gray-300`
- Label cells: `bg-gray-50 text-xs font-semibold ... uppercase` + right borders
- Value cells: `border-r border-gray-300` and tight padding

Files using the “Excel-style Form Layout” approach:
- `frontend/src/components/purchase-requests/PRPreviewModal.jsx`
- `frontend/src/components/purchase-orders/POPreviewModal.jsx`
- `frontend/src/components/service-requests/SRPreviewModal.jsx`
- `frontend/src/components/cash-requests/CRPreviewModal.jsx`
- `frontend/src/components/payment-requests/PaymentRequestPreviewModal.jsx`
- `frontend/src/components/disbursement-vouchers/DVPreviewModal.jsx`

Files that already look more like a modern preview (less “Excel”):
- `frontend/src/components/payment-orders/POPreviewModal.jsx`
- `frontend/src/components/payment-orders/POApprovalPreviewModal.jsx`

## UI/UX issues

- **Spreadsheet-heavy styling**: full cell borders on every row/column + shaded header-like label cells read as a spreadsheet, not a preview.
- **Dense and rigid layout**: the 12-column grid + fixed label/value spans feel cramped and less responsive (especially on smaller screens).
- **Inconsistent preview experience across modules**: Payment Order preview uses a different visual pattern than PR/PO/SR/CR/DV/Payment Request previews.
- **Accidental close risk**: previews close when clicking the backdrop overlay. While common, it’s easy to misclick outside while scrolling/selecting text and lose context.

## Data/content issues

- `frontend/src/components/payment-requests/PaymentRequestPreviewModal.jsx`
  - **Duplicate “Payee Address” field** appears twice:
    - Row 2: “Status and Payee Address”
    - Row 3: “Payee Name and Address” (again includes “Payee Address”)

## Accessibility / interaction issues (current implementation style)

Most preview modals are implemented as plain `div` overlays, which typically means:
- **No focus trap** (tabbing can move to elements behind the modal)
- **No guaranteed ESC-to-close** behavior
- **No `aria-*` dialog semantics** (screen readers may not treat it as a dialog)
- **No scroll lock** on the page body (background can scroll depending on browser/layout)

## Code health / maintainability issues

Across the preview modal files listed above:
- **Copy-pasted helpers**: `formatCurrency`, `formatDate`, `StatusBadge`, and `Button` are repeated in many files.
- **Status color maps are duplicated and inconsistent** between modules (same statuses may render differently depending on which modal you’re in).
- **Hard to unify styling changes**: because each modal repeats the same grid markup, improving the design means editing multiple components.

## Note about Cash Request preview

There is already a Cash Request preview component:
- `frontend/src/components/cash-requests/CRPreviewModal.jsx`

It currently follows the same Excel/grid preview pattern as the other non-Payment-Order previews.

