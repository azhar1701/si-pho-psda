import { useEffect, useMemo, useRef, useState } from 'react';
import { Aperture, Camera, CameraOff, Crosshair, Grid3x3, Loader2, MapPin, ScanLine, Sparkles, Upload, Save, RotateCcw, Library } from 'lucide-react';
import type { DefectItem, PHOProject, PositionSide, Severity } from '../types';
import type { Updater } from '../App';
import { Badge, Btn, Card, NumField, SelectField, TextField, cx } from './ui';
import { CATEGORIES, POSITION_LABEL, SUBTYPES, presetsFor } from '../lib/templates';
import { applyCrackFilter, burnWatermark, filterDataUrl, normalizeUpload, sourceToCanvas, JPEG_QUALITY } from '../lib/imaging';
import { analyzeDefect, GEMINI_MODEL, resolveApiKey } from '../lib/gemini';
import { buildWatermarkInfo, dimensionSummary, gpsText } from '../lib/inspection';
import { uid } from '../lib/format';
import { SIDE_OPTIONS } from './SegmentsView';
import { SeverityBadge } from './StatusBadge';

interface Props {
  project: PHOProject;
  update: Updater;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  notify: (m: string, t?: 'ok' | 'err') => void;
  online: boolean;
}

type Gps = DefectItem['gpsCoordinates'];
type Draft = Omit<DefectItem, 'id' | 'staId' | 'staCode' | 'watermarkedPhotoDataUrl'> & { rawPhoto: string };

