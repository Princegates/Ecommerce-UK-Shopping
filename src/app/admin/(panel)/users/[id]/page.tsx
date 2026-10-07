import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteStaffAction, resetStaffPasswordAction, setStaffStatusAction, updateStaffAction } from "@/app/admin/users-actions";
import PasswordField from "@/components/admin/PasswordField";
import StaffFields from "@/components/admin/StaffFields";
import { Check, Flash, PageHead, Text } from "@/components/admin/ui";
import { getAdminUser } from "@/lib/admin-users";
import { requireSuper } from "@/lib/auth";
import { PERMISSIONS, ROLES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function StaffDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string; created?: string; reset?: string }> }) {
  await requireSuper();
  const { id } = await params;
  const sp = await searchParams;
  const u = getAdminUser(Number(id));
  if (!u) notFound();
  return (
    <>
      <PageHead title={u.name}>
        <Link href="/admin/users" className="link">← All staff</Link>
      </PageHead>
      <Flash saved={sp.saved} error={sp.error} />
      {sp.created && <p role="status" className="box mb-6 bg-gold/40 p-3 font-semibold">Account created. Give {u.name} their first password and the admin address. They choose their own password when they first sign in.</p>}
      {sp.reset && <p role="status" className="box mb-6 bg-gold/40 p-3 font-semibold">Password reset. {u.name} must choose a new one at their next sign-in, and any open sessions were signed out.</p>}

      <section className="box box-shadow mb-8 grid gap-1 p-5 text-sm">
        <p><span className="font-semibold">Email:</span> {u.email}</p>
        <p><span className="font-semibold">Status:</span> {u.status === "ACTIVE" ? "Active" : "Switched off (cannot sign in)"}</p>
        <p><span className="font-semibold">Created:</span> {u.createdAt.slice(0, 10)}{u.createdBy ? ` by ${u.createdBy}` : ""} · <span className="font-semibold">Last sign-in:</span> {u.lastLoginAt ? `${u.lastLoginAt.slice(0, 16)} UTC` : "never"}</p>
        <p><span className="font-semibold">Password:</span> {u.mustChangePassword ? "not yet chosen by them" : "chosen by them"}</p>
        <form action={setStaffStatusAction} className="mt-3">
          <input type="hidden" name="id" value={u.id} />
          <input type="hidden" name="status" value={u.status === "ACTIVE" ? "DISABLED" : "ACTIVE"} />
          <button className={`btn btn-small ${u.status === "ACTIVE" ? "btn-danger" : "btn-primary"}`}>{u.status === "ACTIVE" ? "Switch this account off" : "Switch this account on"}</button>
        </form>
      </section>

      <form action={updateStaffAction} className="box box-shadow mb-8 grid gap-5 p-5">
        <h2 className="text-2xl">Name and access</h2>
        <input type="hidden" name="id" value={u.id} />
        <Text label="Name" name="name" id="edit-name" defaultValue={u.name} required />
        <StaffFields roles={ROLES} permissions={[...PERMISSIONS]} initialRole={u.role} initialPerms={u.permissions} />
        <p className="hint">Saving signs this person out, so the new access applies the next time they sign in.</p>
        <div><button className="btn btn-primary">Save access</button></div>
      </form>

      <form action={resetStaffPasswordAction} className="box box-shadow mb-8 grid gap-4 p-5">
        <h2 className="text-2xl">Reset password</h2>
        <input type="hidden" name="id" value={u.id} />
        <PasswordField label="New first password" hint="They are signed out everywhere and must choose their own password at their next sign-in." />
        <div><button className="btn">Reset password</button></div>
      </form>

      <form action={deleteStaffAction} className="grid gap-3 rounded-2xl border border-red/40 p-5">
        <h2 className="text-xl font-bold text-red">Delete this account</h2>
        <input type="hidden" name="id" value={u.id} />
        <p className="text-sm text-ink-soft">The person can no longer sign in. What they did stays in the activity log under their name. To keep the account for later, switch it off instead.</p>
        <Check label={`Yes, delete ${u.name}'s account`} name="confirm" />
        <div><button className="btn btn-danger">Delete account</button></div>
      </form>
    </>
  );
}
