import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const { orderNumber } = await params;
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Accepted: PDF, PNG, JPEG, WebP" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const { error: updateError } = await supabase
      .from("bal_orders")
      .update({
        dn_document_name: file.name,
        dn_document_data: base64,
        dn_document_type: file.type,
      })
      .eq("order_number", orderNumber);

    if (updateError) {
      console.error("DN upload DB error:", updateError);
      return NextResponse.json({ error: "Failed to save DN document" }, { status: 500 });
    }

    console.log(`DN document uploaded for ${orderNumber} — ${file.name} (${Math.round(file.size / 1024)}KB)`);
    return NextResponse.json({ success: true, message: "Delivery note uploaded" });
  } catch (error) {
    console.error("DN upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
