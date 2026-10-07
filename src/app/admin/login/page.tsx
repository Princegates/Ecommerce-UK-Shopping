import { redirect } from "next/navigation";
import LoginForm from "@/components/admin/LoginForm";
import { adminConfig, getAdmin } from "@/lib/auth";
import { landingPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ developer?: string }> }) {
  const sp = await searchParams;
  const who = await getAdmin();
  if (who) redirect(who.isSuper ? "/admin" : who.user?.mustChangePassword ? "/admin/account?must=1" : landingPage(who.permissions));
  const cfg = adminConfig();
  const developer = sp.developer === "1";
  return (
    <div className="mx-auto w-full max-w-md px-4 py-20">
      <p className="label">Staff only</p>
      <h1 className="text-3xl">{developer ? "Developer sign in" : "Admin sign in"}</h1>
      {cfg ? (
        <LoginForm devHint={cfg.isDevDefault} developer={developer} />
      ) : (
        <p className="box mt-8 p-5">Admin is locked. Set ADMIN_PASSWORD and ADMIN_SECRET (16+ characters) on the server, then restart.</p>
      )}
    </div>
  );
}
