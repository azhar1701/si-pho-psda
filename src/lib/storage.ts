import type { PHOProject } from '../types';
import { recomputeProject } from './calc';
import { blankProject } from './factory';

const LS_KEY = 'sipho-psda:project:v1';
const LS_MODE = 'sipho-psda:storage-mode';
const LS_APIKEY = 'sipho-psda:gemini-key';
const DB_NAME = 'sipho-psda';
const STORE = 'kv';

export type StorageMode = 'localStorage' | 'indexedDB';

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const idbPut = async (key: string, val: string) => {
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
};

const idbGet = async (key: string) => {
  const db = await openDb();
  const v = await new Promise<string | undefined>((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => res(r.result as string | undefined);
    r.onerror = () => rej(r.error);
  });
  db.close();
  return v;
};

/** Normalisasi berkas proyek (impor JSON / versi lama) agar seluruh kolom wajib tersedia */
export const normalizeProject = (raw: unknown): PHOProject => {
  const base = blankProject();
  const r = (raw ?? {}) as Partial<PHOProject>;
  if (!Array.isArray(r.segments)) throw new Error('Struktur berkas proyek tidak valid: daftar segmen (segments) tidak ditemukan.');
  const p: PHOProject = {
    ...base,
    ...r,
    agencyHeader: { ...base.agencyHeader, ...(r.agencyHeader ?? {}) },
    contractInfo: { ...base.contractInfo, ...(r.contractInfo ?? {}) },
    inspectionTeam: { ...base.inspectionTeam, ...(r.inspectionTeam ?? {}) },
    conclusionMode: r.conclusionMode ?? 'OTOMATIS',
    segments: r.segments.map((s) => ({
      ...s,
      samples: (s.samples ?? []).map((x) => ({ ...x, isSelected: x.isSelected !== false, dimensions: x.dimensions ?? {} })),
      visualChecklist: s.visualChecklist ?? [],
      defects: (s.defects ?? []).map((d) => ({ ...d, entryType: d.entryType ?? 'CACAT_MUTU', positionSide: d.positionSide ?? s.positionSide })),
      deficitParams: s.deficitParams ?? [],
      averageDeficitParams: s.averageDeficitParams ?? [],
      mc100Dimensions: s.mc100Dimensions ?? {},
    })),
  };
  return recomputeProject(p);
};

export const loadProject = async (): Promise<PHOProject | null> => {
  try {
    const mode = (localStorage.getItem(LS_MODE) as StorageMode) || 'localStorage';
    const txt = mode === 'indexedDB' ? await idbGet(LS_KEY) : localStorage.getItem(LS_KEY);
    if (!txt) return null;
    return normalizeProject(JSON.parse(txt));
  } catch (e) {
    console.error('Gagal memuat proyek lokal', e);
    return null;
  }
};

/** Simpan ke localStorage; bila kuota penuh (foto), beralih otomatis ke IndexedDB */
export const saveProject = async (p: PHOProject): Promise<StorageMode> => {
  const txt = JSON.stringify(p);
  try {
    localStorage.setItem(LS_KEY, txt);
    localStorage.setItem(LS_MODE, 'localStorage');
    return 'localStorage';
  } catch {
    await idbPut(LS_KEY, txt);
    try {
      localStorage.removeItem(LS_KEY);
      localStorage.setItem(LS_MODE, 'indexedDB');
    } catch {
      /* abaikan */
    }
    return 'indexedDB';
  }
};

export const getStoredApiKey = () => {
  try {
    return localStorage.getItem(LS_APIKEY) || '';
  } catch {
    return '';
  }
};
export const setStoredApiKey = (k: string) => {
  try {
    if (k) localStorage.setItem(LS_APIKEY, k);
    else localStorage.removeItem(LS_APIKEY);
  } catch {
    /* abaikan */
  }
};

export const downloadBlob = (content: BlobPart, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

export const safeFileName = (s: string) => s.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').slice(0, 60) || 'proyek';
