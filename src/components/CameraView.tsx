import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Aperture,
  Camera,
  CameraOff,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Grid3x3,
  Layers,
  Library,
  Loader2,
  MapPin,
  RotateCcw,
  Save,
  ScanLine,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import type { DefectItem, PHOProject, PositionSide, Severity } from '../types';
import type { Updater } from '../App';
import { Badge, Btn, Card, NumField, SelectField, TextField, cx } from './ui';
import { CATEGORIES, POSITION_LABEL, SUBTYPES, presetsFor } from '../lib/templates';
import { applyCrackFilter, burnWatermark, filterDataUrl, normalizeUpload, sourceToCanvas, JPEG_QUALITY } from '../lib/imaging';
import { analyzeDefect, GEMINI_MODEL, resolveApiKey } from '../lib/gemini';
import { buildWatermarkInfo, dimensionSummary, gpsText } from '../lib/inspection';
import { stempelWaktu, uid } from '../lib/format';
import { savePhoto } from '../lib/storage';
import { SIDE_OPTIONS } from './SegmentsView';
import { SeverityBadge } from './StatusBadge';
import { PhotoThumbnail } from './PhotoThumbnail';
import { ConfirmDialog } from './ConfirmDialog';

export type RapidTag = 'HULU' | 'HILIR' | 'PENAMPANG' | 'CACAT_MUTU';

export interface RapidTagDef {
  tag: RapidTag;
  label: string;
  shortLabel: string;
  code: string;
  title: string;
  entryType: 'DOKUMENTASI' | 'CACAT_MUTU';
  finding: string;
  severity: Severity;
  colorClass: string;
  activeClass: string;
}

export const RAPID_TAGS: RapidTagDef[] = [
  {
    tag: 'HULU',
    label: 'Tampak Hulu',
    shortLabel: 'Hulu',
    code: 'DOK-HULU',
    title: 'Dokumentasi Fisik Tampak Hulu',
    entryType: 'DOKUMENTASI',
    finding: 'Dokumentasi visual fisik segmen dari arah hulu (upstream). Kondisi aliran dan pasangan terpasang.',
    severity: 'MINOR',
    colorClass: 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200',
    activeClass: 'border-indigo-400 bg-indigo-500 text-white shadow-md shadow-indigo-500/30',
  },
  {
    tag: 'HILIR',
    label: 'Tampak Hilir',
    shortLabel: 'Hilir',
    code: 'DOK-HILIR',
    title: 'Dokumentasi Fisik Tampak Hilir',
    entryType: 'DOKUMENTASI',
    finding: 'Dokumentasi visual fisik segmen dari arah hilir (downstream). Kondisi aliran dan kelurusan tanggul.',
    severity: 'MINOR',
    colorClass: 'border-sky-400/50 bg-sky-500/20 text-sky-200',
    activeClass: 'border-sky-400 bg-sky-500 text-white shadow-md shadow-sky-500/30',
  },
  {
    tag: 'PENAMPANG',
    label: 'Penampang Basah',
    shortLabel: 'Penampang',
    code: 'DOK-PENAMPANG',
    title: 'Dokumentasi Dimensi Penampang',
    entryType: 'DOKUMENTASI',
    finding: 'Dokumentasi mistar / pita ukur pada penampang melintang aktual saluran saat opname fisik.',
    severity: 'MINOR',
    colorClass: 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200',
    activeClass: 'border-emerald-400 bg-emerald-500 text-white shadow-md shadow-emerald-500/30',
  },
  {
    tag: 'CACAT_MUTU',
    label: 'Cacat Mutu',
    shortLabel: 'Cacat Mutu',
    code: 'DEF-MUTU',
    title: 'Temuan Cacat Mutu Lapangan',
    entryType: 'CACAT_MUTU',
    finding: 'Terindikasi ketidaksesuaian mutu fisik (retak/keropos/siar rusak). Perlu verifikasi rincian perbaikan.',
    severity: 'MAYOR',
    colorClass: 'border-amber-400/50 bg-amber-500/20 text-amber-200',
    activeClass: 'border-amber-400 bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30',
  },
];

interface Props {
  project: PHOProject;
  update: Updater;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  notify: (m: string, t?: 'ok' | 'err') => void;
  online: boolean;
}

type Gps = DefectItem['gpsCoordinates'];
type Draft = Omit<DefectItem, 'id' | 'staId' | 'staCode' | 'watermarkedPhotoId' | 'watermarkedPhotoDataUrl'> & { rawPhoto: string };

