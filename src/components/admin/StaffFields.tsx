"use client";

import { useState } from "react";

type Perm = { key: string; group: string; label: string; help: string };
type Role = { key: string; label: string; help: string; permissions: string[] };

/** Role and rights for a staff account. Picking a role ticks its rights; changing any tick makes the role "Custom". */
export default function StaffFields({
  roles, permissions, initialRole, initialPerms,
}: { roles: Role[]; permissions: Perm[]; initialRole: string; initialPerms: string[] }) {
  const [role, setRole] = useState(initialRole);
  const [perms, setPerms] = useState<Set<string>>(new Set(initialPerms));
  const groups = [...new Set(permissions.map((p) => p.group))];
  const preset = roles.find((r) => r.key === role);

  function pickRole(next: string) {
    setRole(next);
    const r = roles.find((x) => x.key === next);
    if (r) setPerms(new Set(r.permissions));
  }
  function toggle(key: string, on: boolean) {
    const next = new Set(perms);
    if (on) next.add(key); else next.delete(key);
    setPerms(next);
    setRole("custom");
  }

  return (
    <div className="grid gap-4">
      <div className="field">
        <label className="label" htmlFor="staff-role">Role</label>
        <select id="staff-role" name="role" className="select" value={role} onChange={(e) => pickRole(e.target.value)}>
          {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          <option value="custom">Custom (choose below)</option>
        </select>
        <p className="hint">{preset ? preset.help : "Choose exactly what this person may do."}</p>
      </div>
      <fieldset className="grid gap-4 rounded-lg border border-line p-4">
        <legend className="label px-2 text-ink">What this person can do</legend>
        {groups.map((g) => (
          <div key={g} className="grid gap-2">
            <p className="text-sm font-bold">{g}</p>
            {permissions.filter((p) => p.group === g).map((p) => (
              <label key={p.key} className="flex items-start gap-2">
                <input type="checkbox" name="perm" value={p.key} checked={perms.has(p.key)} onChange={(e) => toggle(p.key, e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--green)]" />
                <span><span className="font-semibold">{p.label}</span><span className="block text-xs text-ink-soft">{p.help}</span></span>
              </label>
            ))}
          </div>
        ))}
      </fieldset>
    </div>
  );
}
