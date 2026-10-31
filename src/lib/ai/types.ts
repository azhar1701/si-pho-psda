import type { InspectionSegment, Severity } from '../../types';

export type AIAgentProvider = 'OFFLINE_AGENT' | 'LOCAL_SIDECAR' | 'GEMINI_VISION' | 'MANUAL_PRESET';

export interface DefectAnalysis {
  defectCode: string;
  defectTitle: string;
  severity: Severity;
  technicalFinding: string;
  repairInstruction: string;
  affectedVolumeOrArea: string;
  dueDays: number;
  engineUsed?: AIAgentProvider;
}

export interface DefectAnalysisRequest {
  jpegDataUrl: string;
  segment: InspectionSegment;
  signal?: AbortSignal;
}

export interface SidecarConfig {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

export interface AIAgentEngine {
  readonly id: AIAgentProvider;
  readonly name: string;
  readonly isAvailable: () => Promise<boolean> | boolean;
  analyze: (req: DefectAnalysisRequest) => Promise<DefectAnalysis>;
}
