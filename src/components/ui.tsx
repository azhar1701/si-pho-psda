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
      <span className={cx('flex items-baseline gap-1.5 text-[13px] font-bold leading-tight', props.compact ? 'mb-1' : 'mb-1.5', 'text-slate-700')}>
        {props.symbol && <span className="font-mono font-black text-slate-900">{props.symbol}</span>}
        <span className="truncate">{props.label}</span>
      </span>
      <div className="relative">
        <input
          type="text"
          inputMode={props.integer ? 'numeric' : 'decimal'}
          enterKeyHint="next"
          autoComplete="off"
          className={cx(
            'num h-12 w-full rounded-xl border px-3.5 pr-12 text-base font-bold outline-none transition-all duration-150',
            tone === 'deficit' && 'border-rose-400 bg-rose-50/50 text-rose-950 focus:bg-white focus:border-rose-600 focus:ring-4 focus:ring-rose-500/10',
            tone === 'ok' && 'border-emerald-500/70 bg-emerald-50/20 text-slate-900 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10',
            tone === 'normal' && 'border-slate-200 bg-white text-slate-900 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15',
          )}
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setText(toText(value));
          }}
          onChange={(e) => {
            const t = e.target.value.replace(/[^0-9.,\-]/g, '');
            setText(t);
            onChange(parseNum(t));
          }}
        />
        {props.unit && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-wider text-slate-400">
            {props.unit}
          </span>
        )}
      </div>
      {props.hint && (
        <span className={cx('mt-1 block text-xs num', tone === 'deficit' ? 'text-rose-700 font-bold' : 'text-slate-500')}>
          {props.hint}
        </span>
      )}
    </label>
  );
}

export function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  inputMode?: 'text' | 'numeric' | 'decimal';
}) {
  const cls =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 outline-none transition-all duration-150 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15';

  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold text-slate-700">{props.label}</span>
      {props.multiline ? (
        <textarea
          className={cx(cls, 'min-h-[96px] py-2.5 leading-relaxed')}
          value={props.value}
          placeholder={props.placeholder}
          onChange={(e) => props.onChange(e.target.value)}
        />
      ) : (
        <input
          className={cx(cls, 'h-12')}
          type={props.type ?? 'text'}
          inputMode={props.inputMode}
          value={props.value}
          placeholder={props.placeholder}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
    </label>
  );
}

export function SelectField<T extends string>(props: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold text-slate-700">{props.label}</span>
      <select
        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 outline-none transition-all duration-150 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 cursor-pointer"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'success';

export const Btn = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(
  ({ variant = 'secondary', className, children, ...rest }, ref) => {
    const v: Record<Variant, string> = {
      primary: 'bg-[#0f172a] text-white hover:bg-slate-800 shadow-sm active:bg-slate-950',
      secondary: 'bg-white text-slate-800 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-xs',
      danger: 'bg-rose-700 text-white hover:bg-rose-800 shadow-sm',
      warning: 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-sm font-bold',
      ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200',
      success: 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm',
    };

    return (
      <button
        ref={ref}
        {...rest}
        className={cx(
          'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100',
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

export function Card({
  title,
  icon,
  right,
  children,
  className,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all duration-200', className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-900">
            {icon && <span className="text-amber-500">{icon}</span>}
            {title}
          </h2>
          {right}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Badge({ tone, children, wrap }: { tone: 'green' | 'red' | 'amber' | 'slate' | 'blue' | 'orange' | 'purple'; children: ReactNode; wrap?: boolean }) {
  const t = {
    green: 'bg-emerald-50 text-emerald-800 border border-emerald-300/80',
    red: 'bg-rose-50 text-rose-800 border border-rose-300/80',
    amber: 'bg-amber-50 text-amber-900 border border-amber-300/80',
    orange: 'bg-orange-50 text-orange-900 border border-orange-300/80',
    slate: 'bg-slate-100 text-slate-700 border border-slate-200',
    blue: 'bg-sky-50 text-sky-800 border border-sky-300/80',
    purple: 'bg-purple-50 text-purple-800 border border-purple-300/80',
  }[tone];

  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase shadow-2xs',
        wrap ? 'whitespace-normal' : 'whitespace-nowrap',
        t,
      )}
    >
      {children}
    </span>
  );
}
