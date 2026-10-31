import type { InspectionSegment } from '../types';
import { aiManager } from './ai/manager';
import type { DefectAnalysis } from './ai/types';
import { GEMINI_MODEL, resolveApiKey } from './ai/geminiAdapter';

export { GEMINI_MODEL, resolveApiKey };
export type { DefectAnalysis };

export class GeminiUnavailableError extends Error {}

/**
 * Menganalisis citra cacat mutu menggunakan Unified AI Engine
 * (Otomatis memilih Agent AI Offline On-Device, Local Sidecar, atau Gemini Online).
 */
export const analyzeDefect = async (
  jpegDataUrl: string,
  seg: InspectionSegment,
  signal?: AbortSignal
): Promise<DefectAnalysis> => {
  try {
    return await aiManager.analyze({
      jpegDataUrl,
      segment: seg,
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw err;
    }
    throw new GeminiUnavailableError((err as Error).message || 'Gagal menjalankan analisis AI');
  }
};
