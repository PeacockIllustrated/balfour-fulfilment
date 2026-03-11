import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed, remaining } = rateLimit(ip);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    const { password, mode } = await req.json();

    const shopPassword = process.env.SHOP_PASSWORD;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (mode === "admin") {
      if (password !== adminPassword) {
        return NextResponse.json(
          { error: "Incorrect password", remaining },
          { status: 401 }
        );
      }

      // Admin gets both cookies
      const res = NextResponse.json({ success: true, mode: "admin" });
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      };
      res.cookies.set("shop-auth", process.env.SHOP_AUTH_TOKEN!, cookieOptions);
      res.cookies.set("admin-auth", process.env.ADMIN_AUTH_TOKEN!, cookieOptions);
      return res;
    }

    // Shop login
    if (password !== shopPassword) {
      return NextResponse.json(
        { error: "Incorrect password", remaining },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ success: true, mode: "shop" });
    res.cookies.set("shop-auth", process.env.SHOP_AUTH_TOKEN!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
