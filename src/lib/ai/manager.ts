import type { AIAgentProvider, DefectAnalysis, DefectAnalysisRequest, SidecarConfig } from './types';
import { ExpertRulesAgent } from './expertRulesAdapter';
import { DEFAULT_SIDECAR_CONFIG, LocalSidecarAgent } from './localSidecarAdapter';
import { GeminiOnlineAgent } from './geminiAdapter';

export type AIPreference = 'AUTO' | 'OFFLINE_AGENT' | 'LOCAL_SIDECAR' | 'GEMINI_VISION';

const KEY_PREF = 'simonev-psda:ai-pref';
const KEY_SIDECAR_URL = 'simonev-psda:ai-sidecar-url';
const KEY_SIDECAR_MODEL = 'simonev-psda:ai-sidecar-model';

export class AIManager {
  private expertAgent: ExpertRulesAgent;
  private sidecarAgent: LocalSidecarAgent;
  private geminiAgent: GeminiOnlineAgent;
  private preference: AIPreference = 'AUTO';
  private sidecarConfig: SidecarConfig = { ...DEFAULT_SIDECAR_CONFIG };

  constructor() {
    this.expertAgent = new ExpertRulesAgent();
    this.sidecarAgent = new LocalSidecarAgent(this.sidecarConfig);
    this.geminiAgent = new GeminiOnlineAgent();
    this.loadSettings();
  }

  loadSettings(): void {
    if (typeof localStorage === 'undefined') return;
    const pref = localStorage.getItem(KEY_PREF) as AIPreference | null;
    if (pref && ['AUTO', 'OFFLINE_AGENT', 'LOCAL_SIDECAR', 'GEMINI_VISION'].includes(pref)) {
      this.preference = pref;
    }
    const url = localStorage.getItem(KEY_SIDECAR_URL);
    if (url) this.sidecarConfig.baseUrl = url;
    const model = localStorage.getItem(KEY_SIDECAR_MODEL);
    if (model) this.sidecarConfig.model = model;

    this.sidecarAgent = new LocalSidecarAgent(this.sidecarConfig);
  }

  saveSettings(pref: AIPreference, sidecarUrl?: string, sidecarModel?: string): void {
    if (typeof localStorage === 'undefined') return;
    this.preference = pref;
    localStorage.setItem(KEY_PREF, pref);
    if (sidecarUrl) {
      this.sidecarConfig.baseUrl = sidecarUrl;
      localStorage.setItem(KEY_SIDECAR_URL, sidecarUrl);
    }
    if (sidecarModel) {
      this.sidecarConfig.model = sidecarModel;
      localStorage.setItem(KEY_SIDECAR_MODEL, sidecarModel);
    }
    this.sidecarAgent = new LocalSidecarAgent(this.sidecarConfig);
  }

  getPreference(): AIPreference {
    return this.preference;
  }

  getSidecarConfig(): SidecarConfig {
    return { ...this.sidecarConfig };
  }

  async getActiveProviderInfo(): Promise<{ provider: AIAgentProvider; name: string; isOffline: boolean }> {
    if (this.preference === 'OFFLINE_AGENT') {
      return { provider: 'OFFLINE_AGENT', name: this.expertAgent.name, isOffline: true };
    }
    if (this.preference === 'LOCAL_SIDECAR') {
      const ok = await this.sidecarAgent.isAvailable();
      return {
        provider: 'LOCAL_SIDECAR',
        name: ok ? this.sidecarAgent.name : `${this.sidecarAgent.name} (Tidak Terdeteksi - Fallback Offline)`,
        isOffline: true,
      };
    }
    if (this.preference === 'GEMINI_VISION') {
      const ok = this.geminiAgent.isAvailable();
      return {
        provider: 'GEMINI_VISION',
        name: ok ? this.geminiAgent.name : `${this.geminiAgent.name} (Offline / Kunci Belum Ada - Fallback Offline)`,
        isOffline: !ok,
      };
    }

    // AUTO STRATEGY
    const sidecarOk = await this.sidecarAgent.isAvailable();
    if (sidecarOk) {
      return { provider: 'LOCAL_SIDECAR', name: `${this.sidecarAgent.name} (Auto)`, isOffline: true };
    }
    const geminiOk = this.geminiAgent.isAvailable();
    if (geminiOk) {
      return { provider: 'GEMINI_VISION', name: `${this.geminiAgent.name} (Auto)`, isOffline: false };
    }
    return { provider: 'OFFLINE_AGENT', name: `${this.expertAgent.name} (Otomatis Lapangan)`, isOffline: true };
  }

  async analyze(req: DefectAnalysisRequest): Promise<DefectAnalysis> {
    // 1. Explicit preference: OFFLINE_AGENT
    if (this.preference === 'OFFLINE_AGENT') {
      return this.expertAgent.analyze(req);
    }

    // 2. Explicit preference: LOCAL_SIDECAR
    if (this.preference === 'LOCAL_SIDECAR') {
      try {
        const ok = await this.sidecarAgent.isAvailable();
        if (ok) return await this.sidecarAgent.analyze(req);
      } catch (err) {
        console.warn('Sidecar agent gagal, beralih ke offline expert rules:', err);
      }
      return this.expertAgent.analyze(req);
    }

    // 3. Explicit preference: GEMINI_VISION
    if (this.preference === 'GEMINI_VISION') {
      try {
        if (this.geminiAgent.isAvailable()) {
          return await this.geminiAgent.analyze(req);
        }
      } catch (err) {
        console.warn('Gemini cloud gagal, beralih ke offline expert rules:', err);
      }
      return this.expertAgent.analyze(req);
    }

    // 4. AUTO
    // Prioritaskan Local Sidecar jika aktif di mesin surveyor
    try {
      if (await this.sidecarAgent.isAvailable()) {
        return await this.sidecarAgent.analyze(req);
      }
    } catch {
      // lanjut fallback
    }

    // Coba Gemini Cloud jika sedang online & ada API key
    try {
      if (this.geminiAgent.isAvailable()) {
        return await this.geminiAgent.analyze(req);
      }
    } catch {
      // lanjut fallback
    }

    // Fallback andalan: Offline Expert Rules PSDA (PUPR Engine)
    return this.expertAgent.analyze(req);
  }
}

export const aiManager = new AIManager();
