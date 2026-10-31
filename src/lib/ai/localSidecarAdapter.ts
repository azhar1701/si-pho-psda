import type { AIAgentEngine, DefectAnalysis, DefectAnalysisRequest, SidecarConfig } from './types';
import { calculateCalibratedMetric, resolveCompliantDueDays, sanitizeTechnicalText } from './calibration';
import { findBestPUPRStandard } from './kb/puprKnowledge';
import { presetsFor } from '../templates';

export const DEFAULT_SIDECAR_CONFIG: SidecarConfig = {
  baseUrl: 'http://localhost:11434',
  model: 'qwen2-vl:latest',
  timeoutMs: 8000,
};

export class LocalSidecarAgent implements AIAgentEngine {
  readonly id = 'LOCAL_SIDECAR' as const;
  readonly name = 'Local Sidecar Agent (Ollama / Llama.cpp)';
  private config: SidecarConfig;

  constructor(config: Partial<SidecarConfig> = {}) {
    this.config = { ...DEFAULT_SIDECAR_CONFIG, ...config };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1200);
      const res = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: ctrl.signal,
      });
      clearTimeout(t);
      return res.ok;
    } catch {
      return false;
    }
  }

  async analyze(req: DefectAnalysisRequest): Promise<DefectAnalysis> {
    const { jpegDataUrl, segment, signal } = req;
    const base64 = jpegDataUrl.split(',')[1] || '';
    const presets = presetsFor(segment.category).map((p) => `${p.code}: ${p.title}`).join('\n');

    const prompt = `Anda adalah inspektur ahli teknik sipil bangunan air (Ditjen SDA Kementerian PUPR).
Analisis foto berikut pada STA ${segment.staCode} (${segment.structureName || 'Segmen Saluran/Bangunan Air'}).
Pilih kode dari daftar baku berikut:
${presets}

Jawab hanya dalam format JSON valid tanpa markdown, tanpa penjelasan pembuka/penutup:
{
  "defectCode": "KODE_BAKU",
  "defectTitle": "JUDUL_CACAT",
  "severity": "MINOR" atau "MAYOR" atau "KRITIS",
  "technicalFinding": "Maksimal 2 kalimat uraian kondisi faktual objektif.",
  "repairInstruction": "Maksimal 2 kalimat instruksi teknis perbaikan spesifik.",
  "affectedVolumeOrArea": "Luas ± X,XX m² / Panjang ± X,XX m / Volume ± X,XX m³",
  "dueDays": 7 atau 14 atau 30
}`;

    const res = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        images: [base64],
        stream: false,
        format: 'json',
      }),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Sidecar HTTP error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const rawText = data.response || '{}';
    let parsed: Partial<DefectAnalysis> = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = {};
    }

    const bestStd = findBestPUPRStandard(segment.category, [
      String(parsed.defectTitle || ''),
      String(parsed.technicalFinding || ''),
    ]);

    const code = String(parsed.defectCode || bestStd.code).toUpperCase().trim();
    const title = String(parsed.defectTitle || bestStd.title).trim();
    const sev = ['MINOR', 'MAYOR', 'KRITIS'].includes(parsed.severity as string)
      ? (parsed.severity as DefectAnalysis['severity'])
      : bestStd.severity;

    const finding = sanitizeTechnicalText(
      parsed.technicalFinding || `Terlihat anomali pada STA ${segment.staCode} sisi ${segment.positionSide}.`
    );
    const repair = sanitizeTechnicalText(parsed.repairInstruction || bestStd.repairInstructionTemplate);
    const metric = parsed.affectedVolumeOrArea || calculateCalibratedMetric(segment, bestStd);
    const dueDays = resolveCompliantDueDays(sev, parsed.dueDays);

    return {
      defectCode: code,
      defectTitle: title,
      severity: sev,
      technicalFinding: finding,
      repairInstruction: repair,
      affectedVolumeOrArea: metric,
      dueDays,
      engineUsed: this.id,
    };
  }
}

