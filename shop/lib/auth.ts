import { cookies } from "next/headers";

/** Check shop-auth cookie — returns true if valid */
export async function isShopAuthed(): Promise<boolean> {
  const token = process.env.SHOP_AUTH_TOKEN;
  if (!token) return true; // No token configured = no auth enforced
  const cookieStore = await cookies();
  return cookieStore.get("shop-auth")?.value === token;
}

/** Check admin-auth cookie — returns true if valid */
export async function isAdminAuthed(): Promise<boolean> {
  const token = process.env.ADMIN_AUTH_TOKEN;
  if (!token) return true;
  const cookieStore = await cookies();
  return cookieStore.get("admin-auth")?.value === token;
}
