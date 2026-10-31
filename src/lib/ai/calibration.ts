import type { DimensionSet, InspectionSegment, Severity } from '../../types';
import type { PUPRDefectStandard } from './kb/puprKnowledge';
import { SUBTYPES } from '../templates';

/**
 * Format angka desimal Indonesia (menggunakan koma) dengan presisi 2 angka di belakang koma.
 */
export const fmtNumId = (n: number, decimals = 2): string => {
  if (!Number.isFinite(n)) return '0,00';
  return n.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Menghitung estimasi kuantitas (Luas / Panjang / Volume / Titik) terdampak
 * berbasis geometri aktual segmen inspeksi yang aktif.
 */
export const calculateCalibratedMetric = (
  seg: InspectionSegment,
  std: PUPRDefectStandard,
  ratioEstimator = 0.15
): string => {
  const d: DimensionSet = seg.mc100Dimensions ?? seg.mc0Dimensions ?? {};
  const L = Math.max(1, seg.segmentLengthMeter || 10);
  const H = Math.max(0.5, d.H || 1.0);
  const b = Math.max(0.4, d.b || 0.8);
  const m = typeof d.m === 'number' ? d.m : 1.0;
  const S = H * Math.sqrt(1 + m * m); // panjang miring dinding talud

  switch (std.typicalMetricKind) {
    case 'area': {
      // Perkiraan luas berdasarkan persentase dinding/lantai terdampak
      const wallArea = S * Math.min(L, 3.0);
      const estArea = Math.max(0.5, wallArea * Math.min(0.8, Math.max(0.05, ratioEstimator)));
      return `Luas ± ${fmtNumId(estArea)} m²`;
    }
    case 'volume': {
      // Perkiraan volume (misal sedimen di dasar atau runtuhan talud)
      const sub = SUBTYPES[seg.subType];
      const nominalVol = sub ? sub.volume(d, Math.min(L, 5)) : b * H * 5;
      const estVol = Math.max(0.1, nominalVol * Math.min(0.4, Math.max(0.02, ratioEstimator)));
      return `Volume ± ${fmtNumId(estVol)} m³`;
    }
    case 'length': {
      const estLen = Math.max(1.0, Math.min(L, L * ratioEstimator * 2.5));
      return `Panjang ± ${fmtNumId(estLen)} m`;
    }
    case 'point': {
      const pts = Math.max(1, Math.min(6, Math.round(ratioEstimator * 10)));
      return `${pts} Titik Lokasi`;
    }
    default:
      return 'Luas ± 1,50 m²';
  }
};

/**
 * Menghasilkan batas waktu perbaikan (hari kalender) yang taat aturan SLA PUPR.
 */
export const resolveCompliantDueDays = (severity: Severity, overrideDays?: number): number => {
  if (typeof overrideDays === 'number' && overrideDays > 0 && overrideDays <= 60) {
    return Math.round(overrideDays);
  }
  switch (severity) {
    case 'KRITIS':
      return 7;
    case 'MAYOR':
      return 14;
    case 'MINOR':
      return 30;
  }
};

/**
 * Membersihkan dan menyelaraskan uraian teknis agar bebas dari AI slop
 * (menghilangkan salam, pujian, kata pembuka, markdown bintang berlebih).
 */
export const sanitizeTechnicalText = (text: string, maxSentences = 2): string => {
  if (!text) return '';
  let clean = text
    .replace(/^[\s*#-]+/, '')
    .replace(/\b(Halo|Selamat pagi|Berdasarkan gambar|Dapat dilihat bahwa|Terima kasih|Mohon maaf)\b/gi, '')
    .replace(/[*_`]/g, '')
    .trim();

  // Pisahkan kalimat dan batasi maksimal sesuai panduan
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  if (sentences.length > maxSentences) {
    clean = sentences.slice(0, maxSentences).join(' ');
  }

  // Pastikan diakhiri titik
  if (clean && !clean.endsWith('.')) {
    clean += '.';
  }

  return clean;
};
