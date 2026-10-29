import type { MonevProject } from '../types';
import { CURRENT_SCHEMA_VERSION } from '../types';
import { recomputeProject } from './calc';
import { blankProject } from './factory';
import { validateProjectSchema } from './schema';

const LS_KEY_PRIMARY = 'simonev-psda:project:v3';
const LS_KEY_V3_LEGACY = 'sipho-psda:project:v3';
const LS_KEY_V2 = 'sipho-psda:project:v2';
const LS_KEY_V1 = 'sipho-psda:project:v1';
const LS_MODE = 'simonev-psda:storage-mode';
const LS_MODE_LEGACY = 'sipho-psda:storage-mode';
const SS_APIKEY = 'simonev-psda:gemini-key';
const SS_APIKEY_LEGACY = 'sipho-psda:gemini-key';

// Database IndexedDB tetap memakai nama 'sipho-psda' agar foto resolusi tinggi offline pengguna tidak hilang!
const DB_NAME = 'sipho-psda';
const STORE = 'kv';
const PHOTO_STORE = 'photos';
const DB_VERSION = 2;

export type StorageMode = 'localStorage' | 'indexedDB';

// In-memory fallback untuk Safari Private Mode atau saat Storage API diblokir
const memoryStore = new Map<string, string>();

const safeStorage = {
  getItem: (storage: Storage, key: string): string | null => {
    try {
      return storage.getItem(key);
    } catch {
      return memoryStore.get(key) ?? null;
    }
  },
  setItem: (storage: Storage, key: string, val: string): void => {
    try {
      storage.setItem(key, val);
    } catch {
      memoryStore.set(key, val);
    }
  },
  removeItem: (storage: Storage, key: string): void => {
    try {
      storage.removeItem(key);
    } catch {
      memoryStore.delete(key);
    }
  },
};

// Singleton IndexedDB connection
let _dbPromise: Promise<IDBDatabase> | null = null;

export const getDb = (): Promise<IDBDatabase> => {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        _dbPromise = null;
      };
      db.onerror = () => {
        _dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      _dbPromise = null;
      reject(req.error);
    };
  });

  return _dbPromise;
};

const idbPut = async (key: string, val: string) => {
  const db = await getDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
};

const idbGet = async (key: string) => {
  const db = await getDb();
  return await new Promise<string | undefined>((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => res(r.result as string | undefined);
    r.onerror = () => rej(r.error);
  });
};

// --- PHOTO BLOB STORAGE (IndexedDB) ---
export const dataUrlToBlob = (dataUrl: string): Blob => {
  const parts = dataUrl.split(',');
  const mime = parts[0]?.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(parts[1] || '');
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    u8[i] = bin.charCodeAt(i);
  }
  return new Blob([u8], { type: mime });
};

