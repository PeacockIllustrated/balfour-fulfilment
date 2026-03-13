import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isShopAuthed, isAdminAuthed } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  if (!(await isShopAuthed()) && !(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("bal_contacts")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Fetch contacts error:", error);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }

  return NextResponse.json({ contacts: data });
}

export async function POST(req: NextRequest) {
  if (!(await isShopAuthed()) && !(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();

    if (!name || name.length > 200) {
      return NextResponse.json({ error: "Name is required (max 200 chars)" }, { status: 400 });
    }
    if (!email || !EMAIL_RE.test(email) || email.length > 200) {
      return NextResponse.json({ error: "Valid email is required (max 200 chars)" }, { status: 400 });
    }
    if (!phone || phone.length > 50) {
      return NextResponse.json({ error: "Phone is required (max 50 chars)" }, { status: 400 });
    }

    // Check for existing contact with same email (upsert semantics)
    const { data: existing } = await supabase
      .from("bal_contacts")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(existing, { status: 200 });
    }

    const { data, error } = await supabase
      .from("bal_contacts")
      .insert({ name, email, phone })
      .select()
      .single();

    if (error) {
      console.error("Create contact error:", error);
      return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await isShopAuthed()) && !(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();

    if (!id) {
      return NextResponse.json({ error: "Contact id is required" }, { status: 400 });
    }
    if (!name || name.length > 200) {
      return NextResponse.json({ error: "Name is required (max 200 chars)" }, { status: 400 });
    }
    if (!email || !EMAIL_RE.test(email) || email.length > 200) {
      return NextResponse.json({ error: "Valid email is required (max 200 chars)" }, { status: 400 });
    }
    if (!phone || phone.length > 50) {
      return NextResponse.json({ error: "Phone is required (max 50 chars)" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("bal_contacts")
      .update({ name, email, phone })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isShopAuthed()) && !(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json({ error: "Contact id is required" }, { status: 400 });
    }

    // Nullify FK on orders so snapshot text fields are preserved
    await supabase.from("bal_orders").update({ contact_id: null }).eq("contact_id", id);

    const { error } = await supabase.from("bal_contacts").delete().eq("id", id);

    if (error) {
      console.error("Delete contact error:", error);
      return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
    }

    return NextResponse.json({ message: "Contact deleted" });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
