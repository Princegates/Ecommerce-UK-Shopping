import type { Metadata } from "next";
import Link from "next/link";
import { ProfileForm } from "@/components/account/AccountForms";
import { requireCustomer } from "@/lib/customer-session";
import { getZones } from "@/lib/settings";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const c = await requireCustomer("/account/profile");
  return (
    <>
      <p className="label">Your account</p>
      <h1 className="text-5xl">Profile</h1>
      <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-2 text-sm">
        <div><dt className="label">Phone</dt><dd>{c.phone}</dd></div>
        <div><dt className="label">Email</dt><dd>{c.email ?? "Not added"}</dd></div>
        <div><dt className="label">Member since</dt><dd className="num">{c.createdAt.slice(0, 10)}</dd></div>
      </dl>
      <p className="mt-2 text-sm"><Link href="/account/security" className="link">Change phone, email or password</Link></p>
      <div className="mt-6">
        <ProfileForm customer={c} zones={getZones().map((z) => ({ id: z.id, name: z.name }))} />
      </div>
    </>
  );
}
