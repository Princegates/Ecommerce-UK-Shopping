/**
 * What a staff member can do in the admin. The super admin (the developer, who holds ADMIN_PASSWORD) can do everything and is the
 * only one who can manage staff accounts, so "users.manage" is deliberately not in this list and can never be granted.
 */

export const PERMISSIONS = [
  { key: "dashboard.view", group: "Overview", label: "See the dashboard", help: "Sales, revenue and customer figures." },
  { key: "orders.view", group: "Sales", label: "See orders", help: "Order list and details, including customer names, phones and addresses." },
  { key: "orders.manage", group: "Sales", label: "Update orders", help: "Change order status, add tracking, cancel and refund." },
  { key: "orders.costs", group: "Sales", label: "Record costs and see margins", help: "What the team paid to buy and ship items, and the profit on each order." },
  { key: "orders.export", group: "Sales", label: "Download the orders file", help: "Export orders with customer details as a spreadsheet." },
  { key: "customers.view", group: "Sales", label: "See customers", help: "Customer accounts, contact details and order history." },
  { key: "customers.manage", group: "Sales", label: "Manage customers", help: "Disable or enable accounts and create password-reset links." },
  { key: "requests.manage", group: "Sales", label: "Handle link requests", help: "Quote link requests, and set the automatic-quote rules." },
  { key: "shops.manage", group: "Catalogue", label: "Manage shops", help: "Add, edit and delete shops and their logos." },
  { key: "items.manage", group: "Catalogue", label: "Manage items", help: "Add, edit and hide items, photos and deals." },
  { key: "sources.manage", group: "Catalogue", label: "Manage catalogue sources", help: "Feeds, Shopify, eBay and file imports." },
  { key: "import.review", group: "Catalogue", label: "Review imported items", help: "Approve or reject items waiting in Import review." },
  { key: "reviews.manage", group: "Catalogue", label: "Moderate reviews", help: "Publish or hide customer reviews." },
  { key: "pricing.manage", group: "Pricing and delivery", label: "Change prices and delivery", help: "Service charge, exchange rate, shipping rates and delivery areas." },
  { key: "appearance.manage", group: "System", label: "Change the look of the site", help: "Colour themes." },
  { key: "integrations.manage", group: "System", label: "Manage integrations and keys", help: "Payment, SMS, email and other service keys. Very sensitive." },
  { key: "messages.view", group: "System", label: "See messages sent", help: "The log of messages sent to customers." },
  { key: "messages.manage", group: "System", label: "Manage messages", help: "Retry failed messages and choose which updates are sent." },
  { key: "audit.view", group: "System", label: "See the activity log", help: "Who changed what, and when." },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];
export const PERMISSION_KEYS: Permission[] = PERMISSIONS.map((p) => p.key);
export const isPermission = (v: unknown): v is Permission => typeof v === "string" && (PERMISSION_KEYS as string[]).includes(v);

/** Granting a change right also grants the matching view right, so nobody can edit what they cannot see. */
const IMPLIES: Partial<Record<Permission, Permission[]>> = {
  "orders.manage": ["orders.view"], "orders.costs": ["orders.view"], "orders.export": ["orders.view"],
  "customers.manage": ["customers.view"], "messages.manage": ["messages.view"],
};

export function normalizePermissions(list: unknown): Permission[] {
  const set = new Set<Permission>();
  for (const v of Array.isArray(list) ? list : []) if (isPermission(v)) set.add(v);
  for (const p of [...set]) for (const extra of IMPLIES[p] ?? []) set.add(extra);
  return PERMISSION_KEYS.filter((k) => set.has(k));
}

export type RoleKey = "manager" | "operations" | "support" | "catalogue" | "finance" | "viewer" | "custom";

export const ROLES: { key: Exclude<RoleKey, "custom">; label: string; help: string; permissions: Permission[] }[] = [
  { key: "manager", label: "Manager", help: "Everything except staff accounts.", permissions: PERMISSION_KEYS },
  {
    key: "operations", label: "Operations", help: "Runs orders, customers and link requests.",
    permissions: ["dashboard.view", "orders.view", "orders.manage", "orders.export", "customers.view", "requests.manage", "messages.view"],
  },
  { key: "support", label: "Customer support", help: "Helps customers and quotes link requests. Cannot change orders.", permissions: ["orders.view", "customers.view", "requests.manage", "messages.view"] },
  { key: "catalogue", label: "Catalogue editor", help: "Shops, items, sources, imports and reviews.", permissions: ["shops.manage", "items.manage", "sources.manage", "import.review", "reviews.manage"] },
  { key: "finance", label: "Finance", help: "Sees sales and records costs. Cannot change orders or prices.", permissions: ["dashboard.view", "orders.view", "orders.costs", "orders.export", "audit.view"] },
  { key: "viewer", label: "Read-only", help: "Can look at the dashboard, orders and customers, but change nothing.", permissions: ["dashboard.view", "orders.view", "customers.view"] },
];

export const ROLE_LABEL: Record<RoleKey, string> = {
  ...Object.fromEntries(ROLES.map((r) => [r.key, r.label])),
  custom: "Custom",
} as Record<RoleKey, string>;

export const isRole = (v: unknown): v is RoleKey => v === "custom" || ROLES.some((r) => r.key === v);

export function presetFor(role: RoleKey): Permission[] {
  return normalizePermissions(ROLES.find((r) => r.key === role)?.permissions ?? []);
}

/** The first admin page a person with these permissions can open, used when the dashboard is not one of them. */
export const LANDING: [Permission, string][] = [
  ["dashboard.view", "/admin"], ["orders.view", "/admin/orders"], ["customers.view", "/admin/customers"], ["requests.manage", "/admin/requests"],
  ["shops.manage", "/admin/shops"], ["items.manage", "/admin/items"], ["sources.manage", "/admin/sources"], ["import.review", "/admin/import"],
  ["reviews.manage", "/admin/reviews"], ["pricing.manage", "/admin/pricing"], ["appearance.manage", "/admin/appearance"],
  ["integrations.manage", "/admin/integrations"], ["messages.view", "/admin/messages"], ["audit.view", "/admin/audit"],
];

export function landingPage(perms: ReadonlySet<Permission>): string {
  return LANDING.find(([p]) => perms.has(p))?.[1] ?? "/admin/account";
}
