import { DEPARTMENT_ICONS, departmentIconKey } from "@/lib/department-icons";

/** The line icon for a department, drawn in the current text colour. Decorative: the department's name sits beside it. */
export default function DepartmentIcon({ name, className = "h-8 w-8" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <path d={DEPARTMENT_ICONS[departmentIconKey(name)]} />
    </svg>
  );
}
