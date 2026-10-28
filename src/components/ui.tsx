import { forwardRef, useEffect, useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { parseNum } from '../lib/format';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function NumField(props: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  unit?: string;
  symbol?: string;
  tone?: 'normal' | 'deficit' | 'ok';
  hint?: string;
  compact?: boolean;
  integer?: boolean;
}) {
  const { value, onChange } = props;
  const toText = (v: number | undefined) => (v === undefined ? '' : String(v).replace('.', ','));
  const [text, setText] = useState(toText(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(toText(value));
  }, [value, focused]);
  const tone = props.tone ?? 'normal';
  return (
    <label className="block">
      <span className={cx('flex items-baseline gap-1 text-[13px] font-semibold leading-tight', props.compact ? 'mb-0.5' : 'mb-1', 'text-slate-700')}>
        {props.symbol && <span className="font-mono font-bold text-slate-900">{props.symbol}</span>}
        <span className="truncate">{props.label}</span>
      </span>
      <div className="relative">
        <input
          type="text"
          inputMode={props.integer ? 'numeric' : 'decimal'}
          enterKeyHint="next"
          autoComplete="off"
          className={cx(
            'num h-12 w-full rounded-lg border-2 bg-white px-3 pr-12 text-lg font-bold outline-none focus:ring-4',
            tone === 'deficit' && 'border-red-600 bg-red-50 text-red-800 focus:ring-red-200',
            tone === 'ok' && 'border-emerald-600 text-slate-900 focus:ring-emerald-200',
            tone === 'normal' && 'border-slate-300 text-slate-900 focus:border-slate-900 focus:ring-slate-200',
          )}
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setText(toText(value)); }}
          onChange={(e) => {
            const t = e.target.value.replace(/[^0-9.,\-]/g, '');
            setText(t);
            onChange(parseNum(t));
          }}
        />
        {props.unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">{props.unit}</span>}
      </div>
      {props.hint && <span className={cx('mt-0.5 block text-xs font-semibold num', tone === 'deficit' ? 'text-red-700' : 'text-slate-500')}>{props.hint}</span>}
    </label>
  );
}

export function TextField(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; multiline?: boolean; inputMode?: 'text' | 'numeric' | 'decimal' }) {
  const cls = 'w-full rounded-lg border-2 border-slate-300 bg-white px-3 text-base font-medium text-slate-900 outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-200';
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-semibold text-slate-700">{props.label}</span>
      {props.multiline ? (
        <textarea className={cx(cls, 'min-h-[88px] py-2')} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
      ) : (
        <input className={cx(cls, 'h-12')} type={props.type ?? 'text'} inputMode={props.inputMode} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
      )}
    </label>
  );
}

export function SelectField<T extends string>(props: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-semibold text-slate-700">{props.label}</span>
      <select
        className="h-12 w-full rounded-lg border-2 border-slate-300 bg-white px-3 text-base font-semibold text-slate-900 outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'success';
export const Btn = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(
  ({ variant = 'secondary', className, children, ...rest }, ref) => {
    const v: Record<Variant, string> = {
      primary: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-black',
      secondary: 'bg-white text-slate-900 border-2 border-slate-300 hover:border-slate-500',
      danger: 'bg-red-700 text-white hover:bg-red-800',
      warning: 'bg-amber-400 text-slate-950 border-2 border-amber-600 hover:bg-amber-300',
      ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
      success: 'bg-emerald-700 text-white hover:bg-emerald-800',
    };
    return (
      <button
        ref={ref}
        {...rest}
        className={cx(
          'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
          v[variant],
          className,
        )}
      >
        {children}
      </button>
    );
  },
);
Btn.displayName = 'Btn';

export function Card({ title, icon, right, children, className }: { title?: ReactNode; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-xl border border-slate-300 bg-white shadow-sm', className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="flex items-center gap-2 text-[15px] font-extrabold uppercase tracking-wide text-slate-900">{icon}{title}</h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Badge({ tone, children, wrap }: { tone: 'green' | 'red' | 'amber' | 'slate' | 'blue' | 'orange'; children: ReactNode; wrap?: boolean }) {
  const t = {
    green: 'bg-emerald-100 text-emerald-900 border-emerald-700',
    red: 'bg-red-100 text-red-900 border-red-700',
    amber: 'bg-amber-100 text-amber-900 border-amber-600',
    orange: 'bg-orange-100 text-orange-900 border-orange-600',
    slate: 'bg-slate-100 text-slate-800 border-slate-400',
    blue: 'bg-sky-100 text-sky-900 border-sky-700',
  }[tone];
  return <span className={cx('inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-extrabold uppercase', wrap ? 'whitespace-normal' : 'whitespace-nowrap', t)}>{children}</span>;
}
