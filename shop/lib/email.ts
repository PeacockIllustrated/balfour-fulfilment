/** Escape HTML special characters to prevent injection in email templates */
function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface OrderItem {
  code: string;
  base_code: string | null;
  name: string;
  size: string | null;
  material: string | null;
  price: number;
  quantity: number;
  line_total: number;
  custom_data?: {
    type?: string;
    signType?: string;
    textContent?: string;
    shape?: string;
    additionalNotes?: string;
    fields?: Array<{ label: string; key: string; value: string }>;
  } | null;
}

export interface OrderData {
  orderNumber: string;
  contactName: string;
  email: string;
  phone: string;
  siteName: string;
  siteAddress: string;
  poNumber: string | null;
  notes: string | null;
  purchaserName?: string | null;
  purchaserEmail?: string | null;
  items: OrderItem[];
  subtotal: number;
  vat: number;
  total: number;
}

export const SIGN_TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  warning: { bg: "#FFD700", fg: "#000" },
  prohibition: { bg: "#CC0000", fg: "#FFF" },
  mandatory: { bg: "#005BBB", fg: "#FFF" },
  information: { bg: "#009639", fg: "#FFF" },
  "fire-safety": { bg: "#CC0000", fg: "#FFF" },
  directional: { bg: "#009639", fg: "#FFF" },
  security: { bg: "#005BBB", fg: "#FFF" },
  environmental: { bg: "#009639", fg: "#FFF" },
};

