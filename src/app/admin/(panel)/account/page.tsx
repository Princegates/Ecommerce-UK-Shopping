import ChangePasswordForm from "@/components/admin/ChangePasswordForm";
import { PageHead } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { PERMISSIONS, ROLE_LABEL } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ must?: string }> }) {
  const who = await requireAdmin({ allowPasswordChange: true });
  const sp = await searchParams;
  const u = who.user;
  return (
    <>
      <PageHead title="My account" />
      {!u ? (
        <section className="box box-shadow grid max-w-xl gap-2 p-5">
          <p className="font-semibold">Super admin</p>
          <p className="text-ink-soft">You are signed in with the developer password, which can do everything and manage staff accounts. It is set on the server (ADMIN_PASSWORD), not here.</p>
        </section>
      ) : (
        <div className="grid gap-8">
          {(sp.must || u.mustChangePassword) && (
            <p role="status" className="box max-w-xl bg-gold/40 p-3 font-semibold">Welcome. Please choose your own password before you start. Until you do, the rest of the admin is closed.</p>
          )}
          <section className="box box-shadow grid max-w-xl gap-1 p-5 text-sm">
            <p><span className="font-semibold">Name:</span> {u.name}</p>
            <p><span className="font-semibold">Email:</span> {u.email}</p>
            <p><span className="font-semibold">Role:</span> {ROLE_LABEL[u.role]}</p>
            <p className="mt-2 font-semibold">You can:</p>
            <ul className="grid list-disc gap-0.5 pl-5">
              {PERMISSIONS.filter((p) => who.permissions.has(p.key)).map((p) => <li key={p.key}>{p.label}</li>)}
              {who.permissions.size === 0 && <li>Nothing yet. Ask the super admin for access.</li>}
            </ul>
            <p className="mt-2 text-ink-soft">Only the super admin can change what you can do.</p>
          </section>
          <section>
            <h2 className="mb-3 text-2xl">Change password</h2>
            <ChangePasswordForm />
          </section>
        </div>
      )}
    </>
  );
}
