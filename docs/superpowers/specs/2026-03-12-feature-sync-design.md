# Feature Sync: Persimmon → Balfour Beatty

Bring the Balfour Beatty signage portal to feature parity with Persimmon by porting 11 features added after the original rebrand.

## Approach

Direct port — copy each Persimmon file and mechanically adapt:
- Table references: `psp_` → `bal_`
- Inline HTML brand colors: `#00474a` → `#002b49`, `#3db28c` → `#005d99`
- Default secret fallback: `"psp-raise-po-default"` → `"bal-raise-po-default"`
- Add `brand: "balfour"` to all Make.com webhook payloads for routing
- Email system stays as Resend (Balfour) — do NOT port Nodemailer from Persimmon

Pages with zero brand-specific content (checkout, orders) are copied as-is since they use CSS variables already mapped to Balfour colors.

## Constraints

- Same Make.com webhook as Persimmon; `brand` field enables scenario-level filtering
- You (user) run the SQL migration manually
- You (user) set `MAKE_WEBHOOK_URL` and `RAISE_PO_SECRET` env vars in Vercel and local `.env`

## 1. Database Migration

Deliverable: `docs/migrations/feature-sync.sql`

```sql
CREATE TABLE IF NOT EXISTS bal_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  phone        TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bal_sites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  address      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bal_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bal_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_bal_contacts" ON bal_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_bal_sites" ON bal_sites FOR ALL USING (true) WITH CHECK (true);

-- Add awaiting_po to the status CHECK constraint
ALTER TABLE bal_orders DROP CONSTRAINT IF EXISTS bal_orders_status_check;
ALTER TABLE bal_orders ADD CONSTRAINT bal_orders_status_check
  CHECK (status IN ('new','awaiting_po','in-progress','completed','cancelled'));

ALTER TABLE bal_orders ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES bal_contacts(id);
ALTER TABLE bal_orders ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES bal_sites(id);
CREATE INDEX IF NOT EXISTS idx_bal_orders_contact_id ON bal_orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_bal_orders_site_id ON bal_orders(site_id);

-- Safety no-op: custom_data already exists in the base schema but included for environments
-- where the column may have been dropped or never created
ALTER TABLE bal_order_items ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT NULL;
```

Rollback (if needed):
```sql
DROP INDEX IF EXISTS idx_bal_orders_contact_id;
DROP INDEX IF EXISTS idx_bal_orders_site_id;
ALTER TABLE bal_orders DROP COLUMN IF EXISTS contact_id;
ALTER TABLE bal_orders DROP COLUMN IF EXISTS site_id;
ALTER TABLE bal_orders DROP CONSTRAINT IF EXISTS bal_orders_status_check;
ALTER TABLE bal_orders ADD CONSTRAINT bal_orders_status_check
  CHECK (status IN ('new','in-progress','completed','cancelled'));
DROP TABLE IF EXISTS bal_contacts CASCADE;
DROP TABLE IF EXISTS bal_sites CASCADE;
```

## 2. New API Routes

### `shop/app/api/contacts/route.ts` (new file)

- Copy from Persimmon `shop/app/api/contacts/route.ts`
- Replace `"psp_contacts"` → `"bal_contacts"`
- GET: list all contacts ordered by name (requires shop or admin auth)
- POST: upsert by email — returns existing contact if email matches, else creates new

### `shop/app/api/sites/route.ts` (new file)

- Copy from Persimmon `shop/app/api/sites/route.ts`
- Replace `"psp_sites"` → `"bal_sites"`
- GET: list all sites ordered by name (requires shop or admin auth)
- POST: upsert by name — returns existing site if name matches, else creates new

### `shop/app/api/orders/[orderNumber]/raise-po/route.ts` (new file)

- Copy from Persimmon
- Replace `"psp_orders"` → `"bal_orders"`, `"psp_order_items"` → `"bal_order_items"`
- Update inline HTML colors: `#00474a` → `#002b49`, `#3db28c` → `#005d99`
- Add `brand: "balfour"` to webhook payload
- GET endpoint: validates HMAC token, checks order is "new", updates to "awaiting_po", fires Make webhook with `isPO: true`, returns branded confirmation HTML

### `shop/app/api/orders/[orderNumber]/send-to-nest/route.ts` (new file)

- Copy from Persimmon
- Replace `"psp_orders"` → `"bal_orders"`, `"psp_order_items"` → `"bal_order_items"`
- Add `brand: "balfour"` to webhook payload
- POST endpoint (admin only): allows "new" or "awaiting_po" status, fires Make webhook with `isPO: true`, updates status to "awaiting_po" if currently "new"

## 3. Modified Files

### `shop/lib/email.ts`

Add three things to the existing Balfour email module:

1. **`itemRowsHtml` signature change** — add optional `siteUrl?: string` parameter. When provided, use absolute image URLs (`${siteUrl}/images/products/...`) instead of CID references. This is needed for webhook email HTML which doesn't use inline attachments.

