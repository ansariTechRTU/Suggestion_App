import type { ReactNode } from 'react';
import { statusTone, statusLabel } from '../lib/format';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-[3px] font-display text-[10px]
        font-600 uppercase tracking-[0.1em] rounded-sm ${statusTone(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

export function PageHead({
  eyebrow,
  title,
  lead,
  action,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="mt-1 text-[26px] leading-tight font-700 text-navy-700">{title}</h1>
        {lead && <p className="mt-1.5 max-w-xl text-[15px] text-muted">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel px-6 py-12 text-center">
      <p className="text-[15px] text-muted">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-muted" role="status">
      <span className="h-3 w-3 animate-spin border-2 border-rule border-t-navy-700 rounded-full" />
      {label}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="border border-port/30 bg-port-50 px-4 py-3 text-sm text-port rounded-sm">
      {children}
    </div>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div>
      <div className="font-display text-[22px] font-700 leading-none text-navy-700">{value}</div>
      <div className="eyebrow mt-1">{label}</div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--color-navy-700)]"
      />
      <span>
        <span className="block text-[15px] font-500">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-muted">{hint}</span>}
      </span>
    </label>
  );
}
