import Link from "next/link";
import { createStaffAction } from "@/app/admin/users-actions";
import PasswordField from "@/components/admin/PasswordField";
import StaffFields from "@/components/admin/StaffFields";
import { Flash, PageHead, Text } from "@/components/admin/ui";
import { listAdminUsers } from "@/lib/admin-users";
import { requireSuper } from "@/lib/auth";
import { PERMISSIONS, ROLES, ROLE_LABEL } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireSuper();
  const sp = await searchParams;
  const users = listAdminUsers();
  return (
    <>
      <PageHead title="Staff accounts" />
      <p className="mb-6 max-w-2xl text-ink-soft">
        Only the super admin sees this page. Give each person their own account and only the access they need. They sign in with their email at the usual admin
        address; you can switch an account off, change what it can do, or reset its password at any time.
      </p>
      <Flash saved={sp.saved} error={sp.error} />

      <details className="box box-shadow mb-8" open={users.length === 0}>
        <summary className="cursor-pointer p-4 text-xl font-bold">+ Add a staff account</summary>
        <form action={createStaffAction} className="grid gap-5 border-t border-line p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Name" name="name" id="new-name" required />
            <Text label="Email (their sign-in)" name="email" id="new-email" type="email" required />
          </div>
          <PasswordField label="First password" hint="Give it to them yourself. They must choose their own at their first sign-in." />
          <StaffFields roles={ROLES} permissions={[...PERMISSIONS]} initialRole="support" initialPerms={ROLES.find((r) => r.key === "support")!.permissions} />
          <div><button className="btn btn-primary">Create account</button></div>
        </form>
      </details>

      {users.length === 0 ? (
        <p>No staff accounts yet. You are the only person who can sign in.</p>
      ) : (
        <ul className="grid gap-3">
          {users.map((u) => (
            <li key={u.id} className="box flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold">
                  <Link href={`/admin/users/${u.id}`} className="link">{u.name}</Link>
                  {u.status === "DISABLED" && <span className="tag tag-red ml-2">Switched off</span>}
                  {u.mustChangePassword && <span className="tag ml-2">Has not set a password yet</span>}
                </p>
                <p className="text-sm text-ink-soft">{u.email} · {ROLE_LABEL[u.role]} · last sign-in {u.lastLoginAt ? u.lastLoginAt.slice(0, 16) + " UTC" : "never"}</p>
              </div>
              <Link href={`/admin/users/${u.id}`} className="btn btn-small">Manage</Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