2. **`buildNestPOEmailHtml(order, siteUrl, raisePoUrl?)` export** — builds PO request email HTML with:
   - Balfour navy header (`#002b49`)
   - Absolute image URLs (via `itemRowsHtml` with `siteUrl`)
   - Optional "Raise PO" button when `raisePoUrl` is provided (blue `#005d99` button instead of Persimmon's green)
   - Returns `{ subject, html }`

3. **`generateRaisePoToken(orderNumber)` export** — HMAC-SHA256 with `RAISE_PO_SECRET` env var, returns first 16 hex chars. Fallback secret: `"bal-raise-po-default"`.

### `shop/app/api/orders/route.ts`

**POST handler changes:**
- Add `contactId`, `siteId` to body destructuring (line 22)
- Add `contact_id: contactId || null`, `site_id: siteId || null` to insert object
- Import `buildNestPOEmailHtml` and `generateRaisePoToken` from email.ts
- After email sends, fire Make.com webhook with: `isPO: false`, raise-po URL, order metadata, `brand: "balfour"`

**GET handler changes:**
- Add `contactId: o.contact_id || null`, `siteId: o.site_id || null` to response transform

### `shop/app/(shop)/admin/page.tsx`

Add to the existing admin page:
- State: `sendingToNest`, `nestError`
- `sendToNest(orderNumber)` function — POSTs to `/api/orders/${orderNumber}/send-to-nest`, updates local order status on success
- `awaiting_po` entry in `statusColors` map: `"bg-yellow-50 text-yellow-600"`
- `statusLabels` map (new): maps status keys to display labels including "Awaiting PO"
- "awaiting_po" added to filter button array
- "Send to Nest" / "Re-send to Nest" yellow button in expanded order detail (visible for "new" and "awaiting_po" orders)
- Nest error banner below action buttons
- "Awaiting PO" option in status dropdown
- Clear nest error on order expand/collapse

### `shop/app/api/orders/[orderNumber]/route.ts`

Add `"awaiting_po"` to the `validStatuses` array in the PATCH handler so the admin status dropdown can set this status.

## 4. Replaced Pages

### `shop/app/(shop)/checkout/page.tsx`

Full replacement — copy Persimmon's version as-is. Key features being added:
- Contact dropdown selector with "Add new contact" inline form
- Site dropdown selector with "Add new site" inline form
- Fetches from `/api/contacts` and `/api/sites` on mount
- Sends `contactId` and `siteId` with order submission
- All styling uses CSS variables (no brand-specific colors)

### `shop/app/(shop)/orders/page.tsx`

Full replacement — copy Persimmon's version as-is. Key features being added:
- Site bento cards with status pill breakdown and order count
- Contact filter pills with avatar initials and order count
- `awaiting_po` status in config and filter buttons
- Combined filtering: contact + site + status + search
- All styling uses CSS variables (no brand-specific colors)

## 5. Files Changed Summary

| File | Action | Changes |
|------|--------|---------|
| `docs/migrations/feature-sync.sql` | New | Migration SQL for user to run |
| `shop/app/api/contacts/route.ts` | New | `psp_` → `bal_` |
| `shop/app/api/sites/route.ts` | New | `psp_` → `bal_` |
| `shop/app/api/orders/[orderNumber]/raise-po/route.ts` | New | `psp_` → `bal_`, brand colors, `brand: "balfour"` |
| `shop/app/api/orders/[orderNumber]/send-to-nest/route.ts` | New | `psp_` → `bal_`, `brand: "balfour"` |
| `shop/lib/email.ts` | Modify | Add `buildNestPOEmailHtml`, `generateRaisePoToken`, update `itemRowsHtml` |
| `shop/app/api/orders/route.ts` | Modify | Add contactId/siteId, Make webhook |
| `shop/app/api/orders/[orderNumber]/route.ts` | Modify | Add `awaiting_po` to validStatuses |
| `shop/app/(shop)/admin/page.tsx` | Modify | Send to Nest, awaiting_po status |
| `shop/app/(shop)/checkout/page.tsx` | Replace | Contact/site dropdowns |
| `shop/app/(shop)/orders/page.tsx` | Replace | Bento cards, contact pills |

## 6. Webhook Details

### Payload schema (shared with Persimmon, plus `brand`)

All webhook calls include these fields:

```json
{
  "brand": "balfour",
  "isPO": false,
  "emailSubject": "PO Request — BAL-20260312-XXXX — Site Name",
  "emailHtml": "<div>...</div>",
  "orderNumber": "BAL-20260312-XXXX",
  "contactName": "...",
  "contactEmail": "...",
  "contactPhone": "...",
  "siteName": "...",
  "siteAddress": "...",
  "poNumber": "...",
  "notes": "...",
  "subtotal": 100.00,
  "vat": 20.00,
  "total": 120.00,
  "itemCount": 3,
  "hasCustomItems": false
}
```

- **Orders POST** (`isPO: false`): also includes `raisePoUrl` — the signed link for the email "Raise PO" button
- **Raise PO GET** (`isPO: true`): no `raisePoUrl` (PO is being raised right now)
- **Send to Nest POST** (`isPO: true`): no `raisePoUrl` (admin-initiated send)

There are two distinct Make.com handling paths: `isPO: false` (initial order notification) and `isPO: true` (PO action). Both raise-po and send-to-nest send `isPO: true` because they trigger the same downstream flow — sending the order to Nest for PO processing. The `brand` field routes Persimmon vs Balfour to different recipients/channels.

### Error handling

Webhook calls in the **Orders POST** handler are fire-and-forget: `.catch(e => console.error(...))`. The order saves and emails send regardless of webhook success.

Webhook calls in **raise-po** and **send-to-nest** check `res.ok` and return errors to the caller if the webhook fails, since the webhook IS the primary action in those routes.

### Raise PO rendering

The raise-po route uses `buildNestPOEmailHtml(orderData, siteUrl)` (without `raisePoUrl`) to build the webhook email HTML. The confirmation and "already raised" pages visible to the user are separate inline HTML templates with Balfour brand colors.

## 7. Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `MAKE_WEBHOOK_URL` | Make.com webhook URL (shared with Persimmon) |
| `RAISE_PO_SECRET` | HMAC secret for raise-po email links |

## 8. Verification

After implementation, run `next build` to confirm no TypeScript/build errors. Full functional testing per the guide's checklist requires the database migration and env vars to be in place.
