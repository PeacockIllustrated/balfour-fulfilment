import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BasketProvider } from "@/components/BasketContext";
import Header from "@/components/Header";
import Toast from "@/components/Toast";
import SplashScreen from "@/components/SplashScreen";
import SuggestionWidget from "@/components/SuggestionWidget";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shopToken = process.env.SHOP_AUTH_TOKEN;
  const adminToken = process.env.ADMIN_AUTH_TOKEN;

  // Only enforce auth if tokens are configured (prevents lockout during setup)
  if (shopToken && adminToken) {
    const cookieStore = await cookies();
    const shopCookie = cookieStore.get("shop-auth")?.value;
    if (shopCookie !== shopToken) {
      redirect("/login");
    }
  }

  return (
    <BasketProvider>
      <SplashScreen />
      <Header />
      <main className="min-h-screen">{children}</main>
      <Toast />
      <SuggestionWidget />
    </BasketProvider>
  );
}
