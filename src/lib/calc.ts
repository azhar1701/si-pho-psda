import type { DimKey, DimensionSet, EvaluationStatus, InspectionSegment, MeasurementSample, MonevProject } from '../types';
import { SUBTYPES } from './templates';

export const fieldsOf = (seg: Pick<InspectionSegment, 'subType'>) => SUBTYPES[seg.subType].fields;

/** Rerata aritmetik hanya dari titik sampel yang dicentang (isSelected === true) */
export const averageSelected = (seg: Pick<InspectionSegment, 'subType' | 'samples'>): DimensionSet => {
  const sel = seg.samples.filter((s) => s.isSelected);
  const out: DimensionSet = {};
  for (const f of fieldsOf(seg)) {
    const vals = sel.map((s) => s.dimensions[f.key]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (vals.length) out[f.key] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return out;
};

/** Deviasi parameter: Δp = p aktual − p MC-100 */
export const deviation = (actual: number | undefined, target: number | undefined) =>
  typeof actual === 'number' && typeof target === 'number' ? actual - target : undefined;

/** Kurang dimensi bila Δp < −τ ; parameter kemiringan (rasio) tidak diuji */
export const isDeficit = (actual: number | undefined, target: number | undefined, tol: number) => {
  const d = deviation(actual, target);
  return d !== undefined && d < -tol - 1e-9;
};

export const deficitKeys = (seg: Pick<InspectionSegment, 'subType' | 'mc100Dimensions'>, dims: DimensionSet, tol: number): DimKey[] =>
  fieldsOf(seg)
    .filter((f) => f.kind !== 'ratio')
    .filter((f) => isDeficit(dims[f.key], seg.mc100Dimensions[f.key], f.kind === 'count' ? 0 : tol))
    .map((f) => f.key);

export const sampleArea = (seg: Pick<InspectionSegment, 'subType'>, s: MeasurementSample) => SUBTYPES[seg.subType].area(s.dimensions);

const hasMeasuredValue = (s: MeasurementSample) => Object.values(s.dimensions).some((v) => typeof v === 'number' && Number.isFinite(v));

/** Menghitung ulang seluruh nilai turunan segmen (luas MC-0, MC-100, aktual, deviasi CCO, dan evaluasi) */
export const recomputeSegment = (seg: InspectionSegment, tol: number): InspectionSegment => {
  const st = SUBTYPES[seg.subType];
  const L = seg.segmentLengthMeter || 0;

  // Pilar 1: MC-0 (Rekayasa Lapangan Awal)
  const mc0Dims = seg.mc0Dimensions && Object.keys(seg.mc0Dimensions).length > 0 ? seg.mc0Dimensions : seg.mc100Dimensions;
  const mc0Area = st.area(mc0Dims);
  const mc0VolCalc = st.volume(mc0Dims, L);
  const mc0Vol = typeof seg.mc0VolumeContractM3 === 'number' && seg.mc0VolumeContractM3 > 0 ? seg.mc0VolumeContractM3 : mc0VolCalc;

  // Pilar 2: MC-100 (Rencana As-Built Akhir)
  const mcArea = st.area(seg.mc100Dimensions);
  const mcVolCalc = st.volume(seg.mc100Dimensions, L);
  const mcVol = typeof seg.mc100VolumeContractM3 === 'number' && seg.mc100VolumeContractM3 > 0 ? seg.mc100VolumeContractM3 : mcVolCalc;

  // Komparasi CCO (MC-0 vs MC-100)
  const volumeCcoVarianceM3 = mcVol - mc0Vol;
  const volumeCcoVariancePercent = mc0Vol > 0 ? (volumeCcoVarianceM3 / mc0Vol) * 100 : 0;

  // Pilar 3: Realisasi Aktual
  const measured = seg.samples.filter((s) => s.isSelected && hasMeasuredValue(s));
  const avg = averageSelected(seg);
  const actArea = measured.length ? st.area(avg) : 0;
  const actVol = measured.length ? st.volume(avg, L) : 0;

  const sampleDef = new Set<DimKey>();
  for (const s of measured) deficitKeys(seg, s.dimensions, tol).forEach((k) => sampleDef.add(k));
  const avgDef = measured.length ? deficitKeys(seg, avg, tol) : [];

  const defectCount = seg.defects.filter((d) => d.entryType === 'CACAT_MUTU').length;
  const checklistFail = seg.visualChecklist.some((c) => c.status === 'TIDAK_SESUAI');

  let status: EvaluationStatus;
  if (!measured.length) status = defectCount || checklistFail ? 'PERLU_PERBAIKAN' : 'BELUM_DIUKUR';
  else if (avgDef.length || defectCount || checklistFail) status = 'PERLU_PERBAIKAN';
  else if (sampleDef.size) status = 'KURANG_DIMENSI_TERTOLERANSI';
  else status = 'MEMENUHI';

  return {
    ...seg,
    mc0Dimensions: mc0Dims,
    mc0CrossSectionAreaM2: mc0Area,
    mc0VolumeM3: mc0Vol,
    mc100CrossSectionAreaM2: mcArea,
    mc100VolumeM3: mcVol,
    volumeCcoVarianceM3,
    volumeCcoVariancePercent,
    averagedActualDimensions: avg,
    actualCrossSectionAreaM2: actArea,
    actualVolumeM3: actVol,
    volumeDeviationM3: measured.length ? actVol - mcVol : 0,
    volumeAchievementPercent: measured.length && mcVol > 0 ? (actVol / mcVol) * 100 : 0,
    hasDimensionDeficit: sampleDef.size > 0 || avgDef.length > 0,
    deficitParams: [...sampleDef],
    averageDeficitParams: avgDef,
    evaluationStatus: status,
  };
};

export const recomputeProject = (p: MonevProject): MonevProject => ({
  ...p,
  segments: p.segments.map((s) => recomputeSegment(s, p.contractInfo.dimensionToleranceMeter)),
});

export const STATUS_LABEL: Record<EvaluationStatus, string> = {
  BELUM_DIUKUR: 'Belum Diukur',
  MEMENUHI: 'Memenuhi',
  KURANG_DIMENSI_TERTOLERANSI: 'Kurang Dimensi Lokal (Rerata Memenuhi)',
  PERLU_PERBAIKAN: 'Perlu Perbaikan',
};

export const STATUS_SHORT: Record<EvaluationStatus, string> = {
  BELUM_DIUKUR: 'BELUM DIUKUR',
  MEMENUHI: 'MEMENUHI',
  KURANG_DIMENSI_TERTOLERANSI: 'MEMENUHI (DEVIASI LOKAL)',
  PERLU_PERBAIKAN: 'PERLU PERBAIKAN',
};

export const projectSummary = (p: MonevProject) => {
  const segs = p.segments;
  const mc0Vol = segs.reduce((a, s) => a + (s.mc0VolumeM3 ?? s.mc100VolumeM3), 0);
  const mcVol = segs.reduce((a, s) => a + s.mc100VolumeM3, 0);
  const measured = segs.filter((s) => s.evaluationStatus !== 'BELUM_DIUKUR' || s.actualVolumeM3 > 0);
  const actVol = segs.reduce((a, s) => a + s.actualVolumeM3, 0);
  const mcVolMeasured = measured.reduce((a, s) => a + s.mc100VolumeM3, 0);
  const defects = segs.flatMap((s) => s.defects.filter((d) => d.entryType === 'CACAT_MUTU'));
  const ccoVarianceM3 = mcVol - mc0Vol;
  const ccoVariancePercent = mc0Vol > 0 ? (ccoVarianceM3 / mc0Vol) * 100 : 0;

  return {
    total: segs.length,
    measured: segs.filter((s) => s.evaluationStatus !== 'BELUM_DIUKUR').length,
    pass: segs.filter((s) => s.evaluationStatus === 'MEMENUHI' || s.evaluationStatus === 'KURANG_DIMENSI_TERTOLERANSI').length,
    fail: segs.filter((s) => s.evaluationStatus === 'PERLU_PERBAIKAN').length,
    pending: segs.filter((s) => s.evaluationStatus === 'BELUM_DIUKUR').length,
    checklistFails: segs.reduce((a, s) => a + s.visualChecklist.filter((c) => c.status === 'TIDAK_SESUAI').length, 0),
    mc0Vol,
    mcVol,
    actVol,
    mcVolMeasured,
    ccoVarianceM3,
    ccoVariancePercent,
    achievement: mcVol > 0 ? (actVol / mcVol) * 100 : 0,
    defects,
    kritis: defects.filter((d) => d.severity === 'KRITIS').length,
    mayor: defects.filter((d) => d.severity === 'MAYOR').length,
    minor: defects.filter((d) => d.severity === 'MINOR').length,
  };
};

/**
 * Logika penentuan kesimpulan PHO otomatis:
 * 1. BELUM_DAPAT_DITERIMA: jika ada cacat KRITIS atau segmen yang belum diukur sama sekali.
 * 2. DITERIMA_DENGAN_CATATAN: jika ada cacat mutu (mayor/minor), checklist TIDAK_SESUAI, atau segmen perlu perbaikan.
 * 3. DAPAT_DITERIMA: seluruh segmen terukur dan memenuhi toleransi tanpa temuan cacat.
 */
export const resolveConclusion = (p: MonevProject) => {
  if (p.conclusionMode !== 'OTOMATIS') return p.conclusionMode;
  const s = projectSummary(p);
  if (s.kritis > 0 || s.pending > 0) return 'BELUM_DAPAT_DITERIMA' as const;
  if (s.fail > 0 || s.defects.length > 0 || s.checklistFails > 0) return 'DITERIMA_DENGAN_CATATAN' as const;
  return 'DAPAT_DITERIMA' as const;
};

export interface FHOReadiness {
  isReady: boolean;
  unresolvedDefectCount: number;
  openNcrCount: number;
  warrantyDaysRemaining: number;
  isWarrantyPeriodEnded: boolean;
  reasons: string[];
}

/**
 * Evaluasi Kesiapan FHO (Final Hand Over):
 * Memeriksa pemenuhan syarat serah terima akhir:
 * - 0 catatan cacat mutu PHO yang belum diselesaikan
 * - 0 open NCR
 * - Masa pemeliharaan telah berakhir
 */
export const evaluateFHOReadiness = (p: MonevProject): FHOReadiness => {
  const defects = p.segments.flatMap((s) => s.defects.filter((d) => d.entryType === 'CACAT_MUTU'));
  const resolvedDefectRefs = new Set(
    (p.maintenanceRecords ?? [])
      .filter((m) => m.isResolved && (m.defectReference || m.notes))
      .map((m) => m.defectReference || '')
  );

  const unresolvedDefectCount = defects.filter(
    (d) => !resolvedDefectRefs.has(d.defectCode) && !resolvedDefectRefs.has(d.id)
  ).length;

  const openNcrCount = (p.ncrItems ?? []).filter((n) => n.status !== 'CLOSED').length;

  const phoDateStr = p.inspectionTeam.inspectionDate;
  const maintenanceDays = p.contractInfo.maintenancePeriodDays || 180;
  let warrantyDaysRemaining = 0;
  let isWarrantyPeriodEnded = false;

  if (phoDateStr) {
    const phoDate = new Date(phoDateStr);
    const targetFhoDate = new Date(phoDate.getTime() + maintenanceDays * 86400000);
    const now = new Date();
    const diffTime = targetFhoDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / 86400000);
    warrantyDaysRemaining = Math.max(0, diffDays);
    isWarrantyPeriodEnded = diffDays <= 0;
  }

  const reasons: string[] = [];
  if (unresolvedDefectCount > 0) {
    reasons.push(`${unresolvedDefectCount} temuan cacat mutu PHO belum tuntas diperbaiki.`);
  }
  if (openNcrCount > 0) {
    reasons.push(`${openNcrCount} lembar NCR masih berstatus aktif/terbuka.`);
  }
  if (!isWarrantyPeriodEnded && warrantyDaysRemaining > 0) {
    reasons.push(`Masa pemeliharaan masih berjalan (sisa ${warrantyDaysRemaining} hari kalender).`);
  }

  return {
    isReady: reasons.length === 0,
    unresolvedDefectCount,
    openNcrCount,
    warrantyDaysRemaining,
    isWarrantyPeriodEnded,
    reasons,
  };
};
