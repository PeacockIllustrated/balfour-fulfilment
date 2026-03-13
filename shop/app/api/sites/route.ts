import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isShopAuthed, isAdminAuthed } from "@/lib/auth";

export async function GET() {
  if (!(await isShopAuthed()) && !(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("bal_sites")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Fetch sites error:", error);
    return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 });
  }

  return NextResponse.json({ sites: data });
}

export async function POST(req: NextRequest) {
  if (!(await isShopAuthed()) && !(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const address = String(body.address || "").trim();

    if (!name || name.length > 200) {
      return NextResponse.json({ error: "Name is required (max 200 chars)" }, { status: 400 });
    }
    if (!address || address.length > 500) {
      return NextResponse.json({ error: "Address is required (max 500 chars)" }, { status: 400 });
    }

    // Check for existing site with same name (upsert semantics)
    const { data: existing } = await supabase
      .from("bal_sites")
      .select("*")
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(existing, { status: 200 });
    }

    const { data, error } = await supabase
      .from("bal_sites")
      .insert({ name, address })
      .select()
      .single();

    if (error) {
      console.error("Create site error:", error);
      return NextResponse.json({ error: "Failed to create site" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
