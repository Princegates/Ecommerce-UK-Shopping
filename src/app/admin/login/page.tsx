import { redirect } from "next/navigation";
import LoginForm from "@/components/admin/LoginForm";
import { adminConfig, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  const cfg = adminConfig();
  return (
    <div className="mx-auto w-full max-w-md px-4 py-20">
      <p className="label">Staff only</p>
      <h1 className="text-3xl">Admin sign in</h1>
      {cfg ? (
        <LoginForm devHint={cfg.isDevDefault} />
      ) : (
        <p className="box mt-8 p-5">Admin is locked. Set ADMIN_PASSWORD and ADMIN_SECRET (16+ characters) on the server, then restart.</p>
      )}
    </div>
  );
}
