import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

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
      .select("dn_document_name, dn_document_data, dn_document_type")
      .eq("order_number", orderNumber)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (!order.dn_document_data) {
      return NextResponse.json({ error: "No delivery note uploaded" }, { status: 404 });
    }

    const buffer = Buffer.from(order.dn_document_data, "base64");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": order.dn_document_type || "application/pdf",
        "Content-Disposition": `attachment; filename="${order.dn_document_name || `dn-${orderNumber}.pdf`}"`,
      },
    });
  } catch (error) {
    console.error("DN download error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