export default function CameraView({ project, update, selectedId, setSelectedId, notify, online }: Props) {
  const seg = project.segments.find((s) => s.id === selectedId) ?? project.segments[0];
  const videoRef = useRef<HTMLVideoElement>(null);
  const filterCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [camOn, setCamOn] = useState(false);
  const [camErr, setCamErr] = useState('');
  const [grid, setGrid] = useState(true);
  const [edge, setEdge] = useState(false);
  const [sens, setSens] = useState(0.55);
  const [gps, setGps] = useState<Gps>({ latitude: null, longitude: null, accuracyMeter: null });
  const [gpsErr, setGpsErr] = useState('');
  const [tilt, setTilt] = useState<number | null>(null);
  const [side, setSide] = useState<PositionSide>(seg?.positionSide ?? 'KIRI_KANAN');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [previewFilter, setPreviewFilter] = useState<string | null>(null);
  const [showFilteredPreview, setShowFilteredPreview] = useState(false);
  const [busy, setBusy] = useState<'' | 'ai' | 'save'>('');
  const [aiNote, setAiNote] = useState('');

  // Continuous burst & instant tagging state
  const [activeTag, setActiveTag] = useState<RapidTag>('HULU');
  const [burstMode, setBurstMode] = useState<boolean>(true);
  const [flash, setFlash] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<DefectItem | null>(null);
  const [savingCount, setSavingCount] = useState<number>(0);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title?: string;
    message: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    open: false,
    message: '',
    onConfirm: () => {},
  });

  const sensRef = useRef(sens);
  sensRef.current = sens;

  const currentIndex = project.segments.findIndex((s) => s.id === seg?.id);
  const prevSeg = currentIndex > 0 ? project.segments[currentIndex - 1] : null;
  const nextSeg = currentIndex >= 0 && currentIndex < project.segments.length - 1 ? project.segments[currentIndex + 1] : null;

  useEffect(() => {
    if (seg) setSide(seg.positionSide);
  }, [seg?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // GPS
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsErr('Perangkat tidak mendukung GPS.');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGps({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyMeter: p.coords.accuracy });
        setGpsErr('');
      },
      (e) => setGpsErr(e.code === 1 ? 'Izin lokasi ditolak.' : 'Sinyal GPS belum diperoleh.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Indikator kemiringan perangkat (bantu ketegakan foto terhadap rambu ukur)
  useEffect(() => {
    const h = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) setTilt(e.gamma);
    };
    window.addEventListener('deviceorientation', h);
    return () => window.removeEventListener('deviceorientation', h);
  }, []);

  const stopCam = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  };
  useEffect(() => stopCam, []);

  const startCam = async () => {
    setCamErr('');
    try {
      const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
      if (DOE?.requestPermission) DOE.requestPermission().catch(() => undefined);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
    } catch (e) {
      setCamErr('Kamera tidak dapat diakses (' + (e as Error).message + '). Gunakan tombol Unggah Foto.');
    }
  };

  // Loop filter tepi/retak real-time
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!camOn || !edge) return;
    const work = document.createElement('canvas');
    const loop = () => {
      const v = videoRef.current,
        out = filterCanvasRef.current;
      if (v && out && v.videoWidth) {
        const w = 480,
          h = Math.round((v.videoHeight / v.videoWidth) * 480);
        if (work.width !== w) {
          work.width = w;
          work.height = h;
          out.width = w;
          out.height = h;
        }
        const wctx = work.getContext('2d', { willReadFrequently: true })!;
        wctx.drawImage(v, 0, 0, w, h);
        out.getContext('2d')!.putImageData(applyCrackFilter(wctx.getImageData(0, 0, w, h), sensRef.current), 0, 0);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [camOn, edge]);

  const presets = useMemo(() => (seg ? presetsFor(seg.category) : []), [seg]);

  const startDraft = (rawPhoto: string) => {
    if (!seg) return;
    stopCam();
    const p = presets.find((x) => x.code !== 'DOK-00') ?? presets[0];
    setDraft({
      rawPhoto,
      entryType: 'CACAT_MUTU',
      defectCode: '',
      defectTitle: '',
      severity: p?.severity ?? 'MINOR',
      technicalFinding: '',
      repairInstruction: '',
      affectedVolumeOrArea: '',
      dueDays: 14,
      analysisSource: 'MANUAL_PRESET',
      positionSide: side,
      gpsCoordinates: { ...gps },
      capturedAt: new Date().toISOString(),
    });
    setPreviewFilter(null);
    setShowFilteredPreview(false);
    setAiNote('');
  };

  const captureBurst = async (customTag?: RapidTagDef) => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !seg) return;

    const tag = customTag ?? RAPID_TAGS.find((t) => t.tag === activeTag) ?? RAPID_TAGS[0];

    // Haptic feedback
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(50);
      } catch {
        /* noop */
      }
    }

    // Flash visual mikro
    setFlash(true);
    setTimeout(() => setFlash(false), 90);

    const c = sourceToCanvas(v, v.videoWidth, v.videoHeight);
    const rawPhoto = c.toDataURL('image/jpeg', JPEG_QUALITY);

    // Bila dalam Mode Detail: alihkan ke form review
    if (!burstMode) {
      startDraft(rawPhoto);
      return;
    }

    // Mode Pemotretan Cepat Beruntun: bakar watermark & simpan luring di background tanpa menjeda kamera
    const itemId = uid('dft');
    const photoId = `pho_${itemId}`;
    const capturedAt = new Date().toISOString();

    const item: DefectItem = {
      id: itemId,
      staId: seg.id,
      staCode: seg.staCode,
      entryType: tag.entryType,
      defectCode: tag.code,
      defectTitle: tag.title,
      severity: tag.severity,
      technicalFinding: tag.finding,
      repairInstruction: tag.entryType === 'CACAT_MUTU' ? 'Lakukan perbaikan dan perapian sesuai spesifikasi teknis.' : '-',
      affectedVolumeOrArea: '-',
      dueDays: tag.entryType === 'CACAT_MUTU' ? 14 : 0,
      analysisSource: 'MANUAL_PRESET',
      positionSide: side,
      gpsCoordinates: { ...gps },
      watermarkedPhotoId: photoId,
      capturedAt,
    };

    setSavingCount((n) => n + 1);

    try {
      const projected = {
        ...seg,
        evaluationStatus: tag.entryType === 'CACAT_MUTU' ? ('PERLU_PERBAIKAN' as const) : seg.evaluationStatus,
      };

      const watermarkedDataUrl = await burnWatermark(rawPhoto, buildWatermarkInfo(project, projected, item));
      await savePhoto(photoId, watermarkedDataUrl);

      update((p) => ({
        ...p,
        segments: p.segments.map((s) => (s.id === seg.id ? { ...s, defects: [...s.defects, item] } : s)),
      }));

      notify(`Foto [${tag.label}] tersimpan di ${seg.staCode}.`);
    } catch (e) {
      notify('Gagal menyimpan foto: ' + (e as Error).message, 'err');
    } finally {
      setSavingCount((n) => Math.max(0, n - 1));
    }
  };

  const applyPreset = (code: string) => {
    const pr = presets.find((x) => x.code === code);
    if (!pr || !draft) return;
    setDraft({
      ...draft,
      entryType: pr.code === 'DOK-00' ? 'DOKUMENTASI' : 'CACAT_MUTU',
      defectCode: pr.code,
      defectTitle: pr.title,
      severity: pr.severity,
      technicalFinding: pr.finding,
      repairInstruction: pr.repair,
      affectedVolumeOrArea: pr.affected,
      dueDays: pr.dueDays,
      analysisSource: 'MANUAL_PRESET',
    });
  };

  const runAi = async () => {
    if (!draft || !seg) return;
    setBusy('ai');
    setAiNote('');
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const r = await analyzeDefect(draft.rawPhoto, seg, abortRef.current.signal);
      setDraft((d) => (d ? { ...d, ...r, entryType: r.defectCode === 'DOK-00' ? 'DOKUMENTASI' : 'CACAT_MUTU', analysisSource: 'GEMINI_VISION' } : null));
      setAiNote(`Hasil klasifikasi ${GEMINI_MODEL}. Verifikasi uraian dan kuantitas sebelum disimpan.`);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      const pr = presets.find((x) => x.code !== 'DOK-00');
      if (pr) applyPreset(pr.code);
      setAiNote(
        `Analisis Gemini tidak tersedia — ${(e as Error).message || 'galat jaringan'}. Dialihkan ke Pustaka Preset Cacat Mutu PSDA lokal (${pr?.code ?? '-'}); pilih kode yang sesuai.`,
      );
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    if (!draft || !seg) return;
    if (!draft.defectCode.trim() || !draft.defectTitle.trim()) {
      notify('Kode dan judul temuan wajib diisi (pilih preset atau jalankan analisis).', 'err');
      return;
    }
    setBusy('save');
    try {
      const { rawPhoto, ...draftFields } = draft;
      const itemId = uid('dft');
      const photoId = `pho_${itemId}`;
      const item: DefectItem = {
        ...draftFields,
        id: itemId,
        staId: seg.id,
        staCode: seg.staCode,
        watermarkedPhotoId: photoId,
      };

      const projected = {
        ...seg,
        evaluationStatus: draft.entryType === 'CACAT_MUTU' ? ('PERLU_PERBAIKAN' as const) : seg.evaluationStatus,
      };

      const watermarkedDataUrl = await burnWatermark(rawPhoto, buildWatermarkInfo(project, projected, item));
      await savePhoto(photoId, watermarkedDataUrl);

      update((p) => ({
        ...p,
        segments: p.segments.map((s) => (s.id === seg.id ? { ...s, defects: [...s.defects, item] } : s)),
      }));

      setDraft(null);
      notify(`Foto ber-watermark tersimpan pada ${seg.staCode} (${item.defectCode}).`);
    } catch (e) {
      notify('Gagal menyimpan foto: ' + (e as Error).message, 'err');
    } finally {
      setBusy('');
    }
  };

  if (!seg)
    return (
      <Card>
        <p className="py-10 text-center font-semibold text-slate-500">Tambahkan segmen STA terlebih dahulu.</p>
      </Card>
    );

  const setD = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const level = tilt === null ? null : Math.abs(tilt) < 2 ? 'TEGAK' : `MIRING ${tilt > 0 ? 'KANAN' : 'KIRI'} ${Math.abs(tilt).toFixed(0)}°`;
  const recent = seg.defects.slice(-4).reverse();

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        {/* Header Pilihan STA & Navigasi Cepat */}
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Segmen STA Aktif</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!prevSeg}
                  onClick={() => prevSeg && setSelectedId(prevSeg.id)}
                  className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-white active:scale-95 disabled:opacity-35 disabled:hover:bg-slate-50"
                  title={prevSeg ? `STA Sebelumnya: ${prevSeg.staCode}` : 'Awal Segmen'}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">{prevSeg?.staCode ?? 'Awal'}</span>
                </button>
                <div className="flex-1 min-w-0">
                  <SelectField
                    label="Pilih Ruas / STA"
                    value={seg.id}
                    onChange={(v) => {
                      setSelectedId(v);
                      setDraft(null);
                    }}
                    options={project.segments.map((s) => ({ value: s.id, label: `${s.staCode} — ${SUBTYPES[s.subType].shortLabel}` }))}
                  />
                </div>
                <button
                  type="button"
                  disabled={!nextSeg}
                  onClick={() => nextSeg && setSelectedId(nextSeg.id)}
                  className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-white active:scale-95 disabled:opacity-35 disabled:hover:bg-slate-50"
                  title={nextSeg ? `STA Berikutnya: ${nextSeg.staCode}` : 'Akhir Segmen'}
                >
                  <span className="hidden sm:inline">{nextSeg?.staCode ?? 'Akhir'}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <SelectField
              label="Posisi Pengambilan"
              value={side}
              onChange={(v) => {
                setSide(v);
                setD('positionSide', v);
              }}
              options={SIDE_OPTIONS}
            />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-bold">
            <span
              className={cx(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition shadow-2xs',
                gps.latitude !== null
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                  : 'border-amber-200 bg-amber-50 text-amber-950',
              )}
            >
              <span className="relative flex h-2.5 w-2.5">
                {gps.latitude !== null ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                ) : (
                  <>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                  </>
                )}
              </span>
              <MapPin className="h-3.5 w-3.5 text-slate-600" />
              {gps.latitude !== null ? gpsText(gps) : gpsErr || 'Mencari sinyal GPS…'}
            </span>
            <Badge tone="slate" wrap>
              {CATEGORIES[seg.category].code} · {CATEGORIES[seg.category].reference}
            </Badge>
          </div>
        </Card>

        {/* Viewfinder Kamera */}
        <div className={cx('overflow-hidden rounded-2xl border-2 border-slate-900 bg-slate-950 shadow-xl', draft && 'hidden')}>
          <div className="relative aspect-[4/3] sm:aspect-video w-full bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className={cx('absolute inset-0 h-full w-full object-cover', (!camOn || edge) && 'invisible')}
            />
            {edge && camOn && <canvas ref={filterCanvasRef} className="absolute inset-0 h-full w-full object-cover" />}
            {grid && camOn && <GridOverlay />}

            {/* Kilat Shutter Flash Mikro */}
            {flash && (
              <div className="pointer-events-none absolute inset-0 z-30 bg-white/80 transition-opacity duration-75 animate-out fade-out" />
            )}

            {camOn && level && (
              <div
                className={cx(
                  'absolute left-3 top-3 rounded-lg px-2.5 py-1 text-xs font-black shadow-md backdrop-blur-md',
                  level === 'TEGAK' ? 'bg-emerald-600/90 text-white' : 'bg-amber-400/90 text-slate-950',
                )}
              >
                {level}
              </div>
            )}
            {camOn && edge && (
              <div className="absolute right-3 top-3 rounded-lg bg-red-600/90 px-2.5 py-1 text-xs font-black text-white shadow-md backdrop-blur-md">
                FILTER RETAK &amp; RONGGA
              </div>
            )}
            {!camOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-300">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-400">
                  <CameraOff className="h-8 w-8" />
                </div>
                <p className="text-sm font-bold text-slate-300 max-w-xs">{camErr || 'Kamera belakang belum aktif. Tekan AKTIFKAN untuk memulai pemotretan cepat.'}</p>
              </div>
            )}
          </div>

          {/* Pita Tag Cepat Sekali Sentuh */}
          {camOn && (
            <div className="border-t border-slate-800 bg-slate-950/95 px-2.5 pt-2 pb-1.5 backdrop-blur">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="font-extrabold tracking-wider text-slate-400 uppercase flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-400" />
                  Pita Tag Instan:
                </span>
                <button
                  type="button"
                  onClick={() => setBurstMode((b) => !b)}
                  className={cx(
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase transition',
                    burstMode ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40' : 'bg-slate-800 text-slate-400',
                  )}
                >
                  <Layers className="h-3 w-3" />
                  {burstMode ? 'Mode Beruntun (Cepat)' : 'Mode Detail & AI'}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {RAPID_TAGS.map((t) => {
                  const active = activeTag === t.tag;
                  return (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => {
                        setActiveTag(t.tag);
                        if (camOn && burstMode) {
                          captureBurst(t);
                        }
                      }}
                      className={cx(
                        'flex h-11 flex-col items-center justify-center rounded-xl border text-[10px] font-black uppercase transition active:scale-95',
                        active ? t.activeClass : t.colorClass,
                      )}
                      title={`Pilih atau sentuh untuk langsung memotret ${t.label}`}
                    >
                      <span>{t.shortLabel}</span>
                      <span className="text-[8px] opacity-75">{t.code}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Kontrol Shutter & Kamera Bawah */}
          <div className="grid grid-cols-4 gap-1.5 bg-slate-950/95 border-t border-slate-800 p-2 sm:p-2.5 backdrop-blur">
            <button
              onClick={() => setGrid((g) => !g)}
              className={cx(
                'flex h-14 flex-col items-center justify-center rounded-xl text-[11px] font-bold transition border active:scale-95',
                grid
                  ? 'border-sky-400/50 bg-sky-500/20 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                  : 'border-slate-800 bg-slate-900/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800',
              )}
            >
              <Grid3x3 className="h-5 w-5 mb-0.5" />
              Grid Skala
            </button>
            <button
              onClick={() => setEdge((g) => !g)}
              className={cx(
                'flex h-14 flex-col items-center justify-center rounded-xl text-[11px] font-bold transition border active:scale-95',
                edge
                  ? 'border-red-400/50 bg-red-500/20 text-red-300 shadow-[0_0_12px_rgba(248,113,113,0.2)]'
                  : 'border-slate-800 bg-slate-900/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800',
              )}
            >
              <ScanLine className="h-5 w-5 mb-0.5" />
              Filter Retak
            </button>
            {camOn ? (
              <button
                onClick={() => captureBurst()}
                className="flex h-14 flex-col items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-[11px] font-black text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:from-amber-300 hover:to-amber-400 active:scale-95 transition"
              >
                <Aperture className="h-6 w-6 mb-0.5 animate-pulse" />
                AMBIL FOTO
              </button>
            ) : (
              <button
                onClick={startCam}
                className="flex h-14 flex-col items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 text-[11px] font-black text-white shadow-[0_0_16px_rgba(16,185,129,0.3)] active:scale-95 transition"
              >
                <Camera className="h-6 w-6 mb-0.5" />
                AKTIFKAN
              </button>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-14 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/90 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition"
            >
              <Upload className="h-5 w-5 mb-0.5" />
              Unggah Foto
            </button>
          </div>
          {edge && (
            <div className="flex items-center gap-3 bg-[#0f172a] px-3 pb-3 text-xs font-bold text-slate-200">
              <span>Sensitivitas</span>
              <input
                type="range"
                min={0.1}
                max={0.95}
                step={0.05}
                value={sens}
                onChange={(e) => setSens(Number(e.target.value))}
                className="h-8 flex-1 accent-red-500"
              />
              <span className="num w-10 text-right">{Math.round(sens * 100)}%</span>
            </div>
          )}
          {camOn && (
            <button onClick={stopCam} className="w-full bg-slate-900 py-2 text-xs font-bold text-slate-400">
              Matikan Kamera
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) {
                try {
                  const dataUrl = await normalizeUpload(f);
                  startDraft(dataUrl);
                } catch (err) {
                  notify((err as Error).message, 'err');
                }
              }
            }}
          />
        </div>

        {/* Laci Galeri Bawah (Filmstrip Tray) */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 p-3 shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-200">
              <Camera className="h-4 w-4 text-amber-400" />
              <span>Galeri Foto STA {seg.staCode}</span>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-black text-amber-400 ring-1 ring-slate-700">
                {seg.defects.length} Foto
              </span>
            </div>
            {savingCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400 animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Menyimpan {savingCount} foto…
              </span>
            )}
          </div>

          {seg.defects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/50 py-3.5 text-center text-xs text-slate-400">
              Belum ada foto pada STA ini. Ketuk salah satu tombol tag cepat di atas untuk langsung membidik &amp; menyimpan.
            </div>
          ) : (
            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
              {seg.defects.slice().reverse().map((d) => (
                <div
                  key={d.id}
                  onClick={() => setPreviewItem(d)}
                  className="group relative flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950 transition hover:border-amber-400 hover:ring-2 hover:ring-amber-400/20 active:scale-95"
                  style={{ width: '96px', height: '72px' }}
                >
                  <PhotoThumbnail
                    photoId={d.watermarkedPhotoId}
                    fallbackDataUrl={d.watermarkedPhotoDataUrl}
                    alt={d.defectCode}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent px-1.5 py-0.5 text-[9px] font-bold text-slate-200 truncate">
                    {d.defectCode}
                  </div>
                  <div
                    className={cx(
                      'absolute top-1 right-1 h-2.5 w-2.5 rounded-full ring-1 ring-slate-950',
                      d.entryType === 'CACAT_MUTU' ? 'bg-amber-400' : 'bg-emerald-400',
                    )}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {draft && (
          <Card
            title="Citra Pemeriksaan"
            icon={<Camera className="h-5 w-5" />}
            right={
              <Btn variant="ghost" className="min-h-[44px]" onClick={() => setDraft(null)}>
                <RotateCcw className="h-5 w-5" />
                Ulangi
              </Btn>
            }
          >
            <img
              src={showFilteredPreview && previewFilter ? previewFilter : draft.rawPhoto}
              alt="Pratinjau"
              className="w-full rounded-lg border"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Btn
                onClick={async () => {
                  if (!previewFilter) setPreviewFilter(await filterDataUrl(draft.rawPhoto, sens));
                  setShowFilteredPreview((v) => !v);
                }}
              >
                <ScanLine className="h-5 w-5" />
                {showFilteredPreview ? 'Tampilkan Citra Asli' : 'Filter Kontras Retak & Rongga'}
              </Btn>
              <span className="self-center text-xs font-semibold text-slate-600">
                Watermark dibakar pada citra asli saat disimpan. Waktu: {new Date(draft.capturedAt).toLocaleString('id-ID')}
              </span>
            </div>
          </Card>
        )}

        <div className="rounded-lg border border-slate-300 bg-white p-3 text-xs font-semibold text-slate-700">
          <div className="mb-1 font-extrabold uppercase text-slate-900">Ringkasan dimensi pada watermark</div>
          <div className="font-mono">{dimensionSummary(seg)}</div>
        </div>
      </div>

      <div className="space-y-3">
        {draft ? (
          <Card title="Klasifikasi Temuan" icon={<Crosshair className="h-5 w-5" />}>
            <div className="grid gap-3">
              <Btn variant="primary" className="w-full" disabled={busy !== ''} onClick={runAi}>
                {busy === 'ai' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                Analisis Cacat Mutu Visual (Gemini Vision AI)
              </Btn>
              <p className="text-xs font-semibold text-slate-600">
                {!online
                  ? 'Status: LURING — analisis otomatis memakai Pustaka Preset lokal.'
                  : !resolveApiKey()
                  ? 'Status: kunci API belum diatur — analisis memakai Pustaka Preset lokal.'
                  : `Model: ${GEMINI_MODEL} · keluaran JSON terstruktur.`}
              </p>
              {aiNote && <p className="rounded-lg border-2 border-slate-300 bg-slate-50 p-2 text-xs font-bold text-slate-800">{aiNote}</p>}
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[13px] font-semibold text-slate-700">
                  <Library className="h-4 w-4" />
                  Pustaka Preset Cacat Mutu PSDA
                </span>
                <select
                  value={presets.some((x) => x.code === draft.defectCode) ? draft.defectCode : ''}
                  onChange={(e) => applyPreset(e.target.value)}
                  className="h-12 w-full rounded-lg border-2 border-slate-300 bg-white px-3 font-semibold outline-none focus:border-slate-900"
                >
                  <option value="">— Pilih kode preset —</option>
                  {presets.map((x) => (
                    <option key={x.code} value={x.code}>
                      {x.code} · {x.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['CACAT_MUTU', 'DOKUMENTASI'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setD('entryType', t)}
                    className={cx(
                      'h-12 rounded-lg border-2 text-sm font-extrabold',
                      draft.entryType === t ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white',
                    )}
                  >
                    {t === 'CACAT_MUTU' ? 'Cacat Mutu' : 'Dokumentasi'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <TextField label="Kode" value={draft.defectCode} onChange={(v) => setD('defectCode', v.toUpperCase())} />
                <TextField label="Judul Cacat Mutu" value={draft.defectTitle} onChange={(v) => setD('defectTitle', v)} />
              </div>
              {draft.entryType === 'CACAT_MUTU' && (
                <div>
                  <span className="mb-1 block text-[13px] font-semibold text-slate-700">Tingkat Keparahan</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(['MINOR', 'MAYOR', 'KRITIS'] as Severity[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setD('severity', s)}
                        className={cx(
                          'h-12 rounded-lg border-2 text-sm font-extrabold',
                          draft.severity === s
                            ? s === 'KRITIS'
                              ? 'border-red-800 bg-red-700 text-white'
                              : s === 'MAYOR'
                              ? 'border-orange-700 bg-orange-500 text-white'
                              : 'border-amber-600 bg-amber-300 text-black'
                            : 'border-slate-300 bg-white',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <TextField label="Uraian Temuan Teknis" multiline value={draft.technicalFinding} onChange={(v) => setD('technicalFinding', v)} />
              {draft.entryType === 'CACAT_MUTU' && (
                <TextField label="Instruksi Perbaikan" multiline value={draft.repairInstruction} onChange={(v) => setD('repairInstruction', v)} />
              )}
              <div className="grid grid-cols-2 gap-2">
                <TextField label="Volume / Luas Terdampak" value={draft.affectedVolumeOrArea} onChange={(v) => setD('affectedVolumeOrArea', v)} />
                {draft.entryType === 'CACAT_MUTU' && (
                  <NumField
                    label="Batas Waktu"
                    unit="hari"
                    integer
                    value={draft.dueDays}
                    onChange={(v) => setD('dueDays', Math.max(0, Math.round(v ?? 0)))}
                  />
                )}
              </div>
              <div className="text-xs font-semibold text-slate-600">
                Sumber klasifikasi: {draft.analysisSource === 'GEMINI_VISION' ? 'Gemini Vision AI' : 'Preset Lokal / Manual'} · GPS:{' '}
                {gpsText(draft.gpsCoordinates)} · Posisi: {POSITION_LABEL[draft.positionSide]}
              </div>
              <Btn variant="success" className="w-full text-base" disabled={busy !== ''} onClick={save}>
                {busy === 'save' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                Bakar Watermark & Simpan ke Defect List
              </Btn>
            </div>
          </Card>
        ) : (
          <Card title="Petunjuk Pemotretan" icon={<Crosshair className="h-5 w-5" />}>
            <ol className="list-decimal space-y-1 pl-5 text-sm font-medium text-slate-700">
              <li>Tempatkan rambu ukur / pita meteran pada bidang temuan; luruskan dengan garis vertikal grid.</li>
              <li>Aktifkan Filter Retak untuk menonjolkan retak, siaran lepas, atau rongga pasangan/bronjong.</li>
              <li>Ambil foto, klasifikasikan temuan (Gemini Vision atau Preset), lalu simpan.</li>
              <li>Watermark berisi paket, kontrak, STA, posisi, GPS, waktu, dimensi rerata vs MC-100, dan status.</li>
            </ol>
          </Card>
        )}

        <Card title={`Foto Tersimpan — ${seg.staCode}`}>
          {recent.length === 0 && <p className="text-sm font-semibold text-slate-500">Belum ada foto.</p>}
          <div className="grid grid-cols-2 gap-2">
            {recent.map((d) => (
              <div key={d.id} className="block overflow-hidden rounded-lg border">
                <PhotoThumbnail
                  photoId={d.watermarkedPhotoId}
                  fallbackDataUrl={d.watermarkedPhotoDataUrl}
                  alt={d.defectCode}
                  className="aspect-video w-full object-cover"
                />
                <div className="flex items-center justify-between gap-1 p-1.5 text-xs font-bold">
                  <span className="font-mono">{d.defectCode}</span>
                  {d.entryType === 'CACAT_MUTU' ? <SeverityBadge s={d.severity} /> : <Badge tone="green">DOK</Badge>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Modal Pratinjau Cepat Foto & Hapus */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-black text-amber-400">{previewItem.defectCode}</span>
                <span
                  className={cx(
                    'rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase',
                    previewItem.entryType === 'CACAT_MUTU'
                      ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/30'
                      : 'bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/30',
                  )}
                >
                  {previewItem.entryType === 'CACAT_MUTU' ? 'Cacat Mutu' : 'Dokumentasi'}
                </span>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <PhotoThumbnail
                photoId={previewItem.watermarkedPhotoId}
                fallbackDataUrl={previewItem.watermarkedPhotoDataUrl}
                alt={previewItem.defectCode}
                className="w-full rounded-xl border border-slate-700 object-contain max-h-[50vh] bg-black"
              />
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-1.5 text-xs">
                <div className="font-bold text-slate-200">{previewItem.defectTitle}</div>
                <div className="text-slate-400">{previewItem.technicalFinding}</div>
                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-slate-300">
                    <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                    {gpsText(previewItem.gpsCoordinates)}
                  </span>
                  <span>{stempelWaktu(previewItem.capturedAt)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/80 px-4 py-3">
              <Btn
                variant="ghost"
                className="text-xs text-rose-400 hover:bg-rose-950/50 hover:text-rose-200"
                onClick={() => {
                  setConfirmState({
                    open: true,
                    title: 'Hapus Foto',
                    message: `Hapus foto ${previewItem.defectCode} (${previewItem.defectTitle})?`,
                    isDestructive: true,
                    onConfirm: () => {
                      update((p) => ({
                        ...p,
                        segments: p.segments.map((s) =>
                          s.id === seg.id ? { ...s, defects: s.defects.filter((x) => x.id !== previewItem.id) } : s,
                        ),
                      }));
                      setPreviewItem(null);
                      notify('Foto berhasil dihapus.');
                    },
                  });
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span>Hapus Foto</span>
              </Btn>
              <Btn onClick={() => setPreviewItem(null)}>Tutup</Btn>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        isDestructive={confirmState.isDestructive}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}

function GridOverlay() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="none">
      {Array.from({ length: 19 }, (_, i) => (
        <line key={'v' + i} x1={(i + 1) * 20} y1={0} x2={(i + 1) * 20} y2={300} stroke="rgba(255,255,255,0.22)" strokeWidth={0.5} />
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <line key={'h' + i} x1={0} y1={(i + 1) * 20} x2={400} y2={(i + 1) * 20} stroke="rgba(255,255,255,0.22)" strokeWidth={0.5} />
      ))}
      {[133.3, 266.7].map((x) => (
        <line key={'tv' + x} x1={x} y1={0} x2={x} y2={300} stroke="rgba(250,204,21,0.85)" strokeWidth={1} />
      ))}
      {[100, 200].map((y) => (
        <line key={'th' + y} x1={0} y1={y} x2={400} y2={y} stroke="rgba(250,204,21,0.85)" strokeWidth={1} />
      ))}
      <line x1={200} y1={0} x2={200} y2={300} stroke="rgba(239,68,68,0.95)" strokeWidth={1.2} strokeDasharray="6 4" />
      <line x1={0} y1={150} x2={400} y2={150} stroke="rgba(239,68,68,0.95)" strokeWidth={1.2} strokeDasharray="6 4" />
      <circle cx={200} cy={150} r={10} fill="none" stroke="rgba(239,68,68,0.95)" strokeWidth={1.2} />
      {Array.from({ length: 11 }, (_, i) => (
        <line key={'tk' + i} x1={8} y1={40 + i * 22} x2={i % 5 === 0 ? 24 : 16} y2={40 + i * 22} stroke="#fff" strokeWidth={1.2} />
      ))}
      <text x={28} y={44} fill="#fff" fontSize={8} fontWeight={700}>
        BAK UKUR
      </text>
    </svg>
  );
}
