# Load / Stress Test Readiness TODO

## Goals

- Prevent unbounded queries / payloads that will bottleneck with millions of rows.
- Ensure MySQL + API can sustain target concurrency with predictable latency.
- Produce repeatable load/stress test scenarios and measurable pass/fail criteria.

## Backend API TODOs (before load testing)

### 1) Add pagination to all list endpoints

- **Add query params**
  - `page` (default `1`)
  - `pageSize` (default `20`, max `100`)
- **Implement `LIMIT` / `OFFSET`** in SQL.
- **Return metadata**
  - `page`, `pageSize`
  - `total` (via separate `COUNT(*)` query)
- **Endpoints to prioritize (currently unbounded)**
  - `GET /purchaseRequests`
  - `GET /purchaseOrders`
  - `GET /disbursementVouchers`
  - `GET /employees`
  - `GET /items`
  - `GET /suppliers`
  - `GET /categories`

### 2) Add server-side filtering (default constraints)

- Add optional filters like:
  - **date range** (e.g. `from`, `to`) and default to last 30/90 days for admin/proc views.
  - **status** filters where applicable.
  - **search** (name/code/number) using indexed columns.

### 3) Validate/optimize indexing for common access patterns

- Ensure indexes exist for:
  - `purchase_requests.created_at`
  - `purchase_requests.requested_by, created_at` (composite if filtering by requester and ordering)
  - `purchase_orders.created_at`
  - `disbursement_vouchers.created_at`
  - foreign keys used in joins (all `*_id` columns)
- Confirm `ORDER BY ... DESC` queries use an index (check with `EXPLAIN`).

### 4) Review heavy JOIN endpoints

- Identify endpoints that join many tables (e.g. disbursement vouchers list).
- Ensure joined columns are indexed.
- Consider returning “summary list” fields only, and fetch “details” on-demand.

### 5) Connection pool sizing & query timeouts

- Current pool config shows `connectionLimit: 10`.
- Decide target concurrency and adjust pool size accordingly.
- Add sensible timeouts / guardrails where appropriate:
  - Request timeout (API gateway / reverse proxy)
  - DB query timeout (if supported / configured)

### 6) Add observability for testing

- Add request logging with:
  - route name
  - status code
  - response time
- Enable MySQL slow query log in staging/test.
- Capture:
  - p95 / p99 latency per endpoint
  - DB CPU / connections in use
  - slow queries
  - error rate

## Load/Stress Test Plan

### 1) Define target traffic

- **Target concurrent users**: (fill in)
- **Target RPS**: (fill in)
- **SLOs (example)**
  - p95 < 500ms for list endpoints (paged)
  - p99 < 1500ms
  - error rate < 1%

### 2) Test scenarios (API-focused)

- **Auth + list browsing**
  - `POST /auth/login`
  - `GET /purchaseRequests?page=1&pageSize=20`
  - `GET /purchaseOrders?page=1&pageSize=20`
- **Create PR flow (write path)**
  - create draft
  - add/update items
  - submit PR
- **Procurement/admin dashboard**
  - `GET /reports/dashboard`
- **Notifications polling**
  - `GET /notifications` (already limited to 50)

### 3) Test phases

- **Smoke**
  - low concurrency, validate scripts & environment
- **Load (steady state)**
  - hold target concurrency for 10–30 minutes
- **Stress (step-up)**
  - increase concurrency until p95/p99 degrade or errors spike
- **Soak**
  - moderate sustained load for 1–4 hours to detect leaks / slow degradation

### 4) What to measure

- **API**
  - p50 / p95 / p99 latency per endpoint
  - RPS / throughput
  - error rate
- **Database**
  - connections in use / pool wait time
  - slow query log entries
  - lock waits
  - CPU, IO
- **App server (Node)**
  - CPU, memory
  - event loop lag (optional)

## Environment & Data

- Run tests against a **staging environment** with production-like settings.
- Use a dataset that matches expected scale (row counts, distributions).
- Make sure test users/roles exist:
  - engineer
  - procurement
  - admin
  - super admin

## Exit Criteria (fill in)

- p95 latency: (fill in)
- p99 latency: (fill in)
- Max error rate: (fill in)
- Max DB CPU/IO: (fill in)
- No critical slow queries identified during steady-state load.
