# Feature Sync Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port 11 features from Persimmon portal to Balfour Beatty portal for feature parity.

**Architecture:** Direct port from Persimmon source at `C:\Users\peaco\Documents\persimmon-fulfillment`. Mechanical `psp_` → `bal_` table renames, brand color swaps in inline HTML, `brand: "balfour"` added to webhook payloads. Email system stays as Resend (NOT Nodemailer). Pages using only CSS variables are copied as-is.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Resend, Make.com webhooks

**Spec:** `docs/superpowers/specs/2026-03-12-feature-sync-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `docs/migrations/feature-sync.sql` | Create | SQL migration for user to run |
| `shop/lib/email.ts` | Modify | Add `buildNestPOEmailHtml`, `generateRaisePoToken`, update `itemRowsHtml` |
| `shop/app/api/contacts/route.ts` | Create | Contacts CRUD (GET/POST) |
| `shop/app/api/sites/route.ts` | Create | Sites CRUD (GET/POST) |
| `shop/app/api/orders/route.ts` | Modify | Add contactId/siteId + Make webhook |
| `shop/app/api/orders/[orderNumber]/route.ts` | Modify | Add `awaiting_po` to validStatuses |
| `shop/app/api/orders/[orderNumber]/raise-po/route.ts` | Create | Raise PO via email link |
| `shop/app/api/orders/[orderNumber]/send-to-nest/route.ts` | Create | Admin send to Nest |
| `shop/app/(shop)/admin/page.tsx` | Modify | Send to Nest button + awaiting_po |
| `shop/app/(shop)/checkout/page.tsx` | Replace | Contact/site dropdown selectors |
| `shop/app/(shop)/orders/page.tsx` | Replace | Site bento cards + contact pills |

---

## Chunk 1: Foundation

### Task 1: Create migration SQL

**Files:**
- Create: `docs/migrations/feature-sync.sql`

- [ ] **Step 1: Create the migration file**

Create directory `docs/migrations/` if it doesn't exist, then create `docs/migrations/feature-sync.sql` with the exact contents from the spec Section 1 (including both the migration and rollback blocks). Copy the SQL verbatim from `docs/superpowers/specs/2026-03-12-feature-sync-design.md`.

- [ ] **Step 2: Commit**

```bash
git add docs/migrations/feature-sync.sql
git commit -m "feat: add feature sync database migration"
```

---

### Task 2: Update email.ts — add itemRowsHtml siteUrl param, buildNestPOEmailHtml, generateRaisePoToken

**Files:**
- Modify: `shop/lib/email.ts`

**Context:** Balfour uses Resend (not Nodemailer like Persimmon). The existing `itemRowsHtml` function at line 79 takes only `items: OrderItem[]`. We need to add an optional `siteUrl` param so webhook emails can use absolute image URLs instead of CIDs.

- [ ] **Step 1: Update `itemRowsHtml` signature**

In `shop/lib/email.ts`, change the function signature from:

```typescript
function itemRowsHtml(items: OrderItem[]): string {
```

to:

```typescript
function itemRowsHtml(items: OrderItem[], siteUrl?: string): string {
```

Then update the standard item image `src` (around line 114) from:

```html
<img src="cid:${imgCode}" ...
```

to:

```html
<img src="${siteUrl ? `${siteUrl}/images/products/${imgCode}.png` : `cid:${imgCode}`}" ...
```

This matches Persimmon's `itemRowsHtml` which already has this dual-mode logic.

- [ ] **Step 2: Add `buildNestPOEmailHtml` export**

Append this function to `shop/lib/email.ts` (after the `sendTeamNotification` function). This is ported from Persimmon's `email.ts` with Balfour brand colors (`#002b49` navy header, `#005d99` button):

```typescript
/** Build the order notification email HTML with absolute image URLs and optional Raise PO button */
export function buildNestPOEmailHtml(order: OrderData, siteUrl: string, raisePoUrl?: string): { subject: string; html: string } {
  const wb = "word-break:break-word;overflow-wrap:break-word";
  const buttonHtml = raisePoUrl
    ? `<div style="text-align:center;margin:28px 0 8px">
        <a href="${raisePoUrl}" style="background:#005d99;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;display:inline-block;font-size:16px;font-weight:bold;letter-spacing:0.5px">Raise PO</a>
        <p style="margin:8px 0 0;font-size:12px;color:#999">Click to send this order to Nest for purchase order processing</p>
      </div>`
    : "";
  return {
    subject: `PO Request — ${order.orderNumber} — ${esc(order.siteName)}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;${wb}">
        <div style="background:#002b49;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">Purchase Order Request</h1>
        </div>
        <div style="padding:32px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
            <p style="margin:0;font-size:18px;font-weight:bold;color:#002b49">${order.orderNumber}</p>
            <p style="margin:4px 0 0;font-size:14px;color:#666">&pound;${order.total.toFixed(2)} inc. VAT &middot; ${order.items.length} items</p>
          </div>

          <table style="width:100%;margin-bottom:24px" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:top;width:50%;padding-right:12px">
              <p style="font-size:12px;color:#999;text-transform:uppercase;margin:0 0 4px">Contact</p>
              <p style="margin:0;font-size:14px;${wb}"><strong>${esc(order.contactName)}</strong></p>
              <p style="margin:2px 0;font-size:14px;color:#666;${wb}">${esc(order.email)}</p>
              <p style="margin:0;font-size:14px;color:#666">${esc(order.phone)}</p>
            </td>
            <td style="vertical-align:top;width:50%;padding-left:12px">
              <p style="font-size:12px;color:#999;text-transform:uppercase;margin:0 0 4px">Site</p>
              <p style="margin:0;font-size:14px;${wb}"><strong>${esc(order.siteName)}</strong></p>
              <p style="margin:2px 0;font-size:14px;color:#666;${wb}">${esc(order.siteAddress)}</p>
            </td>
          </tr></table>

          ${order.poNumber ? `<p style="font-size:14px;color:#666;margin-bottom:16px;${wb}"><strong>Customer PO:</strong> ${esc(order.poNumber)}</p>` : ""}

          ${order.notes ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin-bottom:24px"><p style="margin:0;font-size:13px;color:#c2410c;${wb}"><strong>Notes:</strong> ${esc(order.notes)}</p></div>` : ""}

          <table style="width:100%;border-collapse:collapse;margin:20px 0;table-layout:fixed">
            <thead>
              <tr style="background:#f5f5f5">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;width:48px"></th>
                <th style="padding:8px 8px;text-align:left;font-size:12px;color:#666;text-transform:uppercase">Product</th>
                <th style="padding:8px 8px;text-align:center;font-size:12px;color:#666;text-transform:uppercase;width:50px">Qty</th>
                <th style="padding:8px 12px 8px 8px;text-align:right;font-size:12px;color:#666;text-transform:uppercase;width:80px">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHtml(order.items, siteUrl)}
            </tbody>
            <tfoot>
              ${totalsHtml(order.subtotal, order.vat, order.total, order.items.some(i => !!i.custom_data))}
            </tfoot>
          </table>

          ${buttonHtml}
        </div>
      </div>`,
  };
}
```

- [ ] **Step 3: Add `generateRaisePoToken` export**

Append after `buildNestPOEmailHtml`:

```typescript
/** Generate a raise-PO token for an order number */
export function generateRaisePoToken(orderNumber: string): string {
  const crypto = require("crypto");
  const secret = process.env.RAISE_PO_SECRET || "bal-raise-po-default";
  return crypto.createHmac("sha256", secret).update(orderNumber).digest("hex").slice(0, 16);
}
```

- [ ] **Step 4: Commit**

```bash
git add shop/lib/email.ts
git commit -m "feat: add buildNestPOEmailHtml, generateRaisePoToken, update itemRowsHtml"
```

---

## Chunk 2: New API Routes

### Task 3: Create contacts API route

**Files:**
- Create: `shop/app/api/contacts/route.ts`

- [ ] **Step 1: Create the file**

Create directory `shop/app/api/contacts/` if it doesn't exist. Copy from Persimmon `C:\Users\peaco\Documents\persimmon-fulfillment\shop\app\api\contacts\route.ts` and find-and-replace all `"psp_contacts"` with `"bal_contacts"` (3 occurrences).

- [ ] **Step 2: Commit**

```bash
git add shop/app/api/contacts/route.ts
git commit -m "feat: add contacts API route"
```

---

### Task 4: Create sites API route

**Files:**
- Create: `shop/app/api/sites/route.ts`

- [ ] **Step 1: Create the file**

Create directory `shop/app/api/sites/` if it doesn't exist. Copy from Persimmon `C:\Users\peaco\Documents\persimmon-fulfillment\shop\app\api\sites\route.ts` and find-and-replace all `"psp_sites"` with `"bal_sites"` (3 occurrences).

- [ ] **Step 2: Commit**

```bash
git add shop/app/api/sites/route.ts
git commit -m "feat: add sites API route"
```

---

### Task 5: Create raise-po API route

**Files:**
- Create: `shop/app/api/orders/[orderNumber]/raise-po/route.ts`

**Dependencies:** Task 2 must be complete (imports `buildNestPOEmailHtml`, `generateRaisePoToken` from `@/lib/email`).

- [ ] **Step 1: Create directory and file**

Create directory `shop/app/api/orders/[orderNumber]/raise-po/` if it doesn't exist. Copy from Persimmon `C:\Users\peaco\Documents\persimmon-fulfillment\shop\app\api\orders\[orderNumber]\raise-po\route.ts` and apply these changes:

1. Find-and-replace all `"psp_orders"` → `"bal_orders"` (2 occurrences)
2. Find-and-replace all `"psp_order_items"` → `"bal_order_items"` (1 occurrence)
3. Find-and-replace all inline HTML brand colors:
   - `#00474a` → `#002b49` (3 occurrences — header backgrounds, text colors)
   - `#3db28c` → `#005d99` (3 occurrences — button backgrounds, check circle)
   - `#f8faf9` → `#f8faf9` (background — keep as-is, it's neutral)
4. Add `brand: "balfour"` to the webhook JSON payload (inside `body: JSON.stringify({...})`, after `isPO: true`)

- [ ] **Step 2: Commit**

```bash
git add shop/app/api/orders/[orderNumber]/raise-po/route.ts
git commit -m "feat: add raise-po API route"
```

---

### Task 6: Create send-to-nest API route

**Files:**
- Create: `shop/app/api/orders/[orderNumber]/send-to-nest/route.ts`

**Dependencies:** Task 2 must be complete (imports `buildNestPOEmailHtml` from `@/lib/email`).

- [ ] **Step 1: Create directory and file**

Create directory `shop/app/api/orders/[orderNumber]/send-to-nest/` if it doesn't exist. Copy from Persimmon `C:\Users\peaco\Documents\persimmon-fulfillment\shop\app\api\orders\[orderNumber]\send-to-nest\route.ts` and apply these changes:

1. Find-and-replace all `"psp_orders"` → `"bal_orders"` (2 occurrences)
2. Find-and-replace all `"psp_order_items"` → `"bal_order_items"` (1 occurrence)
3. Add `brand: "balfour"` to the webhook JSON payload (inside `body: JSON.stringify({...})`, after `isPO: true`)

- [ ] **Step 2: Commit**

```bash
git add shop/app/api/orders/[orderNumber]/send-to-nest/route.ts
git commit -m "feat: add send-to-nest API route"
```

---

## Chunk 3: Modified Routes and Pages

### Task 7: Update orders route — add contactId/siteId and Make webhook

**Files:**
- Modify: `shop/app/api/orders/route.ts`

**Dependencies:** Task 2 must be complete (imports `buildNestPOEmailHtml`, `generateRaisePoToken`).

**Note:** Steps 2-5 modify the same file sequentially. Line numbers reference the original file state — after each insertion, subsequent line numbers will shift by the number of lines added. Use the provided code snippets to locate the correct positions via search.

- [ ] **Step 1: Update import**

Change line 3 from:

```typescript
import { sendOrderConfirmation, sendTeamNotification } from "@/lib/email";
```

to:

```typescript
import { sendOrderConfirmation, sendTeamNotification, buildNestPOEmailHtml, generateRaisePoToken } from "@/lib/email";
```

- [ ] **Step 2: Add contactId/siteId to POST destructuring**

Change line 22 from:

```typescript
    const { contactName, email, phone, siteName, siteAddress, poNumber, notes, items } = body;
```

to:

```typescript
    const { contactName, email, phone, siteName, siteAddress, poNumber, notes, items, contactId, siteId } = body;
```

- [ ] **Step 3: Add contactId/siteId to insert object**

In the `.insert({...})` call (around line 93), after `notes: notes ? String(notes) : null,` add:

```typescript
        contact_id: contactId || null,
        site_id: siteId || null,
```

- [ ] **Step 4: Replace email-only Promise.all with webhook**

Replace the `await Promise.all([...])` block (find the existing `Promise.all` with `sendOrderConfirmation` and `sendTeamNotification`) with the expanded version below that includes the Make.com webhook:

```typescript
    // Send emails + fire Make webhook in parallel
    const siteUrl = process.env.SITE_URL || "http://localhost:3000";
    const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL;

    await Promise.all([
      sendOrderConfirmation(emailData).catch((e) => console.error("Confirmation email failed:", e)),
      sendTeamNotification(emailData).catch((e) => console.error("Team notification failed:", e)),
      makeWebhookUrl
        ? (() => {
            const token = generateRaisePoToken(orderNumber);
            const raisePoUrl = `${siteUrl}/api/orders/${orderNumber}/raise-po?t=${token}`;
            const { subject, html } = buildNestPOEmailHtml(emailData, siteUrl, raisePoUrl);
            return fetch(makeWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                brand: "balfour",
                isPO: false,
                emailSubject: subject,
                emailHtml: html,
                raisePoUrl,
                orderNumber,
                contactName: String(contactName),
                contactEmail: String(email),
                contactPhone: String(phone),
                siteName: String(siteName),
                siteAddress: String(siteAddress),
                poNumber: poNumber ? String(poNumber) : null,
                notes: notes ? String(notes) : null,
                subtotal,
                vat,
                total,
                itemCount: validatedItems.length,
                hasCustomItems: validatedItems.some((i: { custom_data: unknown }) => !!i.custom_data),
              }),
            })
              .then((r) => console.log(`Make webhook fired for ${orderNumber} — ${r.status}`))
              .catch((e) => console.error("Make webhook failed:", e));
          })()
        : Promise.resolve(),
    ]);
```

- [ ] **Step 5: Add contactId/siteId to GET response transform**

In the GET handler's `.map((o) => ({...}))` (around line 184), after `status: o.status,` add:

```typescript
      contactId: o.contact_id || null,
      siteId: o.site_id || null,
```

- [ ] **Step 6: Commit**

```bash
git add shop/app/api/orders/route.ts
git commit -m "feat: add contactId/siteId and Make webhook to orders route"
```

---

### Task 8: Update [orderNumber] route — add awaiting_po to validStatuses

**Files:**
- Modify: `shop/app/api/orders/[orderNumber]/route.ts`

- [ ] **Step 1: Update validStatuses**

Change line 17 from:

```typescript
    const validStatuses = ["new", "in-progress", "completed", "cancelled"];
```

to:

```typescript
    const validStatuses = ["new", "awaiting_po", "in-progress", "completed", "cancelled"];
```

- [ ] **Step 2: Commit**

```bash
git add "shop/app/api/orders/[orderNumber]/route.ts"
git commit -m "feat: add awaiting_po to valid order statuses"
```

---

### Task 9: Update admin page — Send to Nest button + awaiting_po status

**Files:**
- Modify: `shop/app/(shop)/admin/page.tsx`

Copy the Persimmon version at `C:\Users\peaco\Documents\persimmon-fulfillment\shop\app\(shop)\admin\page.tsx` in its entirety, overwriting the Balfour version. The Persimmon admin page already uses CSS variable class names (`text-persimmon-navy`, `bg-persimmon-green`, etc.) which are mapped to Balfour colors. No color changes needed — the entire file is brand-agnostic.

- [ ] **Step 1: Replace the file with Persimmon's version**

Copy `C:\Users\peaco\Documents\persimmon-fulfillment\shop\app\(shop)\admin\page.tsx` to `shop/app/(shop)/admin/page.tsx`, overwriting the existing file completely. No modifications needed.

- [ ] **Step 2: Commit**

```bash
git add "shop/app/(shop)/admin/page.tsx"
git commit -m "feat: add Send to Nest button and awaiting_po status to admin"
```

---

### Task 10: Replace checkout page — contact/site dropdown selectors

**Files:**
- Replace: `shop/app/(shop)/checkout/page.tsx`

Copy the Persimmon version at `C:\Users\peaco\Documents\persimmon-fulfillment\shop\app\(shop)\checkout\page.tsx` in its entirety. The page uses CSS variable class names only — no brand-specific content.

- [ ] **Step 1: Replace the file with Persimmon's version**

Copy `C:\Users\peaco\Documents\persimmon-fulfillment\shop\app\(shop)\checkout\page.tsx` to `shop/app/(shop)/checkout/page.tsx`, overwriting completely. No modifications needed.

- [ ] **Step 2: Commit**

```bash
git add "shop/app/(shop)/checkout/page.tsx"
git commit -m "feat: replace checkout with contact/site dropdown selectors"
```

---

### Task 11: Replace orders page — site bento cards + contact filter pills

**Files:**
- Replace: `shop/app/(shop)/orders/page.tsx`

Copy the Persimmon version at `C:\Users\peaco\Documents\persimmon-fulfillment\shop\app\(shop)\orders\page.tsx` in its entirety. The page uses CSS variable class names only — no brand-specific content.

- [ ] **Step 1: Replace the file with Persimmon's version**

Copy `C:\Users\peaco\Documents\persimmon-fulfillment\shop\app\(shop)\orders\page.tsx` to `shop/app/(shop)/orders/page.tsx`, overwriting completely. No modifications needed.

- [ ] **Step 2: Commit**

```bash
git add "shop/app/(shop)/orders/page.tsx"
git commit -m "feat: replace orders page with site bento cards and contact pills"
```

---

## Chunk 4: Verification

### Task 12: Build verification

- [ ] **Step 1: Run next build**

```bash
cd shop && npx next build
```

Expected: Build succeeds with no TypeScript or compilation errors. Warnings about missing env vars (`MAKE_WEBHOOK_URL`, `RAISE_PO_SECRET`) are acceptable.

- [ ] **Step 2: Fix any build errors**

If any TypeScript errors appear, fix them. Common issues:
- Missing imports (check email.ts exports are correct)
- Type mismatches on `custom_data` (ensure `OrderItem` interface matches)

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build errors from feature sync"
```

---

## Parallelization Guide

For subagent-driven execution:

**Batch 1 (independent):** Tasks 1, 2, 3, 4, 8, 9, 10, 11
- Migration SQL, email.ts updates, contacts route, sites route, validStatuses
- Admin page, checkout page, orders page (pure file copies, no build-time deps)

**Batch 2 (depends on Task 2):** Tasks 5, 6, 7
- Raise-po route, send-to-nest route, orders route (all import from email.ts)

**Final:** Task 12
- Build verification (depends on everything)
