import type { EvaluationStatus, MonevStatus, NCRStatus, Severity } from '../types';
import { STATUS_SHORT } from '../lib/calc';
import { cx } from './ui';

export const StatusBadge = ({ status, className }: { status: EvaluationStatus; className?: string }) => {
  const cfg = {
    MEMENUHI: {
      cls: 'bg-emerald-600 text-white shadow-2xs',
      icon: '✓',
      label: STATUS_SHORT.MEMENUHI,
    },
    PERLU_PERBAIKAN: {
      cls: 'bg-rose-600 text-white shadow-2xs',
      icon: '⚠',
      label: STATUS_SHORT.PERLU_PERBAIKAN,
    },
    KURANG_DIMENSI_TERTOLERANSI: {
      cls: 'bg-amber-500 text-slate-950 font-black shadow-2xs',
      icon: '⚡',
      label: 'TOLERANSI DEVIASI',
    },
    BELUM_DIUKUR: {
      cls: 'bg-slate-200 text-slate-700',
      icon: '○',
      label: STATUS_SHORT.BELUM_DIUKUR,
    },
  }[status];

  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-black tracking-wide uppercase',
        cfg.cls,
        className,
      )}
    >
      <span className="text-[12px]">{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
};

export const SeverityBadge = ({ s, className }: { s: Severity; className?: string }) => {
  const cfg = {
    KRITIS: 'bg-rose-600 text-white',
    MAYOR: 'bg-amber-500 text-slate-950 font-black',
    MINOR: 'bg-slate-700 text-white',
  }[s];

  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black tracking-wider uppercase',
        cfg,
        className,
      )}
    >
      {s === 'KRITIS' && '● '}
      {s}
    </span>
  );
};

export const MonevStatusBadge = ({ status, className }: { status: MonevStatus; className?: string }) => {
  const cfg = {
    ON_TRACK: {
      cls: 'bg-emerald-600 text-white',
      dot: 'bg-emerald-200',
      label: 'PROGRES POSITIF / NORMAL',
    },
    AT_RISK: {
      cls: 'bg-amber-500 text-slate-950 font-black',
      dot: 'bg-amber-900',
      label: 'WASPADA (< 5% KETERLAMBATAN)',
    },
    CRITICAL_DELAY: {
      cls: 'bg-rose-600 text-white animate-pulse',
      dot: 'bg-white',
      label: 'KRITIS (DEVIASI > 5% - SCM)',
    },
  }[status];

  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-black tracking-wide uppercase shadow-2xs',
        cfg.cls,
        className,
      )}
    >
      <span className={cx('h-2 w-2 rounded-full', cfg.dot)} />
      <span>{cfg.label}</span>
    </span>
  );
};

export const NCRStatusBadge = ({ status, className }: { status: NCRStatus; className?: string }) => {
  const cfg = {
    OPEN: {
      cls: 'bg-rose-100 text-rose-800 border border-rose-300',
      label: 'OPEN (BELUM DITINDAKLANJUTI)',
    },
    UNDER_REVIEW: {
      cls: 'bg-amber-100 text-amber-900 border border-amber-300',
      label: 'DALAM PENINJAUAN',
    },
    CLOSED: {
      cls: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
      label: 'SELESAI / CLOSED',
    },
  }[status];

  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[11px] font-black tracking-wide uppercase',
        cfg.cls,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
};