function itemRowsHtml(items: OrderItem[], siteUrl?: string): string {
  return items
    .map((item) => {
      // Custom sign request (price 0, quote on request)
      if (item.custom_data && item.custom_data.signType) {
        const colors = SIGN_TYPE_COLORS[item.custom_data.signType] || { bg: "#666", fg: "#FFF" };
        const typeLabel = item.custom_data.signType.charAt(0).toUpperCase() + item.custom_data.signType.slice(1).replace("-", " ");
        return `
    <tr>
      <td style="padding:8px 4px 8px 12px;border-bottom:1px solid #eee;vertical-align:middle;width:48px">
        <div style="width:40px;height:40px;border-radius:4px;background:${colors.bg};display:flex;align-items:center;justify-content:center">
          <span style="color:${colors.fg};font-size:10px;font-weight:bold;text-align:center;line-height:1.1">${typeLabel}</span>
        </div>
      </td>
      <td style="padding:8px 8px;border-bottom:1px solid #eee;font-size:14px;vertical-align:middle">
        <strong style="color:#333">CUSTOM SIGN REQUEST</strong><br/>
        <span style="color:#666;font-size:12px">${esc(typeLabel)} &middot; ${esc(item.custom_data.shape)} &middot; ${esc(item.size)}</span><br/>
        <span style="color:#c2410c;font-size:12px">Text: &ldquo;${esc(item.custom_data.textContent)}&rdquo;</span>
        ${item.custom_data.additionalNotes ? `<br/><span style="color:#999;font-size:11px">Notes: ${esc(item.custom_data.additionalNotes)}</span>` : ""}
      </td>
      <td style="padding:8px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:center;vertical-align:middle">${item.quantity}</td>
      <td style="padding:8px 12px 8px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:right;vertical-align:middle;color:#d97706;font-weight:bold">Quote</td>
    </tr>`;
      }

      // Standard item (with optional custom field values)
      const imgCode = (item.base_code || item.code.replace(/\/.*$/, "")).replace(/\//g, "_");
      const customFieldsHtml = item.custom_data?.fields
        ? (item.custom_data.fields as Array<{ label: string; key: string; value: string }>)
            .map((f) => `<br/><span style="color:#002b49;font-size:11px">${esc(f.label)}: <span style="color:#666">${esc(f.value)}</span></span>`)
            .join("")
        : "";
      return `
    <tr>
      <td style="padding:8px 4px 8px 12px;border-bottom:1px solid #eee;vertical-align:middle;width:48px">
        <img src="${siteUrl ? `${siteUrl}/images/products/${imgCode}.png` : `cid:${imgCode}`}" alt="${esc(item.code)}" width="40" height="40" style="display:block;border-radius:4px;object-fit:contain;background:#f8f8f8" />
      </td>
      <td style="padding:8px 8px;border-bottom:1px solid #eee;font-size:14px;vertical-align:middle">
        <strong style="color:#333">${esc(item.code)}</strong><br/>
        <span style="color:#666;font-size:12px">${esc(item.name)}${item.size ? ` (${esc(item.size)})` : ""}</span>${customFieldsHtml}
      </td>
      <td style="padding:8px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:center;vertical-align:middle">${item.quantity}</td>
      <td style="padding:8px 12px 8px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:right;vertical-align:middle">&pound;${item.line_total.toFixed(2)}</td>
    </tr>`;
    })
    .join("");
}

function totalsHtml(subtotal: number, vat: number, total: number, hasCustomItems: boolean): string {
  return `
    <tr>
      <td colspan="3" style="padding:8px 12px;text-align:right;font-size:14px;color:#666">Subtotal</td>
      <td style="padding:8px 12px 8px 8px;text-align:right;font-size:14px">&pound;${subtotal.toFixed(2)}</td>
    </tr>
    <tr>
      <td colspan="3" style="padding:8px 12px;text-align:right;font-size:14px;color:#666">VAT (20%)</td>
      <td style="padding:8px 12px 8px 8px;text-align:right;font-size:14px">&pound;${vat.toFixed(2)}</td>
    </tr>
    <tr>
      <td colspan="3" style="padding:8px 12px;text-align:right;font-weight:bold;font-size:14px;color:#002b49">Total</td>
      <td style="padding:8px 12px 8px 8px;text-align:right;font-weight:bold;font-size:14px;color:#002b49">&pound;${total.toFixed(2)}</td>
    </tr>
    ${hasCustomItems ? `<tr><td colspan="4" style="padding:12px;text-align:center;font-size:12px;color:#d97706;background:#fffbeb;border-radius:0 0 8px 8px">* Custom sign items will be quoted separately. Final pricing confirmed after review.</td></tr>` : ""}`;
}

/** Build the order notification email HTML with absolute image URLs and optional Raise PO button */
export function buildNestPOEmailHtml(order: OrderData, siteUrl: string, raisePoUrl?: string): { subject: string; html: string } {
  const wb = "word-break:break-word;overflow-wrap:break-word";
  const buttonHtml = raisePoUrl
    ? `<div style="text-align:center;margin:28px 0 8px">
        <a href="${raisePoUrl}" style="background:#005d99;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;display:inline-block;font-size:16px;font-weight:bold;letter-spacing:0.5px">Send to Purchaser</a>
        <p style="margin:8px 0 0;font-size:12px;color:#999">Click to forward this order to the purchaser for PO attachment</p>
      </div>`
    : "";
  return {
    subject: `${raisePoUrl ? "PO Request" : "PO Raised"} — ${order.orderNumber} — ${esc(order.siteName)}`,
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

          ${order.purchaserName ? `<p style="font-size:14px;color:#666;margin-bottom:16px;${wb}"><strong>Purchaser:</strong> ${esc(order.purchaserName)}${order.purchaserEmail ? ` (${esc(order.purchaserEmail)})` : ""}</p>` : ""}

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

/** Build the purchaser-facing PO email HTML with "Attach PO" button */
export function buildPurchaserPOEmailHtml(order: OrderData, poUploadUrl: string): { subject: string; html: string } {
  const wb = "word-break:break-word;overflow-wrap:break-word";
  return {
    subject: `Purchase Order Required — ${order.orderNumber} — ${esc(order.siteName)}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;${wb}">
        <div style="background:#002b49;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">Purchase Order Required</h1>
        </div>
        <div style="padding:32px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
          <p style="font-size:15px;color:#333;margin:0 0 20px">
            Hi${order.purchaserName ? ` ${esc(order.purchaserName)}` : ""},
          </p>
          <p style="font-size:14px;color:#666;margin:0 0 24px;line-height:1.6">
            A signage order has been placed for <strong>${esc(order.siteName)}</strong> and requires a purchase order.
            Please review the details below and attach your PO document using the button at the bottom of this email.
          </p>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
            <p style="margin:0;font-size:18px;font-weight:bold;color:#002b49">${order.orderNumber}</p>
            <p style="margin:4px 0 0;font-size:14px;color:#666">&pound;${order.total.toFixed(2)} inc. VAT &middot; ${order.items.length} items</p>
          </div>

          <table style="width:100%;margin-bottom:24px" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:top;width:50%;padding-right:12px">
              <p style="font-size:12px;color:#999;text-transform:uppercase;margin:0 0 4px">Ordered by</p>
              <p style="margin:0;font-size:14px;${wb}"><strong>${esc(order.contactName)}</strong></p>
              <p style="margin:2px 0;font-size:14px;color:#666;${wb}">${esc(order.email)}</p>
            </td>
            <td style="vertical-align:top;width:50%;padding-left:12px">
              <p style="font-size:12px;color:#999;text-transform:uppercase;margin:0 0 4px">Site</p>
              <p style="margin:0;font-size:14px;${wb}"><strong>${esc(order.siteName)}</strong></p>
              <p style="margin:2px 0;font-size:14px;color:#666;${wb}">${esc(order.siteAddress)}</p>
            </td>
          </tr></table>

          <table style="width:100%;border-collapse:collapse;margin:20px 0;table-layout:fixed">
            <thead>
              <tr style="background:#f5f5f5">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase">Product</th>
                <th style="padding:8px 8px;text-align:center;font-size:12px;color:#666;text-transform:uppercase;width:50px">Qty</th>
                <th style="padding:8px 12px 8px 8px;text-align:right;font-size:12px;color:#666;text-transform:uppercase;width:80px">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item) => {
                if (item.custom_data && item.custom_data.signType) {
                  const typeLabel = item.custom_data.signType.charAt(0).toUpperCase() + item.custom_data.signType.slice(1).replace("-", " ");
                  return `<tr>
                    <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">CUSTOM SIGN — ${esc(typeLabel)}</td>
                    <td style="padding:8px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:center">${item.quantity}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right;color:#d97706;font-weight:bold">Quote</td>
                  </tr>`;
                }
                return `<tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${esc(item.code)} — ${esc(item.name)}${item.size ? ` (${esc(item.size)})` : ""}</td>
                  <td style="padding:8px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:center">${item.quantity}</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:right">&pound;${item.line_total.toFixed(2)}</td>
                </tr>`;
              }).join("")}
            </tbody>
            <tfoot>
              ${totalsHtml(order.subtotal, order.vat, order.total, order.items.some(i => !!i.custom_data))}
            </tfoot>
          </table>

          <div style="text-align:center;margin:28px 0 8px">
            <a href="${poUploadUrl}" style="background:#005d99;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;display:inline-block;font-size:16px;font-weight:bold;letter-spacing:0.5px">Attach PO</a>
            <p style="margin:8px 0 0;font-size:12px;color:#999">Click to upload your purchase order document for this order</p>
          </div>
        </div>
      </div>`,
  };
}

/** Generate a raise-PO token for an order number */
export function generateRaisePoToken(orderNumber: string): string {
  const crypto = require("crypto");
  const secret = process.env.RAISE_PO_SECRET || "bal-raise-po-default";
  return crypto.createHmac("sha256", secret).update(orderNumber).digest("hex").slice(0, 16);
}
