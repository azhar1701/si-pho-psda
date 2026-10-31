import type { AIAgentEngine, DefectAnalysis, DefectAnalysisRequest } from './types';
import { CATEGORIES, POSITION_LABEL, presetsFor, SUBTYPES } from '../templates';
import { getStoredApiKey } from '../storage';
import { calculateCalibratedMetric, resolveCompliantDueDays, sanitizeTechnicalText } from './calibration';
import { findBestPUPRStandard } from './kb/puprKnowledge';

export const GEMINI_MODEL = 'gemini-2.5-flash';

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

const SYSTEM_INSTRUCTION = `Anda adalah modul klasifikasi cacat mutu konstruksi bangunan air pada monitoring evaluasi pelaksanaan pekerjaan dan serah terima (MONEV) di lingkungan Ditjen SDA Kementerian PUPR / Dinas PSDA.
Ketentuan keluaran:
1. Gunakan Bahasa Indonesia baku teknik sipil pengairan sesuai KP-02, KP-03, KP-04, KP-05, SNI 1724:2015, dan SNI 2406.
2. Dilarang menulis kalimat pembuka, penutup, sapaan, pujian, klaim hiperbolis, permintaan maaf, atau ringkasan umum.
3. technicalFinding: uraian faktual objektif kondisi yang terlihat pada citra (jenis cacat, lokasi pada elemen, perkiraan dimensi/sebaran). Maksimal 2 kalimat.
4. repairInstruction: instruksi perbaikan teknis spesifik dalam kalimat perintah. Maksimal 2 kalimat.
5. affectedVolumeOrArea: estimasi kuantitas terdampak dengan format "Luas ± 1,50 m²", "Panjang ± 3,00 m", "Volume ± 0,25 m³", atau "2 Titik Sulingan". Gunakan koma desimal.
6. severity: MINOR, MAYOR, KRITIS.
7. defectCode: gunakan kode baku dari daftar referensi bila sesuai.
8. Bila citra tidak menunjukkan cacat mutu, gunakan defectCode "DOK-00", severity "MINOR", dueDays 0, repairInstruction "-".
9. dueDays: batas waktu perbaikan dalam hari kalender (bilangan bulat 0–60).`;

export class GeminiOnlineAgent implements AIAgentEngine {
  readonly id = 'GEMINI_VISION' as const;
  readonly name = `Gemini Online Cloud (${GEMINI_MODEL})`;

  isAvailable(): boolean {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    return Boolean(resolveApiKey());
  }

  async analyze(req: DefectAnalysisRequest): Promise<DefectAnalysis> {
    const { jpegDataUrl, segment, signal } = req;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Perangkat tidak terhubung ke jaringan (blank spot)');
    }
    const apiKey = resolveApiKey();
    if (!apiKey) {
      throw new Error('Kunci API Gemini belum diatur (menu Proyek > Pengaturan AI)');
    }

    const { GoogleGenAI, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const cat = CATEGORIES[segment.category];
    const refs = presetsFor(segment.category).map((p) => `${p.code}: ${p.title}`).join('\n');
    const context = `Kategori bangunan: ${cat.label} (acuan ${cat.reference}).
Sub-tipe: ${SUBTYPES[segment.subType].label}.
Lokasi: ${segment.staCode} — ${segment.structureName || '-'} — posisi ${POSITION_LABEL[segment.positionSide]}.
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
        responseSchema: {
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
        },
        temperature: 0.1,
        abortSignal: signal,
      },
    });

    const txt = res.text ?? '';
    const j = JSON.parse(txt) as Partial<DefectAnalysis>;
    const bestStd = findBestPUPRStandard(segment.category, [String(j.defectTitle || ''), String(j.defectCode || '')]);
    const sev = (['MINOR', 'MAYOR', 'KRITIS'] as DefectAnalysis['severity'][]).includes(j.severity as DefectAnalysis['severity'])
      ? (j.severity as DefectAnalysis['severity'])
      : bestStd.severity;

    return {
      defectCode: String(j.defectCode ?? bestStd.code).trim().toUpperCase(),
      defectTitle: String(j.defectTitle ?? bestStd.title).trim(),
      severity: sev,
      technicalFinding: sanitizeTechnicalText(String(j.technicalFinding ?? '')),
      repairInstruction: sanitizeTechnicalText(String(j.repairInstruction ?? '')),
      affectedVolumeOrArea: String(j.affectedVolumeOrArea ?? calculateCalibratedMetric(segment, bestStd)).trim(),
      dueDays: resolveCompliantDueDays(sev, Number(j.dueDays)),
      engineUsed: this.id,
    };
  }
}

