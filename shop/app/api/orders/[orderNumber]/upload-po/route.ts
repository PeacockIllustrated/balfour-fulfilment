import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateRaisePoToken } from "@/lib/email";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const token = req.nextUrl.searchParams.get("t");

    // Validate token
    const expected = generateRaisePoToken(orderNumber);
    if (!token || token !== expected) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Accepted: PDF, PNG, JPEG, WebP" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

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

    // Update order with PO document
    const { error: updateError } = await supabase
      .from("bal_orders")
      .update(updates)
      .eq("order_number", orderNumber);

    if (updateError) {
      console.error("PO upload DB error:", updateError);
      return NextResponse.json({ error: "Failed to save PO document" }, { status: 500 });
    }

    console.log(`PO document uploaded for ${orderNumber} — ${file.name} (${Math.round(file.size / 1024)}KB)`);

    return NextResponse.json({ success: true, message: "PO document uploaded" });
  } catch (error) {
    console.error("PO upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
