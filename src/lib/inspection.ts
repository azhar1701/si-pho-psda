import type { DefectItem, InspectionSegment, PHOProject } from '../types';
import { SUBTYPES, POSITION_LABEL } from './templates';
import { fmt, fmtDim, stempelWaktu } from './format';
import type { WatermarkInfo } from './imaging';
import { STATUS_SHORT } from './calc';

export const dimensionSummary = (seg: InspectionSegment) => {
  const st = SUBTYPES[seg.subType];
  const parts = st.fields.map((f) => `${f.symbol} ${fmtDim(seg.averagedActualDimensions[f.key], f.kind)}/${fmtDim(seg.mc100Dimensions[f.key], f.kind)}`);
  return `RERATA AKTUAL/MC-100: ${parts.join(' · ')} | A ${fmt(seg.actualCrossSectionAreaM2, 3)}/${fmt(seg.mc100CrossSectionAreaM2, 3)} m² | V ${fmt(seg.actualVolumeM3, 2)}/${fmt(seg.mc100VolumeM3, 2)} m³`;
};

export const gpsText = (g: DefectItem['gpsCoordinates']) => {
  if (g.latitude === null || g.longitude === null) return 'GPS tidak tersedia';
  const latStr = `${Math.abs(g.latitude).toFixed(6)}° ${g.latitude < 0 ? 'LS' : 'LU'}`;
  const lngStr = `${Math.abs(g.longitude).toFixed(6)}° ${g.longitude < 0 ? 'BB' : 'BT'}`;
  const accStr = g.accuracyMeter !== null ? ` ± ${Math.round(g.accuracyMeter)} m` : '';
  return `${latStr}, ${lngStr}${accStr}`;
};

export const buildWatermarkInfo = (
  p: PHOProject,
  seg: InspectionSegment,
  d: Pick<DefectItem, 'entryType' | 'defectCode' | 'defectTitle' | 'severity' | 'gpsCoordinates' | 'capturedAt' | 'positionSide'>,
): WatermarkInfo => {
  const isDefect = d.entryType === 'CACAT_MUTU';
  const status = isDefect
    ? `STATUS: CACAT MUTU — ${d.defectCode} ${d.defectTitle} [${d.severity}]`
    : `STATUS: ${STATUS_SHORT[seg.evaluationStatus]} — DOKUMENTASI PEMERIKSAAN`;
  const color = isDefect ? (d.severity === 'KRITIS' ? '#dc2626' : d.severity === 'MAYOR' ? '#f97316' : '#facc15') : seg.evaluationStatus === 'PERLU_PERBAIKAN' ? '#f97316' : '#22c55e';
  return {
    line1: `${p.contractInfo.packageName || 'PAKET PEKERJAAN'} | KONTRAK NO. ${p.contractInfo.contractNumber || '-'}`,
    line2: `LOKASI: ${seg.staCode}${seg.structureName ? ' — ' + seg.structureName : ''} | POSISI: ${POSITION_LABEL[d.positionSide].toUpperCase()}`,
    line3: `GPS: ${gpsText(d.gpsCoordinates)} | WAKTU: ${stempelWaktu(d.capturedAt)}`,
    line4: dimensionSummary(seg),
    status,
    statusColor: color,
  };
};
