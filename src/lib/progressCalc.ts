import type { ContractTimeline, MonevStatus, PHOProject, ProgressPeriod } from '../types';

export interface TimelineSummary {
  startDate: string;
  endDate: string;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  timeElapsedPercent: number;
  isExpired: boolean;
}

export interface ProgressSummary {
  latestPeriod: ProgressPeriod | null;
  plannedPhysicalPercent: number;
  actualPhysicalPercent: number;
  deviationPercent: number;
  plannedFinancialPercent: number;
  actualFinancialPercent: number;
  financialDeviationPercent: number;
  status: MonevStatus;
  statusLabel: string;
  statusDescription: string;
}

export function computeTimelineSummary(timeline?: ContractTimeline, contractDate?: string): TimelineSummary {
  const start = timeline?.startDate || contractDate || '';
  const end = timeline?.endDate || '';
  const now = new Date();

  if (!start || !end) {
    const total = timeline?.totalCalendarDays || 150;
    return {
      startDate: start,
      endDate: end,
      totalDays: total,
      elapsedDays: 0,
      remainingDays: total,
      timeElapsedPercent: 0,
      isExpired: false,
    };
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  const msPerDay = 1000 * 60 * 60 * 24;

  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / msPerDay));
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.round((now.getTime() - startDate.getTime()) / msPerDay)));
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const timeElapsedPercent = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
  const isExpired = now.getTime() > endDate.getTime();

  return {
    startDate: start,
    endDate: end,
    totalDays,
    elapsedDays,
    remainingDays,
    timeElapsedPercent,
    isExpired,
  };
}

export function computeProgressSummary(periods: ProgressPeriod[] = []): ProgressSummary {
  if (periods.length === 0) {
    return {
      latestPeriod: null,
      plannedPhysicalPercent: 0,
      actualPhysicalPercent: 0,
      deviationPercent: 0,
      plannedFinancialPercent: 0,
      actualFinancialPercent: 0,
      financialDeviationPercent: 0,
      status: 'ON_TRACK',
      statusLabel: 'Belum Ada Periode',
      statusDescription: 'Input progres mingguan atau bulanan untuk memantau deviasi.',
    };
  }

  // Find latest recorded period (by periodNumber or with non-zero actual progress)
  const sorted = [...periods].sort((a, b) => a.periodNumber - b.periodNumber);
  const evaluatedPeriods = sorted.filter((p) => p.actualPhysicalPercent > 0);
  const latest = evaluatedPeriods.length > 0 ? evaluatedPeriods[evaluatedPeriods.length - 1] : sorted[0];

  const planned = latest.plannedPhysicalPercent;
  const actual = latest.actualPhysicalPercent;
  const deviation = actual - planned;

  const plannedFin = latest.plannedFinancialPercent ?? 0;
  const actualFin = latest.actualFinancialPercent ?? 0;
  const finDeviation = actualFin - plannedFin;

  let status: MonevStatus = 'ON_TRACK';
  let statusLabel = 'Progres Sesuai / Positif';
  let statusDescription = 'Pelaksanaan pekerjaan di lapangan berjalan sesuai atau melampaui kurva rencana.';

  if (deviation < -5.0) {
    status = 'CRITICAL_DELAY';
    statusLabel = 'Keterlambatan Kritis (SCM)';
    statusDescription = 'Deviasi realisasi terhadap rencana > 5%. Wajib penanganan Show Cause Meeting (SCM) & uji coba pemenuhan target.';
  } else if (deviation < 0) {
    status = 'AT_RISK';
    statusLabel = 'Waspada / Keterlambatan Ringan';
    statusDescription = 'Realisasi berada di bawah rencana (< 5%). Perlu percepatan tenaga kerja atau penyesuaian jam kerja.';
  }

  return {
    latestPeriod: latest,
    plannedPhysicalPercent: planned,
    actualPhysicalPercent: actual,
    deviationPercent: deviation,
    plannedFinancialPercent: plannedFin,
    actualFinancialPercent: actualFin,
    financialDeviationPercent: finDeviation,
    status,
    statusLabel,
    statusDescription,
  };
}

export interface CurvePoint {
  periodNumber: number;
  label: string;
  planned: number;
  actual: number;
  hasActual: boolean;
  plannedFin?: number;
  actualFin?: number;
}

export function buildCurvePoints(periods: ProgressPeriod[] = []): CurvePoint[] {
  if (periods.length === 0) return [];
  const sorted = [...periods].sort((a, b) => a.periodNumber - b.periodNumber);

  return sorted.map((p) => ({
    periodNumber: p.periodNumber,
    label: p.label || `M-${p.periodNumber}`,
    planned: p.plannedPhysicalPercent,
    actual: p.actualPhysicalPercent,
    hasActual: p.actualPhysicalPercent > 0 || p.periodNumber === 1,
    plannedFin: p.plannedFinancialPercent,
    actualFin: p.actualFinancialPercent,
  }));
}

export function computeNCRStats(project: PHOProject) {
  const items = project.ncrItems ?? [];
  const total = items.length;
  const open = items.filter((i) => i.status === 'OPEN').length;
  const underReview = items.filter((i) => i.status === 'UNDER_REVIEW').length;
  const closed = items.filter((i) => i.status === 'CLOSED').length;
  const critical = items.filter((i) => i.severity === 'KRITIS' && i.status !== 'CLOSED').length;

  return {
    total,
    open,
    underReview,
    closed,
    critical,
  };
}

