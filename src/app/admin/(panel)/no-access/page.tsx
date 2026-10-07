import Link from "next/link";
import { PageHead } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { landingPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function NoAccess() {
  const who = await requireAdmin();
  const home = landingPage(who.permissions);
  return (
    <>
      <PageHead title="No access" />
      <div className="box box-shadow grid max-w-xl gap-3 p-5">
        <p className="font-semibold">Your account is not allowed to open that page.</p>
        <p className="text-ink-soft">If you need it, ask the super admin to change your access.</p>
        <Link href={home} className="btn btn-primary w-fit">Go to a page you can use</Link>
      </div>
    </>
  );
}
