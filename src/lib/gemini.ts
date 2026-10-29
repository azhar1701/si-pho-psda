import type { InspectionSegment, Severity } from '../types';
import { CATEGORIES, SUBTYPES, presetsFor, POSITION_LABEL } from './templates';
import { getStoredApiKey } from './storage';

export const GEMINI_MODEL = 'gemini-2.5-flash';

export interface DefectAnalysis {
  defectCode: string;
  defectTitle: string;
  severity: Severity;
  technicalFinding: string;
  repairInstruction: string;
  affectedVolumeOrArea: string;
  dueDays: number;
}

/** Kunci dari lingkungan runtime Google AI Studio (bila tersedia) atau dari pengaturan lokal perangkat */
export const resolveApiKey = (): string => {
  let envKey = '';
  try {
    const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
    envKey = g.process?.env?.API_KEY || g.process?.env?.GEMINI_API_KEY || '';
  } catch {
    envKey = '';
  }
  return envKey || getStoredApiKey();
};

const SYSTEM_INSTRUCTION = `Anda adalah modul klasifikasi cacat mutu konstruksi bangunan air pada monitoring evaluasi pelaksanaan dan serah terima pekerjaan (MONEV & PHO) di lingkungan Ditjen SDA Kementerian PUPR / Dinas PSDA.
Ketentuan keluaran:
1. Gunakan Bahasa Indonesia baku teknik sipil pengairan sesuai KP-02, KP-03, KP-04, KP-05, SNI 1724:2015, dan SNI 2406.
2. Dilarang menulis kalimat pembuka, penutup, sapaan, pujian, klaim hiperbolis, permintaan maaf, atau ringkasan umum.
3. technicalFinding: uraian faktual objektif kondisi yang terlihat pada citra (jenis cacat, lokasi pada elemen, perkiraan dimensi/sebaran). Maksimal 2 kalimat.
4. repairInstruction: instruksi perbaikan teknis spesifik dalam kalimat perintah (contoh: "Bongkar siaran rapuh, bersihkan celah pasangan batu, dan lakukan siar ulang dengan campuran mortar 1 PC : 2 PP"). Maksimal 2 kalimat.
5. affectedVolumeOrArea: estimasi kuantitas terdampak dengan format "Luas ± 1,50 m²", "Panjang ± 3,00 m", "Volume ± 0,25 m³", atau "2 Titik Sulingan". Gunakan koma desimal.
6. severity: MINOR (estetika/fungsi tidak terganggu), MAYOR (fungsi/durabilitas berkurang), KRITIS (membahayakan stabilitas struktur atau fungsi hidraulis utama).
7. defectCode: gunakan kode baku dari daftar referensi bila sesuai; bila tidak ada yang sesuai, susun kode baru dengan awalan yang sama (SAL-, BET-, PNT-, BGN-, BRJ-, TGL-, GAL-).
8. Bila citra tidak menunjukkan cacat mutu, gunakan defectCode "DOK-00", severity "MINOR", dueDays 0, repairInstruction "-".
9. dueDays: batas waktu perbaikan dalam hari kalender (bilangan bulat 0–60).`;

const buildSchema = (Type: typeof import('@google/genai').Type) => ({
  type: Type.OBJECT,
  properties: {
    defectCode: { type: Type.STRING },
    defectTitle: { type: Type.STRING },
    severity: { type: Type.STRING, enum: ['MINOR', 'MAYOR', 'KRITIS'] },
    technicalFinding: { type: Type.STRING },
    repairInstruction: { type: Type.STRING },
    affectedVolumeOrArea: { type: Type.STRING },
    dueDays: { type: Type.INTEGER },
  },
  required: ['defectCode', 'defectTitle', 'severity', 'technicalFinding', 'repairInstruction', 'affectedVolumeOrArea', 'dueDays'],
  propertyOrdering: ['defectCode', 'defectTitle', 'severity', 'technicalFinding', 'repairInstruction', 'affectedVolumeOrArea', 'dueDays'],
});

export class GeminiUnavailableError extends Error {}

export const analyzeDefect = async (jpegDataUrl: string, seg: InspectionSegment, signal?: AbortSignal): Promise<DefectAnalysis> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new GeminiUnavailableError('Perangkat tidak terhubung ke jaringan (blank spot)');
  const apiKey = resolveApiKey();
  if (!apiKey) throw new GeminiUnavailableError('Kunci API Gemini belum diatur (menu Proyek > Kesimpulan BA & Analisis AI)');
  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const cat = CATEGORIES[seg.category];
  const refs = presetsFor(seg.category).map((p) => `${p.code}: ${p.title}`).join('\n');
  const context = `Kategori bangunan: ${cat.label} (acuan ${cat.reference}).
Sub-tipe: ${SUBTYPES[seg.subType].label}.
Lokasi: ${seg.staCode} — ${seg.structureName || '-'} — posisi ${POSITION_LABEL[seg.positionSide]}.
Daftar kode cacat mutu baku referensi:
${refs}
Klasifikasikan cacat mutu yang paling dominan pada citra.`;
  const base64 = jpegDataUrl.split(',')[1] ?? '';
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64 } }, { text: context }] }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: buildSchema(Type),
      temperature: 0.1,
      abortSignal: signal,
    },
  });
  const txt = res.text ?? '';
  const j = JSON.parse(txt) as Partial<DefectAnalysis>;
  const sev = (['MINOR', 'MAYOR', 'KRITIS'] as Severity[]).includes(j.severity as Severity) ? (j.severity as Severity) : 'MAYOR';
  return {
    defectCode: String(j.defectCode ?? 'XXX-00').trim().toUpperCase(),
    defectTitle: String(j.defectTitle ?? '').trim(),
    severity: sev,
    technicalFinding: String(j.technicalFinding ?? '').trim(),
    repairInstruction: String(j.repairInstruction ?? '').trim(),
    affectedVolumeOrArea: String(j.affectedVolumeOrArea ?? '').trim(),
    dueDays: Math.max(0, Math.min(365, Math.round(Number(j.dueDays) || 0))),
  };
};
