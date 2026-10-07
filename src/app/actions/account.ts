"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { appUrl } from "@/lib/app-url";
import { clientKey } from "@/lib/auth";
import {
  authenticate, changePassword, changeSignInDetails, createResetToken, deleteAccount, deleteAddress, deleteOtherSessions,
  findCustomerForReset, markUpdatesSeen, registerCustomer, resetPassword, saveAddress, setDefault, updateProfile,
} from "@/lib/customers";
import { currentSessionToken, endCustomerSession, requireCustomer, safeNext, startCustomerSession } from "@/lib/customer-session";
import { enqueueDirect } from "@/lib/notify/outbox";
import { kickOutbox } from "@/lib/notify/kick";
import { renderResetMessage } from "@/lib/notify/templates";
import { getSettings } from "@/lib/settings";
import { createLimiter } from "@/lib/throttle";
import { RESET_MINUTES } from "@/lib/customers";

export type FormState = { error?: string; done?: boolean; message?: string; values?: Record<string, string> };

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

// Failed sign-ins: per client and per account, so a script cannot guess one account's password
// from many addresses, nor many accounts from one address.
const loginByIp = createLimiter(15, 15 * 60 * 1000);
const loginByAccount = createLimiter(6, 15 * 60 * 1000);
const signupByIp = createLimiter(10, 60 * 60 * 1000);
const resetByIp = createLimiter(6, 60 * 60 * 1000);
const resetByAccount = createLimiter(3, 60 * 60 * 1000);

// ------------------------------------------------------------------ sign in

export async function loginAction(_prev: FormState, f: FormData): Promise<FormState> {
  const identifier = str(f, "identifier").trim();
  const values = { identifier };
  if (!identifier || !str(f, "password")) return { error: "Enter your phone or email and your password.", values };
  const ip = `ip:${await clientKey()}`;
  const acct = `acct:${identifier.toLowerCase().replace(/\s+/g, "")}`;
  if (!loginByIp.allowed(ip) || !loginByAccount.allowed(acct)) return { error: "Too many attempts. Please wait 15 minutes, or reset your password.", values };

  const customer = await authenticate(identifier, str(f, "password"));
  if (!customer) {
    loginByIp.record(ip);
    loginByAccount.record(acct);
    return { error: "That phone, email or password is not right.", values };
  }
  loginByAccount.clear(acct);
  await startCustomerSession(customer.id);
  revalidatePath("/", "layout");
  redirect(safeNext(str(f, "next")));
}

export async function registerAction(_prev: FormState, f: FormData): Promise<FormState> {
  const values = { name: str(f, "name"), phone: str(f, "phone"), email: str(f, "email") };
  if (str(f, "password") !== str(f, "confirm")) return { error: "The two passwords do not match.", values };
  const ip = `ip:${await clientKey()}`;
  if (!signupByIp.allowed(ip)) return { error: "Too many sign-ups from this connection. Please try again later.", values };
  signupByIp.record(ip);

  const res = await registerCustomer({ ...values, password: str(f, "password") });
  if (!res.ok) return { error: res.error, values };
  await startCustomerSession(res.customer.id);
  revalidatePath("/", "layout");
  redirect(safeNext(str(f, "next")));
}

export async function logoutAction(): Promise<void> {
  await endCustomerSession();
  revalidatePath("/", "layout");
  redirect("/");
}

// ----------------------------------------------------------- password reset

/** Always answers the same way, so nobody can use this form to find out who has an account. */
export async function forgotPasswordAction(_prev: FormState, f: FormData): Promise<FormState> {
  const identifier = str(f, "identifier").trim();
  if (!identifier) return { error: "Enter the phone number or email on your account.", values: { identifier } };
  const ip = `ip:${await clientKey()}`;
  const acct = `acct:${identifier.toLowerCase().replace(/\s+/g, "")}`;
  if (resetByIp.allowed(ip) && resetByAccount.allowed(acct)) {
    resetByIp.record(ip);
    resetByAccount.record(acct);
    const customer = findCustomerForReset(identifier);
    const base = appUrl();
    if (customer && base) {
      const token = createResetToken(customer.id);
      const rendered = renderResetMessage(getSettings().siteName, `${base}/reset-password/${token}`, RESET_MINUTES);
      enqueueDirect({ phone: customer.phone, email: customer.email ?? undefined }, rendered, "password_reset");
      kickOutbox();
    }
  }
  return { done: true };
}

