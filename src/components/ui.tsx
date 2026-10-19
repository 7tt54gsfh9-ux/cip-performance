import { useEffect, useState, type ReactNode } from 'react';

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:shadow-none print:break-inside-avoid">
      {title && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-zinc-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-zinc-500">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-100 disabled:text-zinc-500';

export function NumField({
  label,
  value,
  onChange,
  unit,
  hint,
  min,
  max,
  allowEmpty,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  unit?: string;
  hint?: ReactNode;
  min?: number;
  max?: number;
  allowEmpty?: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    const parsed = text.trim() === '' ? null : Number(text);
    if (parsed !== value) setText(value == null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const commit = (t: string) => {
    setText(t);
    if (t.trim() === '') {
      if (allowEmpty) onChange(null);
      return;
    }
    const v = Number(t);
    if (!isFinite(v)) return;
    if (min != null && v < min) return;
    if (max != null && v > max) return;
    onChange(v);
  };
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <input
          className={inputCls + (unit ? ' pr-14' : '')}
          type="text"
          inputMode="decimal"
          value={text}
          disabled={disabled}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => setText(value == null ? '' : String(value))}
        />
        {unit && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">{unit}</span>}
      </div>
    </Field>
  );
}

export function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Field label={label}>
      <input className={inputCls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: ReactNode;
}) {
  return (
    <Field label={label} hint={hint}>
      <select className={inputCls + ' appearance-none bg-[length:12px] pr-8'} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Seg<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl bg-zinc-100 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={
            'flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition disabled:opacity-40 ' +
            (o.value === value ? 'bg-[#121212] text-white shadow' : 'text-zinc-700')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 py-1 text-left">
      <span>
        <span className="block text-sm font-semibold text-zinc-800">{label}</span>
        {hint && <span className="block text-[11px] text-zinc-500">{hint}</span>}
      </span>
      <span className={'relative h-7 w-12 shrink-0 rounded-full transition ' + (checked ? 'bg-green-700' : 'bg-zinc-300')}>
        <span className={'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ' + (checked ? 'left-6' : 'left-1')} />
      </span>
    </button>
  );
}

export function Btn({
  children,
  onClick,
  kind = 'dark',
  className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  kind?: 'dark' | 'light' | 'danger';
  className?: string;
}) {
  const k =
    kind === 'dark'
      ? 'bg-[#121212] text-white'
      : kind === 'danger'
        ? 'bg-white text-[#B91C1C] border border-red-200'
        : 'bg-white text-zinc-900 border border-zinc-300';
  return (
    <button type="button" onClick={onClick} className={`rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-[0.98] ${k} ${className}`}>
      {children}
    </button>
  );
}

export function Pill({ level, children }: { level: 'red' | 'amber' | 'ok' | 'info'; children: ReactNode }) {
  const c = {
    red: 'bg-red-50 text-[#B91C1C] border-red-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    ok: 'bg-green-50 text-green-800 border-green-200',
    info: 'bg-zinc-50 text-zinc-600 border-zinc-200',
  }[level];
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${c}`}>{children}</span>;
}
