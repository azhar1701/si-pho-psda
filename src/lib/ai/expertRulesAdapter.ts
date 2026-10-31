import type { AIAgentEngine, DefectAnalysis, DefectAnalysisRequest } from './types';
import { findBestPUPRStandard, PUPR_DEFECT_STANDARDS } from './kb/puprKnowledge';
import { calculateCalibratedMetric, resolveCompliantDueDays, sanitizeTechnicalText } from './calibration';
import { presetsFor } from '../templates';

/**
 * Menganalisis karakteristik visual dasar dari data URL citra via Canvas API
 * (distribusi kontras, perkiraan rasio area anomali retak/kerusakan).
 */
const analyzeImageCharacteristics = async (
  jpegDataUrl: string
): Promise<{ contrastRatio: number; anomalyRatio: number; isLikelyDefect: boolean }> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve({ contrastRatio: 0.3, anomalyRatio: 0.15, isLikelyDefect: true });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 128; // thumbnail cepat untuk inspeksi piksel
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ contrastRatio: 0.3, anomalyRatio: 0.15, isLikelyDefect: true });
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const imgData = ctx.getImageData(0, 0, size, size);
        const data = imgData.data;

        let totalLuma = 0;
        const lumas: number[] = new Array(size * size);

        for (let i = 0; i < data.length; i += 4) {
          // Luminance ITU-R BT.601
          const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          lumas[i / 4] = luma;
          totalLuma += luma;
        }

        const avgLuma = totalLuma / (size * size);
        let varianceSum = 0;
        let darkEdgeCount = 0;

        for (let j = 0; j < lumas.length; j++) {
          const diff = lumas[j] - avgLuma;
          varianceSum += diff * diff;
          // Celah retak / siaran biasanya berupa piksel gelap dengan kontras tajam
          if (lumas[j] < avgLuma * 0.55) {
            darkEdgeCount++;
          }
        }

        const stdDev = Math.sqrt(varianceSum / lumas.length);
        const anomalyRatio = Math.max(0.05, Math.min(0.45, darkEdgeCount / lumas.length));
        const isLikelyDefect = stdDev > 25 && anomalyRatio > 0.08;

        resolve({
          contrastRatio: stdDev / 128,
          anomalyRatio,
          isLikelyDefect,
        });
      } catch {
        resolve({ contrastRatio: 0.3, anomalyRatio: 0.15, isLikelyDefect: true });
      }
    };

    img.onerror = () => {
      resolve({ contrastRatio: 0.3, anomalyRatio: 0.15, isLikelyDefect: true });
    };

    img.src = jpegDataUrl;
  });
};

/**
 * Agent AI Offline berbasis Aturan Keteknikan & Heuristik Geometri PUPR.
 * 100% mandiri di browser/perangkat, tanpa unduhan bobot berat, zero latency.
 */
export class ExpertRulesAgent implements AIAgentEngine {
  readonly id = 'OFFLINE_AGENT' as const;
  readonly name = 'Agent AI Offline PSDA (PUPR Engine)';

  isAvailable(): boolean {
    return true; // Selalu tersedia di semua perangkat & kondisi offline
  }

  async analyze(req: DefectAnalysisRequest): Promise<DefectAnalysis> {
    const { jpegDataUrl, segment } = req;

    // Analisis citra lokal pada canvas
    const { anomalyRatio, isLikelyDefect } = await analyzeImageCharacteristics(jpegDataUrl);

    // Ambil preset cacat mutu kategori bangunan yang relevan
    const availablePresets = presetsFor(segment.category);
    const standardDefects = PUPR_DEFECT_STANDARDS.filter((s) => s.category === segment.category);

    // Pilih standar cacat mutu terbaik untuk kategori ini
    const bestStd =
      standardDefects.length > 0
        ? standardDefects[0]
        : findBestPUPRStandard(segment.category, [segment.structureName || '', segment.subType]);

    // Jika citra relatif homogen tanpa anomali gelap/retak yang signifikan
    if (!isLikelyDefect && availablePresets.some((p) => p.code === 'DOK-00')) {
      return {
        defectCode: 'DOK-00',
        defectTitle: 'Dokumentasi Kondisi Segmen Normal',
        severity: 'MINOR',
        technicalFinding: sanitizeTechnicalText(
          `Hasil observasi visual pada STA ${segment.staCode} menunjukkan struktur pasangan/beton dalam kondisi baik tanpa indikasi deformasi atau retak struktural.`
        ),
        repairInstruction: '-',
        affectedVolumeOrArea: '-',
        dueDays: 0,
        engineUsed: this.id,
      };
    }

    // Hitung estimasi kuantitas yang terkalibrasi dengan geometri segmen aktif
    const affectedMetric = calculateCalibratedMetric(segment, bestStd, anomalyRatio);
    const dueDays = resolveCompliantDueDays(bestStd.severity, bestStd.defaultDueDays);

    const finding = bestStd.technicalFindingTemplate
      .replace('{depth}', String(Math.round(anomalyRatio * 15 + 2)))
      .replace('{sedimentThickness}', String(Math.round(anomalyRatio * 30 + 10)));

    return {
      defectCode: bestStd.code,
      defectTitle: bestStd.title,
      severity: bestStd.severity,
      technicalFinding: sanitizeTechnicalText(
        `Pada STA ${segment.staCode} sisi ${segment.positionSide}. ${finding}`
      ),
      repairInstruction: sanitizeTechnicalText(bestStd.repairInstructionTemplate),
      affectedVolumeOrArea: affectedMetric,
      dueDays,
      engineUsed: this.id,
    };
  }
}

