import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateRaisePoToken, buildPurchaserPOEmailHtml } from "@/lib/email";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  const token = req.nextUrl.searchParams.get("t");

  // Validate token
  const expected = generateRaisePoToken(orderNumber);
  if (!token || token !== expected) {
    return new NextResponse(
      "<h1>Invalid or expired link</h1>",
      { status: 403, headers: { "Content-Type": "text/html" } }
    );
  }

  try {
    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from("bal_orders")
      .select("*")
      .eq("order_number", orderNumber)
      .single();

    if (orderError || !order) {
      return new NextResponse(
        "<h1>Order not found</h1>",
        { status: 404, headers: { "Content-Type": "text/html" } }
      );
    }

    // If already processed, show a "done" page
    if (!["new", "awaiting_po"].includes(order.status)) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>PO Already Raised</title></head>
        <body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8faf9">
          <div style="text-align:center;padding:40px;background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:400px">
            <div style="width:48px;height:48px;background:#002b49;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center">
              <span style="color:white;font-size:24px">&#10003;</span>
            </div>
            <h1 style="color:#002b49;font-size:20px;margin:0 0 8px">PO Already Raised</h1>
            <p style="color:#666;font-size:14px;margin:0">Order <strong>${orderNumber}</strong> has already been processed.</p>
          </div>
        </body></html>`,
        { status: 200, headers: { "Content-Type": "text/html" } }
      );
    }

    const siteUrl = process.env.SITE_URL || "http://localhost:3000";
    const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL;

    // Build purchaser email payload if purchaser exists
    let purchaserEmailSubject: string | null = null;
    let purchaserEmailHtml: string | null = null;

    if (order.purchaser_email) {
      const poUploadUrl = `${siteUrl}/po-upload/${orderNumber}?t=${token}`;

      // Fetch items for the purchaser email
      const { data: items } = await supabase
        .from("bal_order_items")
        .select("*")
        .eq("order_id", order.id);

      const orderData = {
        orderNumber: order.order_number,
        contactName: order.contact_name,
        email: order.email,
        phone: order.phone,
        siteName: order.site_name,
        siteAddress: order.site_address,
        poNumber: order.po_number,
        notes: order.notes,
        purchaserName: order.purchaser_name,
        purchaserEmail: order.purchaser_email,
        items: (items || []).map((item: Record<string, unknown>) => ({
          code: item.code as string,
          base_code: item.base_code as string | null,
          name: item.name as string,
          size: item.size as string | null,
          material: item.material as string | null,
          price: Number(item.price),
          quantity: item.quantity as number,
          line_total: Number(item.line_total),
          custom_data: item.custom_data || null,
        })),
        subtotal: Number(order.subtotal),
        vat: Number(order.vat),
        total: Number(order.total),
      };

      const purchaserEmail = buildPurchaserPOEmailHtml(orderData, poUploadUrl);
      purchaserEmailSubject = purchaserEmail.subject;
      purchaserEmailHtml = purchaserEmail.html;
    }

    // Fire Make webhook
    if (makeWebhookUrl) {
      await fetch(makeWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: "balfour",
          isPO: true,
          orderNumber: order.order_number,
          contactName: order.contact_name,
          contactEmail: order.email,
          contactPhone: order.phone,
          siteName: order.site_name,
          siteAddress: order.site_address,
          poNumber: order.po_number,
          notes: order.notes,
          purchaserName: order.purchaser_name || null,
          purchaserEmail: order.purchaser_email || null,
          purchaserEmailSubject,
          purchaserEmailHtml,
          subtotal: Number(order.subtotal),
          vat: Number(order.vat),
          total: Number(order.total),
        }),
      })
        .then((r) => console.log(`Raise PO webhook fired for ${orderNumber} — ${r.status}`))
        .catch((e) => console.error("Raise PO webhook failed:", e));
    }

    // Update status to awaiting_po
    if (order.status === "new") {
      await supabase
        .from("bal_orders")
        .update({ status: "awaiting_po" })
        .eq("order_number", orderNumber);
    }

    // Return branded confirmation page
    return new NextResponse(
      `<!DOCTYPE html>
      <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>PO Request Sent</title></head>
      <body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f7fc">
        <div style="text-align:center;padding:40px;background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:440px;margin:20px">
          <div style="width:56px;height:56px;background:#002b49;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center">
            <span style="color:white;font-size:28px">&#10003;</span>
          </div>
          <h1 style="color:#002b49;font-size:22px;margin:0 0 8px">PO Request Sent</h1>
          <p style="color:#666;font-size:14px;margin:0 0 16px;line-height:1.5">
            Order <strong>${orderNumber}</strong> has been forwarded${order.purchaser_email ? ` to <strong>${order.purchaser_name || order.purchaser_email}</strong>` : ""} for purchase order processing.
          </p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-top:16px">
            <p style="margin:0;font-size:13px;color:#166534">The purchaser will receive an email with a link to upload the PO document.</p>
          </div>
        </div>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("Raise PO error:", error);
    return new NextResponse(
      "<h1>Something went wrong</h1><p>Please try again or raise the PO from the admin dashboard.</p>",
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