export async function resetPasswordAction(_prev: FormState, f: FormData): Promise<FormState> {
  if (str(f, "password") !== str(f, "confirm")) return { error: "The two passwords do not match." };
  const res = await resetPassword(str(f, "token"), str(f, "password"));
  if (!res.ok) return { error: res.error };
  await startCustomerSession(res.customer.id);
  revalidatePath("/", "layout");
  redirect("/account?reset=1");
}

// ------------------------------------------------------------------ profile

const profileSchema = z.object({ name: z.string().trim().min(2, "Enter your full name.").max(80) });

export async function updateProfileAction(_prev: FormState, f: FormData): Promise<FormState> {
  const c = await requireCustomer("/account/profile");
  const parsed = profileSchema.safeParse({ name: str(f, "name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const zone = Number(str(f, "defaultZoneId"));
  const res = updateProfile(c.id, {
    name: parsed.data.name,
    notifySms: f.get("notifySms") === "on",
    notifyEmail: f.get("notifyEmail") === "on",
    notifyWhatsapp: f.get("notifyWhatsapp") === "on",
    defaultZoneId: Number.isInteger(zone) && zone > 0 ? zone : null,
  });
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  return { done: true, message: "Profile saved." };
}

export async function changeSignInAction(_prev: FormState, f: FormData): Promise<FormState> {
  const c = await requireCustomer("/account/security");
  const res = await changeSignInDetails(c.id, { phone: str(f, "phone"), email: str(f, "email"), currentPassword: str(f, "currentPassword") });
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  return { done: true, message: "Sign-in details updated." };
}

export async function changePasswordAction(_prev: FormState, f: FormData): Promise<FormState> {
  const c = await requireCustomer("/account/security");
  if (str(f, "next") !== str(f, "confirm")) return { error: "The two new passwords do not match." };
  const res = await changePassword(c.id, str(f, "current"), str(f, "next"), await currentSessionToken());
  if (!res.ok) return { error: res.error };
  return { done: true, message: "Password changed. Your other devices were signed out." };
}

export async function logoutOthersAction(): Promise<void> {
  const c = await requireCustomer("/account/security");
  deleteOtherSessions(c.id, await currentSessionToken());
  revalidatePath("/account/security");
}

export async function deleteAccountAction(_prev: FormState, f: FormData): Promise<FormState> {
  const c = await requireCustomer("/account/security");
  if (str(f, "confirm").trim().toUpperCase() !== "DELETE") return { error: "Type DELETE to confirm." };
  const res = await deleteAccount(c.id, str(f, "password"));
  if (!res.ok) return { error: res.error };
  await endCustomerSession();
  revalidatePath("/", "layout");
  redirect("/?account=deleted");
}

// ---------------------------------------------------------------- addresses

export async function saveAddressAction(_prev: FormState, f: FormData): Promise<FormState> {
  const c = await requireCustomer("/account/addresses");
  const id = Number(str(f, "id")) || undefined;
  const zone = Number(str(f, "zoneId"));
  const res = saveAddress(c.id, {
    id,
    label: str(f, "label"),
    recipient: str(f, "recipient"),
    phone: str(f, "phone"),
    zoneId: Number.isInteger(zone) && zone > 0 ? zone : null,
    address: str(f, "address"),
    landmark: str(f, "landmark"),
    makeDefault: f.get("makeDefault") === "on",
  });
  if (!res.ok) return { error: res.error, values: Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)])) };
  revalidatePath("/account/addresses");
  return { done: true, message: id ? "Address updated." : "Address saved." };
}

export async function deleteAddressAction(f: FormData): Promise<void> {
  const c = await requireCustomer("/account/addresses");
  deleteAddress(c.id, Number(str(f, "id")));
  revalidatePath("/account/addresses");
}

export async function defaultAddressAction(f: FormData): Promise<void> {
  const c = await requireCustomer("/account/addresses");
  setDefault(c.id, Number(str(f, "id")));
  revalidatePath("/account/addresses");
}

export async function markUpdatesSeenAction(): Promise<void> {
  const c = await requireCustomer("/account/updates");
  markUpdatesSeen(c.id);
  revalidatePath("/", "layout");
}
