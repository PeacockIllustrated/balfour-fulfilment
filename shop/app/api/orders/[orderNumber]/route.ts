import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const { orderNumber } = await params;
    const body = await req.json();

    const validStatuses = ["new", "awaiting_po", "in-progress", "completed", "cancelled"];
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("bal_orders")
      .update({ status: body.status })
      .eq("order_number", orderNumber)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Order updated",
      order: {
        orderNumber: data.order_number,
        status: data.status,
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const { orderNumber } = await params;

    const { data: order, error } = await supabase
      .from("bal_orders")
      .select("*")
      .eq("order_number", orderNumber)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { data: items } = await supabase
      .from("bal_order_items")
      .select("*")
      .eq("order_id", order.id);

    return NextResponse.json({
      orderNumber: order.order_number,
      createdAt: order.created_at,
      status: order.status,
      contact: { contactName: order.contact_name, email: order.email, phone: order.phone },
      site: { siteName: order.site_name, siteAddress: order.site_address },
      poNumber: order.po_number,
      notes: order.notes,
      items: (items || []).map((item) => ({
        code: item.code,
        name: item.name,
        size: item.size,
        price: Number(item.price),
        quantity: item.quantity,
        customData: item.custom_data || null,
      })),
      subtotal: Number(order.subtotal),
      vat: Number(order.vat),
      total: Number(order.total),
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