export default function CameraView({ project, update, selectedId, setSelectedId, notify, online }: Props) {
  const seg = project.segments.find((s) => s.id === selectedId) ?? project.segments[0];
  const videoRef = useRef<HTMLVideoElement>(null);
  const filterCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);
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
  const sensRef = useRef(sens);
  sensRef.current = sens;

  useEffect(() => { if (seg) setSide(seg.positionSide); }, [seg?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // GPS
  useEffect(() => {
    if (!('geolocation' in navigator)) { setGpsErr('Perangkat tidak mendukung GPS.'); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => { setGps({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyMeter: p.coords.accuracy }); setGpsErr(''); },
      (e) => setGpsErr(e.code === 1 ? 'Izin lokasi ditolak.' : 'Sinyal GPS belum diperoleh.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Indikator kemiringan perangkat (bantu ketegakan foto terhadap rambu ukur)
  useEffect(() => {
    const h = (e: DeviceOrientationEvent) => { if (e.gamma !== null) setTilt(e.gamma); };
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
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
      const v = videoRef.current, out = filterCanvasRef.current;
      if (v && out && v.videoWidth) {
        const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * 480);
        if (work.width !== w) { work.width = w; work.height = h; out.width = w; out.height = h; }
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
    const p = presets.find((x) => x.code !== 'DOK-00') ?? presets[0];
    setDraft({
      rawPhoto, entryType: 'CACAT_MUTU', defectCode: '', defectTitle: '', severity: p?.severity ?? 'MINOR', technicalFinding: '', repairInstruction: '', affectedVolumeOrArea: '', dueDays: 14,
      analysisSource: 'MANUAL_PRESET', positionSide: side, gpsCoordinates: { ...gps }, capturedAt: new Date().toISOString(),
    });
    setPreviewFilter(null); setShowFilteredPreview(false); setAiNote('');
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = sourceToCanvas(v, v.videoWidth, v.videoHeight);
    startDraft(c.toDataURL('image/jpeg', JPEG_QUALITY));
  };

  const applyPreset = (code: string) => {
    const pr = presets.find((x) => x.code === code);
    if (!pr || !draft) return;
    setDraft({ ...draft, entryType: pr.code === 'DOK-00' ? 'DOKUMENTASI' : 'CACAT_MUTU', defectCode: pr.code, defectTitle: pr.title, severity: pr.severity, technicalFinding: pr.finding, repairInstruction: pr.repair, affectedVolumeOrArea: pr.affected, dueDays: pr.dueDays, analysisSource: 'MANUAL_PRESET' });
  };

  const runAi = async () => {
    if (!draft || !seg) return;
    setBusy('ai'); setAiNote('');
    try {
      const r = await analyzeDefect(draft.rawPhoto, seg);
      setDraft((d) => d && { ...d, ...r, entryType: r.defectCode === 'DOK-00' ? 'DOKUMENTASI' : 'CACAT_MUTU', analysisSource: 'GEMINI_VISION' });
      setAiNote(`Hasil klasifikasi ${GEMINI_MODEL}. Verifikasi uraian dan kuantitas sebelum disimpan.`);
    } catch (e) {
      const pr = presets.find((x) => x.code !== 'DOK-00');
      if (pr) applyPreset(pr.code);
      setAiNote(`Analisis Gemini tidak tersedia — ${(e as Error).message || 'galat jaringan'}. Dialihkan ke Pustaka Preset Cacat Mutu PSDA lokal (${pr?.code ?? '-'}); pilih kode yang sesuai.`);
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    if (!draft || !seg) return;
    if (!draft.defectCode.trim() || !draft.defectTitle.trim()) { notify('Kode dan judul temuan wajib diisi (pilih preset atau jalankan analisis).', 'err'); return; }
    setBusy('save');
    try {
      const item: DefectItem = { ...draft, id: uid('dft'), staId: seg.id, staCode: seg.staCode, watermarkedPhotoDataUrl: '' };
      delete (item as Partial<Draft>).rawPhoto;
      const projected = { ...seg, evaluationStatus: draft.entryType === 'CACAT_MUTU' ? 'PERLU_PERBAIKAN' as const : seg.evaluationStatus };
      item.watermarkedPhotoDataUrl = await burnWatermark(draft.rawPhoto, buildWatermarkInfo(project, projected, item));
      update((p) => ({ ...p, segments: p.segments.map((s) => (s.id === seg.id ? { ...s, defects: [...s.defects, item] } : s)) }));
      setDraft(null);
      notify(`Foto ber-watermark tersimpan pada ${seg.staCode} (${item.defectCode}).`);
    } catch (e) {
      notify('Gagal menyimpan foto: ' + (e as Error).message, 'err');
    } finally {
      setBusy('');
    }
  };

  if (!seg) return <Card><p className="py-10 text-center font-semibold text-slate-500">Tambahkan segmen STA terlebih dahulu.</p></Card>;

  const setD = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const level = tilt === null ? null : Math.abs(tilt) < 2 ? 'TEGAK' : `MIRING ${tilt > 0 ? 'KANAN' : 'KIRI'} ${Math.abs(tilt).toFixed(0)}°`;
  const recent = seg.defects.slice(-4).reverse();

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Segmen STA / Unit Bangunan" value={seg.id} onChange={(v) => { setSelectedId(v); setDraft(null); }}
              options={project.segments.map((s) => ({ value: s.id, label: `${s.staCode} — ${SUBTYPES[s.subType].shortLabel}` }))} />
            <SelectField label="Posisi Pengambilan" value={side} onChange={(v) => { setSide(v); setD('positionSide', v); }} options={SIDE_OPTIONS} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className={cx('flex items-center gap-1 rounded px-2 py-1', gps.latitude !== null ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900')}>
              <MapPin className="h-4 w-4" />{gps.latitude !== null ? gpsText(gps) : gpsErr || 'Mencari sinyal GPS…'}
            </span>
            <Badge tone="slate" wrap>{CATEGORIES[seg.category].code} · {CATEGORIES[seg.category].reference}</Badge>
          </div>
        </Card>

        {(
          <div className={cx('overflow-hidden rounded-xl border-2 border-slate-900 bg-black', draft && 'hidden')}>
            <div className="relative aspect-[4/3] w-full">
              <video ref={videoRef} playsInline muted className={cx('absolute inset-0 h-full w-full object-cover', (!camOn || edge) && 'invisible')} />
              {edge && camOn && <canvas ref={filterCanvasRef} className="absolute inset-0 h-full w-full object-cover" />}
              {grid && camOn && <GridOverlay />}
              {camOn && level && (
                <div className={cx('absolute left-2 top-2 rounded px-2 py-1 text-xs font-black', level === 'TEGAK' ? 'bg-emerald-600 text-white' : 'bg-amber-400 text-black')}>{level}</div>
              )}
              {camOn && edge && <div className="absolute right-2 top-2 rounded bg-red-600 px-2 py-1 text-xs font-black text-white">FILTER RETAK & RONGGA</div>}
              {!camOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-200">
                  <CameraOff className="h-12 w-12" />
                  <p className="text-sm font-semibold">{camErr || 'Kamera belakang belum aktif.'}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1 bg-[#0f172a] p-2">
              <button onClick={() => setGrid((g) => !g)} className={cx('flex h-14 flex-col items-center justify-center rounded-lg text-[11px] font-bold', grid ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300')}><Grid3x3 className="h-5 w-5" />Grid Skala</button>
              <button onClick={() => setEdge((g) => !g)} className={cx('flex h-14 flex-col items-center justify-center rounded-lg text-[11px] font-bold', edge ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300')}><ScanLine className="h-5 w-5" />Filter Retak</button>
              {camOn ? (
                <button onClick={capture} className="flex h-14 flex-col items-center justify-center rounded-lg bg-amber-400 text-[11px] font-black text-black"><Aperture className="h-6 w-6" />AMBIL FOTO</button>
              ) : (
                <button onClick={startCam} className="flex h-14 flex-col items-center justify-center rounded-lg bg-emerald-600 text-[11px] font-black text-white"><Camera className="h-6 w-6" />AKTIFKAN</button>
              )}
              <button onClick={() => fileRef.current?.click()} className="flex h-14 flex-col items-center justify-center rounded-lg bg-slate-800 text-[11px] font-bold text-slate-200"><Upload className="h-5 w-5" />Unggah Foto</button>
            </div>
            {edge && (
              <div className="flex items-center gap-3 bg-[#0f172a] px-3 pb-3 text-xs font-bold text-slate-200">
                <span>Sensitivitas</span>
                <input type="range" min={0.1} max={0.95} step={0.05} value={sens} onChange={(e) => setSens(Number(e.target.value))} className="h-8 flex-1 accent-red-500" />
                <span className="num w-10 text-right">{Math.round(sens * 100)}%</span>
              </div>
            )}
            {camOn && <button onClick={stopCam} className="w-full bg-slate-900 py-2 text-xs font-bold text-slate-400">Matikan Kamera</button>}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) startDraft(await normalizeUpload(f)); }} />
          </div>
        )}

        {draft && (
          <Card title="Citra Pemeriksaan" icon={<Camera className="h-5 w-5" />}
            right={<Btn variant="ghost" className="min-h-[44px]" onClick={() => setDraft(null)}><RotateCcw className="h-5 w-5" />Ulangi</Btn>}>
            <img src={showFilteredPreview && previewFilter ? previewFilter : draft.rawPhoto} alt="Pratinjau" className="w-full rounded-lg border" />
            <div className="mt-2 flex flex-wrap gap-2">
              <Btn onClick={async () => { if (!previewFilter) setPreviewFilter(await filterDataUrl(draft.rawPhoto, sens)); setShowFilteredPreview((v) => !v); }}>
                <ScanLine className="h-5 w-5" />{showFilteredPreview ? 'Tampilkan Citra Asli' : 'Filter Kontras Retak & Rongga'}
              </Btn>
              <span className="self-center text-xs font-semibold text-slate-600">Watermark dibakar pada citra asli saat disimpan. Waktu: {new Date(draft.capturedAt).toLocaleString('id-ID')}</span>
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
                {busy === 'ai' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}Analisis Cacat Mutu Visual (Gemini Vision AI)
              </Btn>
              <p className="text-xs font-semibold text-slate-600">
                {!online ? 'Status: LURING — analisis otomatis memakai Pustaka Preset lokal.' : !resolveApiKey() ? 'Status: kunci API belum diatur — analisis memakai Pustaka Preset lokal.' : `Model: ${GEMINI_MODEL} · keluaran JSON terstruktur.`}
              </p>
              {aiNote && <p className="rounded-lg border-2 border-slate-300 bg-slate-50 p-2 text-xs font-bold text-slate-800">{aiNote}</p>}
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[13px] font-semibold text-slate-700"><Library className="h-4 w-4" />Pustaka Preset Cacat Mutu PSDA</span>
                <select value={presets.some((x) => x.code === draft.defectCode) ? draft.defectCode : ''} onChange={(e) => applyPreset(e.target.value)}
                  className="h-12 w-full rounded-lg border-2 border-slate-300 bg-white px-3 font-semibold outline-none focus:border-slate-900">
                  <option value="">— Pilih kode preset —</option>
                  {presets.map((x) => <option key={x.code} value={x.code}>{x.code} · {x.title}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['CACAT_MUTU', 'DOKUMENTASI'] as const).map((t) => (
                  <button key={t} onClick={() => setD('entryType', t)} className={cx('h-12 rounded-lg border-2 text-sm font-extrabold', draft.entryType === t ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white')}>
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
                      <button key={s} onClick={() => setD('severity', s)} className={cx('h-12 rounded-lg border-2 text-sm font-extrabold', draft.severity === s ? (s === 'KRITIS' ? 'border-red-800 bg-red-700 text-white' : s === 'MAYOR' ? 'border-orange-700 bg-orange-500 text-white' : 'border-amber-600 bg-amber-300 text-black') : 'border-slate-300 bg-white')}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              <TextField label="Uraian Temuan Teknis" multiline value={draft.technicalFinding} onChange={(v) => setD('technicalFinding', v)} />
              {draft.entryType === 'CACAT_MUTU' && <TextField label="Instruksi Perbaikan" multiline value={draft.repairInstruction} onChange={(v) => setD('repairInstruction', v)} />}
              <div className="grid grid-cols-2 gap-2">
                <TextField label="Volume / Luas Terdampak" value={draft.affectedVolumeOrArea} onChange={(v) => setD('affectedVolumeOrArea', v)} />
                {draft.entryType === 'CACAT_MUTU' && <NumField label="Batas Waktu" unit="hari" integer value={draft.dueDays} onChange={(v) => setD('dueDays', Math.max(0, Math.round(v ?? 0)))} />}
              </div>
              <div className="text-xs font-semibold text-slate-600">Sumber klasifikasi: {draft.analysisSource === 'GEMINI_VISION' ? 'Gemini Vision AI' : 'Preset Lokal / Manual'} · GPS: {gpsText(draft.gpsCoordinates)} · Posisi: {POSITION_LABEL[draft.positionSide]}</div>
              <Btn variant="success" className="w-full text-base" disabled={busy !== ''} onClick={save}>
                {busy === 'save' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}Bakar Watermark & Simpan ke Defect List
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
              <a key={d.id} href={d.watermarkedPhotoDataUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border">
                <img src={d.watermarkedPhotoDataUrl} alt={d.defectCode} className="aspect-[4/3] w-full object-cover" />
                <div className="flex items-center justify-between gap-1 p-1.5 text-xs font-bold">
                  <span className="font-mono">{d.defectCode}</span>
                  {d.entryType === 'CACAT_MUTU' ? <SeverityBadge s={d.severity} /> : <Badge tone="green">DOK</Badge>}
                </div>
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function GridOverlay() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="none">
      {Array.from({ length: 19 }, (_, i) => <line key={'v' + i} x1={(i + 1) * 20} y1={0} x2={(i + 1) * 20} y2={300} stroke="rgba(255,255,255,0.22)" strokeWidth={0.5} />)}
      {Array.from({ length: 14 }, (_, i) => <line key={'h' + i} x1={0} y1={(i + 1) * 20} x2={400} y2={(i + 1) * 20} stroke="rgba(255,255,255,0.22)" strokeWidth={0.5} />)}
      {[133.3, 266.7].map((x) => <line key={'tv' + x} x1={x} y1={0} x2={x} y2={300} stroke="rgba(250,204,21,0.85)" strokeWidth={1} />)}
      {[100, 200].map((y) => <line key={'th' + y} x1={0} y1={y} x2={400} y2={y} stroke="rgba(250,204,21,0.85)" strokeWidth={1} />)}
      <line x1={200} y1={0} x2={200} y2={300} stroke="rgba(239,68,68,0.95)" strokeWidth={1.2} strokeDasharray="6 4" />
      <line x1={0} y1={150} x2={400} y2={150} stroke="rgba(239,68,68,0.95)" strokeWidth={1.2} strokeDasharray="6 4" />
      <circle cx={200} cy={150} r={10} fill="none" stroke="rgba(239,68,68,0.95)" strokeWidth={1.2} />
      {Array.from({ length: 11 }, (_, i) => <line key={'tk' + i} x1={8} y1={40 + i * 22} x2={i % 5 === 0 ? 24 : 16} y2={40 + i * 22} stroke="#fff" strokeWidth={1.2} />)}
      <text x={28} y={44} fill="#fff" fontSize={8} fontWeight={700}>BAK UKUR</text>
    </svg>
  );
}
