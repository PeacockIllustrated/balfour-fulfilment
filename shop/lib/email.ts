import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/** Escape HTML special characters to prevent injection in email templates */
function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface OrderItem {
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

interface OrderData {
  orderNumber: string;
  contactName: string;
  email: string;
  phone: string;
  siteName: string;
  siteAddress: string;
  poNumber: string | null;
  notes: string | null;
  items: OrderItem[];
  subtotal: number;
  vat: number;
  total: number;
}

/** Build CID inline attachments — Resend fetches each image via `path` */
function buildImageAttachments(items: OrderItem[], siteUrl: string) {
  const seen = new Set<string>();
  return items
    .map((item) => {
      if (item.custom_data?.signType) return null; // No CID image for custom sign requests
      const imgCode = (item.base_code || item.code.replace(/\/.*$/, "")).replace(/\//g, "_");
      if (seen.has(imgCode)) return null;
      seen.add(imgCode);
      return {
        path: `${siteUrl}/images/products/${imgCode}.png`,
        filename: `${imgCode}.png`,
        content_type: "image/png",
        contentId: imgCode,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
}

const SIGN_TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  warning: { bg: "#FFD700", fg: "#000" },
  prohibition: { bg: "#CC0000", fg: "#FFF" },
  mandatory: { bg: "#005BBB", fg: "#FFF" },
  information: { bg: "#009639", fg: "#FFF" },
  "fire-safety": { bg: "#CC0000", fg: "#FFF" },
  directional: { bg: "#009639", fg: "#FFF" },
  security: { bg: "#005BBB", fg: "#FFF" },
  environmental: { bg: "#009639", fg: "#FFF" },
};

function itemRowsHtml(items: OrderItem[]): string {
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
        <img src="cid:${imgCode}" alt="${esc(item.code)}" width="40" height="40" style="display:block;border-radius:4px;object-fit:contain;background:#f8f8f8" />
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

export async function sendOrderConfirmation(order: OrderData): Promise<void> {
  const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const attachments = buildImageAttachments(order.items, siteUrl);

  const { error } = await resend.emails.send({
    from: `Balfour Beatty Signage <${fromEmail}>`,
    to: order.email,
    subject: `Order Confirmed - ${order.orderNumber}`,
    attachments,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#002b49;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">Order Confirmed</h1>
        </div>
        <div style="padding:32px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
          <p style="font-size:15px;color:#333">Hi ${esc(order.contactName)},</p>
          <p style="font-size:15px;color:#333">Thank you for your order. Our team will review it and be in touch shortly.</p>

          <div style="background:#f8faf9;border-radius:8px;padding:16px 20px;margin:20px 0">
            <p style="margin:0 0 4px;font-size:13px;color:#666">Order Number</p>
            <p style="margin:0;font-size:18px;font-weight:bold;color:#002b49">${order.orderNumber}</p>
          </div>

          <div style="margin:20px 0">
            <p style="font-size:13px;color:#666;margin:0 0 4px">Site: <strong style="color:#333">${esc(order.siteName)}</strong></p>
            <p style="font-size:13px;color:#666;margin:0">${esc(order.siteAddress)}</p>
          </div>

          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <thead>
              <tr style="background:#f5f5f5">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;width:48px"></th>
                <th style="padding:8px 8px;text-align:left;font-size:12px;color:#666;text-transform:uppercase">Product</th>
                <th style="padding:8px 8px;text-align:center;font-size:12px;color:#666;text-transform:uppercase">Qty</th>
                <th style="padding:8px 12px 8px 8px;text-align:right;font-size:12px;color:#666;text-transform:uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHtml(order.items)}
            </tbody>
            <tfoot>
              ${totalsHtml(order.subtotal, order.vat, order.total, order.items.some(i => !!i.custom_data))}
            </tfoot>
          </table>

          <p style="font-size:13px;color:#999;margin-top:32px">If you have any questions about your order, please contact us.</p>
        </div>
      </div>`,
  });

  if (error) {
    console.warn(`Customer confirmation skipped (${order.email}):`, error.message);
    return;
  }
  console.log(`Order confirmation email sent to ${order.email}`);
}

export async function sendTeamNotification(order: OrderData): Promise<void> {
  const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const teamEmail = process.env.TEAM_NOTIFICATION_EMAIL;
  if (!teamEmail) return;

  const attachments = buildImageAttachments(order.items, siteUrl);
  console.log(`[EMAIL] Sending team notification with ${attachments.length} inline image(s)`);

  const { error } = await resend.emails.send({
    from: `Balfour Beatty Signage Portal <${fromEmail}>`,
    to: teamEmail,
    subject: `New Order: ${order.orderNumber} - ${esc(order.siteName)}`,
    attachments,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#002b49;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">New Order Received</h1>
        </div>
        <div style="padding:32px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
            <p style="margin:0;font-size:18px;font-weight:bold;color:#002b49">${order.orderNumber}</p>
            <p style="margin:4px 0 0;font-size:14px;color:#666">&pound;${order.total.toFixed(2)} inc. VAT &middot; ${order.items.length} items</p>
          </div>

          <div style="display:flex;gap:24px;margin-bottom:24px">
            <div>
              <p style="font-size:12px;color:#999;text-transform:uppercase;margin:0 0 4px">Contact</p>
              <p style="margin:0;font-size:14px"><strong>${esc(order.contactName)}</strong></p>
              <p style="margin:2px 0;font-size:14px;color:#666">${esc(order.email)}</p>
              <p style="margin:0;font-size:14px;color:#666">${esc(order.phone)}</p>
            </div>
            <div>
              <p style="font-size:12px;color:#999;text-transform:uppercase;margin:0 0 4px">Site</p>
              <p style="margin:0;font-size:14px"><strong>${esc(order.siteName)}</strong></p>
              <p style="margin:2px 0;font-size:14px;color:#666">${esc(order.siteAddress)}</p>
            </div>
          </div>

          ${order.poNumber ? `<p style="font-size:14px;color:#666;margin-bottom:16px"><strong>PO Number:</strong> ${esc(order.poNumber)}</p>` : ""}

          ${order.notes ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin-bottom:24px"><p style="margin:0;font-size:13px;color:#c2410c"><strong>Notes:</strong> ${esc(order.notes)}</p></div>` : ""}

          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <thead>
              <tr style="background:#f5f5f5">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;width:48px"></th>
                <th style="padding:8px 8px;text-align:left;font-size:12px;color:#666;text-transform:uppercase">Product</th>
                <th style="padding:8px 8px;text-align:center;font-size:12px;color:#666;text-transform:uppercase">Qty</th>
                <th style="padding:8px 12px 8px 8px;text-align:right;font-size:12px;color:#666;text-transform:uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHtml(order.items)}
            </tbody>
            <tfoot>
              ${totalsHtml(order.subtotal, order.vat, order.total, order.items.some(i => !!i.custom_data))}
            </tfoot>
          </table>
        </div>
      </div>`,
  });

  if (error) {
    console.error("Resend team notification error:", JSON.stringify(error));
    throw new Error(`Team notification failed: ${error.message}`);
  }
  console.log(`Team notification email sent to ${teamEmail}`);
}
