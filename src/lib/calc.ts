import type { DimKey, DimensionSet, EvaluationStatus, InspectionSegment, MeasurementSample, PHOProject } from '../types';
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

/** Menghitung ulang seluruh nilai turunan segmen (luas, volume, deviasi, status) */
export const recomputeSegment = (seg: InspectionSegment, tol: number): InspectionSegment => {
  const st = SUBTYPES[seg.subType];
  const L = seg.segmentLengthMeter || 0;
  const mcArea = st.area(seg.mc100Dimensions);
  const mcVolCalc = st.volume(seg.mc100Dimensions, L);
  const mcVol = typeof seg.mc100VolumeContractM3 === 'number' && seg.mc100VolumeContractM3 > 0 ? seg.mc100VolumeContractM3 : mcVolCalc;

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
    mc100CrossSectionAreaM2: mcArea,
    mc100VolumeM3: mcVol,
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

export const recomputeProject = (p: PHOProject): PHOProject => ({
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

export const projectSummary = (p: PHOProject) => {
  const segs = p.segments;
  const mcVol = segs.reduce((a, s) => a + s.mc100VolumeM3, 0);
  const measured = segs.filter((s) => s.evaluationStatus !== 'BELUM_DIUKUR' || s.actualVolumeM3 > 0);
  const actVol = segs.reduce((a, s) => a + s.actualVolumeM3, 0);
  const mcVolMeasured = measured.reduce((a, s) => a + s.mc100VolumeM3, 0);
  const defects = segs.flatMap((s) => s.defects.filter((d) => d.entryType === 'CACAT_MUTU'));
  return {
    total: segs.length,
    measured: segs.filter((s) => s.evaluationStatus !== 'BELUM_DIUKUR').length,
    pass: segs.filter((s) => s.evaluationStatus === 'MEMENUHI' || s.evaluationStatus === 'KURANG_DIMENSI_TERTOLERANSI').length,
    fail: segs.filter((s) => s.evaluationStatus === 'PERLU_PERBAIKAN').length,
    pending: segs.filter((s) => s.evaluationStatus === 'BELUM_DIUKUR').length,
    checklistFails: segs.reduce((a, s) => a + s.visualChecklist.filter((c) => c.status === 'TIDAK_SESUAI').length, 0),
    mcVol,
    actVol,
    mcVolMeasured,
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
export const resolveConclusion = (p: PHOProject) => {
  if (p.conclusionMode !== 'OTOMATIS') return p.conclusionMode;
  const s = projectSummary(p);
  if (s.kritis > 0 || s.pending > 0) return 'BELUM_DAPAT_DITERIMA' as const;
  if (s.fail > 0 || s.defects.length > 0 || s.checklistFails > 0) return 'DITERIMA_DENGAN_CATATAN' as const;
  return 'DAPAT_DITERIMA' as const;
};
