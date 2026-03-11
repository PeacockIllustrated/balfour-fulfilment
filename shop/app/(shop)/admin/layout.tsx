import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminToken = process.env.ADMIN_AUTH_TOKEN;

  if (adminToken) {
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("admin-auth")?.value;
    if (adminCookie !== adminToken) {
      redirect("/login?mode=admin");
    }
  }

  return <>{children}</>;
}
