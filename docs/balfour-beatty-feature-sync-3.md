# Balfour Beatty — Feature Sync Prompt #3

Copy everything below the line into Claude as a message in the Balfour Beatty project.

---

## Prompt

You are working on the Balfour Beatty signage portal. This codebase was copied from the Persimmon portal and rebranded. The Persimmon version has had significant new features added that this copy is missing. Your job is to port all of these features across, changing table prefixes from `psp_` to `bal_` and order prefix from `PER-` to `BAL-` where needed.

**Sync #1** covered: `awaiting_po` status, Send to Nest button, Make.com webhooks, Raise PO idempotency, contacts & sites tables, checkout dropdowns, and order page filter pills/bento cards.

**Sync #2** covered: purchasers table, PO upload/download, delivery note PDF generation, purchaser email flow, admin filters/search/doc links, mobile admin link, sticky header, login branding, CSS animations.

**This sync (#3)** covers everything added after sync #2.

---

### 1. Database Migration

Run in Supabase SQL editor first:

```sql
-- Delivery note document storage columns on orders
ALTER TABLE bal_orders ADD COLUMN IF NOT EXISTS dn_document_name TEXT;
ALTER TABLE bal_orders ADD COLUMN IF NOT EXISTS dn_document_data TEXT;
ALTER TABLE bal_orders ADD COLUMN IF NOT EXISTS dn_document_type TEXT;
```

No other schema changes required — `custom_data JSONB` on `bal_order_items` was already added in sync #2.

---

### 2. New Dependencies

Install the PDF generation library (used by Quote and Order List PDFs):

```bash
npm install @react-pdf/renderer
```

---

### 3. New Files — Copy from Persimmon

#### PDF Generation Libraries

| Persimmon File | Table Changes | Brand Changes |
|---|---|---|
| `shop/lib/quote-pdf.tsx` | None (receives data, no DB access) | Replace `#00474a` with BB navy `#002b49`, `#3db28c` with BB blue `#005d99`. Replace `OnesignIcon` SVG and company details (name, address, phone, website) with Balfour Beatty equivalents |
| `shop/lib/order-list-pdf.tsx` | None (receives data, no DB access) | Same brand replacements as quote-pdf. Artwork "Yes" colour `#3db28c` → `#005d99` |
| `shop/data/artwork-registry.json` | N/A | Replace product codes with Balfour's artwork-ready codes (or start with an empty `"codes": []` array) |

#### API Routes for PDFs

| Persimmon File | Table Changes |
|---|---|
| `shop/app/api/orders/[orderNumber]/quote/route.ts` | `"psp_orders"` → `"bal_orders"`, `"psp_order_items"` → `"bal_order_items"` |
| `shop/app/api/orders/[orderNumber]/order-list/route.ts` | `"psp_orders"` → `"bal_orders"`, `"psp_order_items"` → `"bal_order_items"` |

#### Delivery Note Upload/Download

| Persimmon File | Table Changes |
|---|---|
| `shop/app/api/orders/[orderNumber]/upload-dn/route.ts` | `"psp_orders"` → `"bal_orders"` |
| `shop/app/api/orders/[orderNumber]/download-dn/route.ts` | `"psp_orders"` → `"bal_orders"` |
| `shop/app/dn-upload/[orderNumber]/page.tsx` | No table refs — copy as-is |
| `shop/app/dn-upload/[orderNumber]/DnUploadForm.tsx` | No table refs — copy as-is |

**Important:** The `dn-upload` directory sits outside the `(shop)` route group — admin-only auth is checked in the API route, not the page.

#### Custom Size Pricing

| Persimmon File | Table Changes | Brand Changes |
|---|---|---|
| `shop/lib/custom-size-pricing.ts` | None (works with catalog data) | None — copy as-is |
| `shop/components/CustomSizeSection.tsx` | None (client component) | Uses Tailwind classes `text-persimmon-navy`, `text-persimmon-green`, `bg-persimmon-gray` etc. — these should already map to Balfour's Tailwind config if sync #2 set up brand CSS variables correctly |

---

### 4. Modified Files

#### `shop/app/api/orders/route.ts` — GET handler

Add the auto-correct logic for stuck `awaiting_po` orders (after fetching orders, before transforming):

```typescript
// Fix any orders stuck on awaiting_po that already have a PO uploaded
const stuckOrders = orders.filter(
  (o) => o.status === "awaiting_po" && o.po_document_name
);
if (stuckOrders.length > 0) {
  await supabase
    .from("bal_orders")
    .update({ status: "new" })
    .in("id", stuckOrders.map((o) => o.id));
  for (const o of stuckOrders) o.status = "new";
}
```

Add `dnDocumentName` to the response transform:

```typescript
dnDocumentName: o.dn_document_name || null,
```

#### `shop/app/api/orders/route.ts` — POST handler

Accept `customSizeData` on order items. In the items insert loop, pass through:

```typescript
custom_data: item.customSizeData || item.customSign || null,
```

#### `shop/app/api/orders/[orderNumber]/upload-po/route.ts`

Add the status transition — when a PO is uploaded and the order is `awaiting_po`, auto-advance to `new`:

```typescript
// Fetch current status so we only transition awaiting_po → new
const { data: current } = await supabase
  .from("bal_orders")
  .select("status")
  .eq("order_number", orderNumber)
  .single();

const updates: Record<string, string> = {
  po_document_name: file.name,
  po_document_data: base64,
  po_document_type: file.type,
};

if (current?.status === "awaiting_po") {
  updates.status = "new";
}
```

---

### 5. Updated Pages

#### `shop/app/(shop)/product/[code]/page.tsx`

Add the `CustomSizeSection` component. Import and render below the standard variant selector:

```tsx
import CustomSizeSection from "@/components/CustomSizeSection";

// Inside the product page, after the standard size/material selector:
<CustomSizeSection product={product} category={category} />
```

The component allows users to enter custom width/height dimensions. The pricing engine (`lib/custom-size-pricing.ts`) finds the nearest standard size to price from, or flags the item as "requires quote" if no match is found.

#### `shop/components/BasketContext.tsx`

Add `customSizeData` to the `BasketItem` interface:

```typescript
customSizeData?: {
  width: number;
  height: number;
  material: string;
  matchedCode: string | null;
  matchedSize: string | null;
  matchedPrice: number | null;
  requiresQuote: boolean;
  originalProduct: string;
  fields?: Array<{ label: string; key: string; value: string }>;
};
```

#### `shop/app/(shop)/basket/page.tsx`

Display custom size info and quote badges. When an item has `customSizeData`:
- Show dimensions (e.g. "450 x 300mm")
- Show "Priced as {matchedSize}" or "Requires quote" badge
- Quote items show amber badge; priced items show green

#### `shop/app/(shop)/checkout/page.tsx`

1. **Purchaser is now mandatory** — change `canSubmit` to require `selectedPurchaser`:
   ```typescript
   const canSubmit = selectedContact && selectedSite && selectedPurchaser && !submitting;
   ```
   Add a red asterisk `*` to the purchaser dropdown label.

2. **Pass `customSizeData` through** in the order submission:
   ```typescript
   ...(item.customSizeData ? { customSizeData: item.customSizeData } : {}),
   ```

3. **Show quote badges** on items that require quotes.

4. **Show quote disclaimer** when basket contains quote items:
   ```tsx
   {items.some((i) => i.customSign || i.customSizeData?.requiresQuote) && (
     <p className="text-xs text-amber-600 mt-2">
       Items marked "Quote" will be priced after review.
     </p>
   )}
   ```

#### `shop/app/(shop)/admin/page.tsx`

Add these document action buttons to each order card (in the collapsed header area, using `e.stopPropagation()` to prevent card toggle):

1. **Delivery Note** (generate) — link to `/api/orders/{orderNumber}/delivery-note`
2. **DN: {filename}** (download uploaded DN) — link to `/api/orders/{orderNumber}/download-dn` (shown when `dnDocumentName` exists)
3. **Upload signed DN** — link to `/dn-upload/{orderNumber}` (shown when no DN uploaded yet)
4. **Quote** (PDF download) — link to `/api/orders/{orderNumber}/quote`
5. **Order List** (PDF download) — link to `/api/orders/{orderNumber}/order-list`
6. **Upload PO** — link to `/po-upload/{orderNumber}` (admin can now upload PO directly, shown when no PO exists)

In the expanded order detail, show custom size data when present on items:
```tsx
{item.customData?.matchedSize && (
  <p className="text-xs text-gray-500">
    {item.size} · Priced as {item.customData.matchedSize}
  </p>
)}
```

---

### 6. Email Template Changes (`shop/lib/email.ts`)

#### Professional Email Header

All email functions now use a shared `emailHeaderHtml()` function that renders:
- Navy background header with white company logo
- Brand accent colour bar (3px)
- Company name, address, phone in subtext

Replace these Persimmon values:
| Persimmon | Balfour |
|---|---|
| `#00474a` (header bg) | `#002b49` (BB navy) |
| `#3db28c` (accent bar) | `#005d99` (BB blue) |
| `onesign-logo-white.png` | Balfour Beatty logo |
| `Onesign and Digital` | `Balfour Beatty` |
| `D86 Princesway, Gateshead NE11 0TU` | BB address |
| `0191 487 6767` | BB phone |

The header function signature:
```typescript
function emailHeaderHtml(title: string, siteUrl: string): string
```

Each email function calls it with a relevant title: "Order Confirmation", "New Order", "Purchase Order Request", etc.

#### Custom Size Data in Emails

The `itemRowsHtml()` function now handles items with `custom_data` containing custom size info. When `custom_data` has dimensions, it displays them alongside the item.

---

### 7. Artwork Registry

Create `shop/data/artwork-registry.json`:

```json
{
  "updatedAt": "2026-03-30",
  "description": "Product base codes with production-ready artwork. Used by order list PDF to show artwork status.",
  "codes": []
}
```

The Order List PDF reads this file and shows a "Yes/No" artwork column per line item. Populate the `codes` array with Balfour product base codes that have production-ready artwork. Leave empty initially — all items will show "No" until codes are added.

---

## Task Order

1. Run the SQL migration (DN columns)
2. Install `@react-pdf/renderer`
3. Copy new files: PDF libraries, API routes, DN upload pages, custom size pricing
4. Update `orders/route.ts` (GET: auto-correct + dnDocumentName, POST: customSizeData)
5. Update `upload-po/route.ts` (status transition on upload)
6. Update `email.ts` (header function + brand replacements)
7. Add `CustomSizeSection` to product page
8. Update `BasketContext.tsx` (customSizeData on BasketItem)
9. Update basket page (custom size display + quote badges)
10. Update checkout page (purchaser mandatory + customSizeData pass-through + quote badges)
11. Update admin page (document action buttons + custom size display in order detail)
12. Create `data/artwork-registry.json`
13. Run `next build` to confirm everything compiles

---

## Files That Can Be Copied As-Is

These files have **zero brand-specific content** — they use CSS variables for colours and don't reference table names:

```
shop/lib/custom-size-pricing.ts
shop/components/CustomSizeSection.tsx
shop/app/dn-upload/[orderNumber]/page.tsx
shop/app/dn-upload/[orderNumber]/DnUploadForm.tsx
```

## Files That Need `psp_` → `bal_` Rename

```
shop/app/api/orders/[orderNumber]/quote/route.ts
shop/app/api/orders/[orderNumber]/order-list/route.ts
shop/app/api/orders/[orderNumber]/upload-dn/route.ts
shop/app/api/orders/[orderNumber]/download-dn/route.ts
```

## Files That Need Brand Replacements

```
shop/lib/quote-pdf.tsx           (logo SVG, company details, colours)
shop/lib/order-list-pdf.tsx      (logo SVG, company details, colours, artwork registry codes)
shop/lib/email.ts                (header logo, company details, colours)
```

---

## Verification Checklist

- [ ] `bal_orders` has `dn_document_name`, `dn_document_data`, `dn_document_type` columns
- [ ] `@react-pdf/renderer` installed
- [ ] Quote PDF downloads from admin order card
- [ ] Order List PDF downloads from admin order card (with artwork column)
- [ ] Delivery Note PDF generates from admin order card
- [ ] Admin can upload signed DN via `/dn-upload/{orderNumber}`
- [ ] Uploaded DN shows as downloadable link on admin order card
- [ ] Admin can upload PO directly from order card
- [ ] Orders stuck on `awaiting_po` with PO uploaded auto-correct to `new` on page load
- [ ] PO upload transitions order from `awaiting_po` → `new`
- [ ] Custom size section appears on product pages below standard variants
- [ ] Entering dimensions finds nearest standard size or flags as "requires quote"
- [ ] Custom size items show in basket with dimensions and pricing info
- [ ] Quote badges appear on basket and checkout for manual-quote items
- [ ] Purchaser is mandatory at checkout (red asterisk, submit disabled without)
- [ ] `customSizeData` passes through to order API and is stored in `custom_data` JSONB
- [ ] Admin order detail shows custom size info when present
- [ ] All emails have professional header with Balfour logo and brand colours
- [ ] `brand` field in webhook payloads remains `"balfour"`
- [ ] `artwork-registry.json` exists (can be empty codes array)
- [ ] `next build` passes cleanly
