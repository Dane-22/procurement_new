# Items Pricing History Tab (Frontend + Backend Implementation)

## Frontend (already added)

### Where it lives

- **UI + navigation**: `frontend/src/App.jsx`
  - New nav id: `pricing-history`
  - New page component: `PricingHistory`
  - Rendered for roles:
    - `engineer`
    - `procurement`
    - `admin`
    - `superadmin`

### Data fetching

- **Service method**: `frontend/src/services/items.js`
  - `itemService.getPricingHistory(params = {})`
  - Calls: `GET /items/pricing-history`

### What the UI expects

The table displays each row as a separate entry (no grouping), so **duplicate items are allowed** and will show as multiple rows.

The component reads these fields (best-effort):

- `item_code`
- `item_name` (fallback: `name`)
- `price` (fallback: `unit_price`, `unit_cost`)

If `price` is numeric, the UI formats it as PHP currency.

## Backend (to implement next)

### Endpoint

Implement an endpoint that returns a flat list of price history records.

- **Method**: `GET`
- **Path**: `/api/items/pricing-history`

> Your frontend Axios base URL is controlled by `VITE_API_URL` in `frontend/src/services/api.js`.

### Response shape (recommended)

Return **one row per price record**.

```json
{
  "history": [
    {
      "id": 10,
      "item_id": 1,
      "item_code": "ITM001",
      "item_name": "Item 1",
      "price": 100,
      "created_at": "2026-02-28T00:00:00.000Z"
    },
    {
      "id": 11,
      "item_id": 1,
      "item_code": "ITM001",
      "item_name": "Item 1",
      "price": 120,
      "created_at": "2026-03-01T00:00:00.000Z"
    }
  ]
}
```

This satisfies the requirement:

- Same item can appear multiple times with different prices
- The frontend will render duplicates as separate rows

### Data source (recommended)

If you already have PR/PO item tables that store unit prices, you can derive pricing history from them.

Common options:

- **Option A: dedicated table** `item_price_history`
  - `id`
  - `item_id`
  - `price`
  - `source_type` (e.g., `purchase_request`, `purchase_order`)
  - `source_id`
  - `created_at`

- **Option B: derive from existing transactional tables**
  - Purchase request items (`purchase_request_items`) with `unit_price`
  - Purchase order items with `unit_price`

If you choose Option B, make sure the query returns **multiple rows per item** (no `GROUP BY item_id`).

### Sorting

Recommended default sorting:

- newest first: `ORDER BY created_at DESC`

### Optional query params (supported by frontend)

The frontend service passes `params`, so you can support:

- `search`: search by item code/name
- `item_id`: filter a single item
- `from`, `to`: date range
- `limit`, `offset`: pagination

Example:

`GET /api/items/pricing-history?search=itm001&from=2026-01-01&to=2026-12-31`

## Hooking it up end-to-end

- Ensure your backend route is mounted under `/api`.
- Ensure the frontend `VITE_API_URL` points to your backend API base.
- Open the app and click **Pricing History** in the sidebar.

## Notes

- The UI intentionally does **not** de-duplicate rows.
- If your backend returns `{ items: [...] }` or a raw array, the frontend still tries to render it, but the recommended shape is `{ history: [...] }`.