export const savePhoto = async (id: string, data: string | Blob): Promise<void> => {
  const blob = typeof data === 'string' ? dataUrlToBlob(data) : data;
  const db = await getDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    tx.objectStore(PHOTO_STORE).put(blob, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
};

const _objectUrlCache = new Map<string, string>();

export const loadPhotoUrl = async (id: string): Promise<string | null> => {
  if (!id) return null;
  if (_objectUrlCache.has(id)) return _objectUrlCache.get(id)!;
  try {
    const db = await getDb();
    const blob = await new Promise<Blob | undefined>((res, rej) => {
      const tx = db.transaction(PHOTO_STORE, 'readonly');
      const r = tx.objectStore(PHOTO_STORE).get(id);
      r.onsuccess = () => res(r.result as Blob | undefined);
      r.onerror = () => rej(r.error);
    });
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    _objectUrlCache.set(id, url);
    return url;
  } catch (err) {
    console.warn(`Gagal memuat foto ${id} dari IndexedDB:`, err);
    return null;
  }
};

export const deletePhoto = async (id: string): Promise<void> => {
  if (_objectUrlCache.has(id)) {
    URL.revokeObjectURL(_objectUrlCache.get(id)!);
    _objectUrlCache.delete(id);
  }
  try {
    const db = await getDb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(PHOTO_STORE, 'readwrite');
      tx.objectStore(PHOTO_STORE).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.warn(`Gagal menghapus foto ${id}:`, err);
  }
};

/** Migrasi foto legacy base64 dataUrl ke IndexedDB Blob store */
export const migrateProjectPhotos = async (p: MonevProject): Promise<MonevProject> => {
  let changed = false;
  const updatedSegments = await Promise.all(
    p.segments.map(async (seg) => {
      let segChanged = false;
      const updatedDefects = await Promise.all(
        seg.defects.map(async (def) => {
          if (!def.watermarkedPhotoId && def.watermarkedPhotoDataUrl && def.watermarkedPhotoDataUrl.startsWith('data:')) {
            const photoId = `img_${def.id}`;
            try {
              await savePhoto(photoId, def.watermarkedPhotoDataUrl);
              segChanged = true;
              changed = true;
              return {
                ...def,
                watermarkedPhotoId: photoId,
                watermarkedPhotoDataUrl: undefined,
              };
            } catch (err) {
              console.warn('Gagal migrasi foto defect:', err);
              return def;
            }
          }
          return def;
        })
      );
      if (segChanged) {
        return { ...seg, defects: updatedDefects };
      }
      return seg;
    })
  );

  if (changed || p.schemaVersion < CURRENT_SCHEMA_VERSION) {
    return {
      ...p,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      segments: updatedSegments,
    };
  }
  return p;
};

/** Normalisasi berkas proyek (impor JSON / versi lama) agar seluruh kolom wajib tersedia */
export const normalizeProject = (raw: unknown): MonevProject => {
  const base = blankProject();
  const r = (raw ?? {}) as Partial<MonevProject>;
  if (!Array.isArray(r.segments)) {
    throw new Error('Struktur berkas proyek tidak valid: daftar segmen (segments) tidak ditemukan.');
  }

  const merged = {
    ...base,
    ...r,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    agencyHeader: { ...base.agencyHeader, ...(r.agencyHeader ?? {}) },
    contractInfo: { ...base.contractInfo, ...(r.contractInfo ?? {}) },
    inspectionTeam: { ...base.inspectionTeam, ...(r.inspectionTeam ?? {}) },
    conclusionMode: r.conclusionMode ?? 'OTOMATIS',
    timeline: { ...base.timeline, ...(r.timeline ?? {}) },
    progressPeriods: r.progressPeriods ?? base.progressPeriods ?? [],
    ncrItems: r.ncrItems ?? base.ncrItems ?? [],
    maintenanceRecords: r.maintenanceRecords ?? base.maintenanceRecords ?? [],
    fhoInfo: { ...base.fhoInfo, ...(r.fhoInfo ?? {}) },
    segments: r.segments.map((s) => ({
      ...s,
      mc0Dimensions: s.mc0Dimensions && Object.keys(s.mc0Dimensions).length > 0 ? s.mc0Dimensions : s.mc100Dimensions ?? {},
      mc0VolumeContractM3: s.mc0VolumeContractM3 ?? null,
      mc100Dimensions: s.mc100Dimensions ?? {},
      samples: (s.samples ?? []).map((x) => ({
        ...x,
        isSelected: x.isSelected !== false,
        dimensions: x.dimensions ?? {},
      })),
      visualChecklist: s.visualChecklist ?? [],
      defects: (s.defects ?? []).map((d) => ({
        ...d,
        entryType: d.entryType ?? 'CACAT_MUTU',
        positionSide: d.positionSide ?? s.positionSide,
        watermarkedPhotoId: d.watermarkedPhotoId ?? '',
      })),
      deficitParams: s.deficitParams ?? [],
      averageDeficitParams: s.averageDeficitParams ?? [],
    })),
  };

  const validated = validateProjectSchema(merged);
  return recomputeProject(validated);
};

export const loadProject = async (): Promise<MonevProject | null> => {
  try {
    const mode =
      (safeStorage.getItem(localStorage, LS_MODE) as StorageMode) ||
      (safeStorage.getItem(localStorage, LS_MODE_LEGACY) as StorageMode) ||
      'localStorage';

    // Rantai pembacaan berjenjang: MONEV V3 -> SIPHO V3 -> V2 -> V1
    let txt = mode === 'indexedDB' ? await idbGet(LS_KEY_PRIMARY) : safeStorage.getItem(localStorage, LS_KEY_PRIMARY);
    if (!txt) {
      txt = mode === 'indexedDB' ? await idbGet(LS_KEY_V3_LEGACY) : safeStorage.getItem(localStorage, LS_KEY_V3_LEGACY);
    }
    if (!txt) {
      txt = mode === 'indexedDB' ? await idbGet(LS_KEY_V2) : safeStorage.getItem(localStorage, LS_KEY_V2);
    }
    if (!txt) {
      txt = mode === 'indexedDB' ? await idbGet(LS_KEY_V1) : safeStorage.getItem(localStorage, LS_KEY_V1);
    }

    if (!txt) return null;
    const project = normalizeProject(JSON.parse(txt));
    // Asynchronously trigger photo migration if needed
    const migrated = await migrateProjectPhotos(project);
    return migrated;
  } catch (e) {
    console.error('Gagal memuat proyek lokal', e);
    return null;
  }
};

/** Simpan ke localStorage; bila kuota penuh (foto), beralih otomatis ke IndexedDB */
export const saveProject = async (p: MonevProject): Promise<StorageMode> => {
  const txt = JSON.stringify(p);
  try {
    safeStorage.setItem(localStorage, LS_KEY_PRIMARY, txt);
    safeStorage.setItem(localStorage, LS_KEY_V3_LEGACY, txt); // Simpan salinan backward-compat
    safeStorage.setItem(localStorage, LS_MODE, 'localStorage');
    return 'localStorage';
  } catch {
    await idbPut(LS_KEY_PRIMARY, txt);
    await idbPut(LS_KEY_V3_LEGACY, txt);
    try {
      safeStorage.removeItem(localStorage, LS_KEY_PRIMARY);
      safeStorage.removeItem(localStorage, LS_KEY_V3_LEGACY);
      safeStorage.setItem(localStorage, LS_MODE, 'indexedDB');
    } catch {
      /* abaikan */
    }
    return 'indexedDB';
  }
};

// API Key disimpan di sessionStorage agar tidak tersimpan permanen di disk (K-02)
export const getStoredApiKey = (): string => {
  try {
    return safeStorage.getItem(sessionStorage, SS_APIKEY) || safeStorage.getItem(sessionStorage, SS_APIKEY_LEGACY) || '';
  } catch {
    return '';
  }
};

export const setStoredApiKey = (k: string): void => {
  try {
    safeStorage.setItem(sessionStorage, SS_APIKEY, k);
    safeStorage.setItem(sessionStorage, SS_APIKEY_LEGACY, k);
  } catch {
    /* abaikan */
  }
};

export const safeFileName = (s: string) =>
  s
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 48) || 'proyek';

export const downloadBlob = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
