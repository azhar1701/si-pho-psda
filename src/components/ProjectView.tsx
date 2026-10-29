import { useRef, useState } from 'react';
import {
  Building2,
  Calendar,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  KeyRound,
  RotateCcw,
  Upload,
  Users,
  FilePlus2,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import type { ConclusionMode, MonevProject } from '../types';
import type { Updater } from '../App';
import { Btn, Card, NumField, SelectField, TextField, cx } from './ui';
import { buildMc0Template, buildMc100Template, buildMcTerpaduTemplate, importCsv } from '../lib/csv';
import { downloadBlob, getStoredApiKey, normalizeProject, safeFileName, setStoredApiKey } from '../lib/storage';
import { buildDemoProject } from '../lib/demo';
import { blankProject } from '../lib/factory';
import { fileToDataUrl, loadImage } from '../lib/imaging';
import { resolveApiKey } from '../lib/gemini';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  project: MonevProject;
  update: Updater;
  updateMeta?: Updater;
  replaceProject: (p: MonevProject) => void;
  notify: (m: string, t?: 'ok' | 'err') => void;
}

export default function ProjectView({ project: p, update, updateMeta, replaceProject, notify }: Props) {
  const metaUp = updateMeta ?? update;
  const csvRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState(getStoredApiKey());

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

  const askConfirm = (opts: { title?: string; message: string; isDestructive?: boolean; onConfirm: () => void }) => {
    setConfirmState({ open: true, ...opts });
  };

  const setC = <K extends keyof MonevProject['contractInfo']>(k: K, v: MonevProject['contractInfo'][K]) =>
    metaUp((x) => ({ ...x, contractInfo: { ...x.contractInfo, [k]: v } }));
  const setT = <K extends keyof MonevProject['inspectionTeam']>(k: K, v: MonevProject['inspectionTeam'][K]) =>
    metaUp((x) => ({ ...x, inspectionTeam: { ...x.inspectionTeam, [k]: v } }));
  const setA = <K extends keyof MonevProject['agencyHeader']>(k: K, v: MonevProject['agencyHeader'][K]) =>
    metaUp((x) => ({ ...x, agencyHeader: { ...x.agencyHeader, [k]: v } }));
  const setL = <K extends keyof NonNullable<MonevProject['timeline']>>(k: K, v: NonNullable<MonevProject['timeline']>[K]) =>
    metaUp((x) => ({ ...x, timeline: { ...x.timeline, [k]: v } }));
  const setF = <K extends keyof NonNullable<MonevProject['fhoInfo']>>(k: K, v: NonNullable<MonevProject['fhoInfo']>[K]) =>
    metaUp((x) => ({ ...x, fhoInfo: { ...x.fhoInfo, [k]: v } }));

  const onCsv = async (f: File) => {
    const text = await f.text();
    const res = importCsv(text, p.contractInfo.dimensionToleranceMeter);
    if (!res.segments.length) {
      setImportLog(res.errors);
      notify('Impor CSV gagal: tidak ada baris valid.', 'err');
      return;
    }
    let added = 0,
      updatedCount = 0;
    const segs = [...p.segments];
    for (const s of res.segments) {
      const i = segs.findIndex((e) => e.staCode.trim().toUpperCase() === s.staCode.trim().toUpperCase() && e.subType === s.subType);
      if (i >= 0) {
        updatedCount++;
        segs[i] = {
          ...segs[i],
          structureName: s.structureName || segs[i].structureName,
          positionSide: s.positionSide,
          segmentLengthMeter: s.segmentLengthMeter,
          mc0Dimensions: res.mode === 'MC0' || res.mode === 'TERPADU' ? (s.mc0Dimensions ?? segs[i].mc0Dimensions) : segs[i].mc0Dimensions,
          mc0VolumeContractM3: res.mode === 'MC0' || res.mode === 'TERPADU' ? s.mc0VolumeContractM3 : segs[i].mc0VolumeContractM3,
          mc100Dimensions: res.mode === 'MC100' || res.mode === 'TERPADU' ? (s.mc100Dimensions ?? segs[i].mc100Dimensions) : segs[i].mc100Dimensions,
          mc100VolumeContractM3: res.mode === 'MC100' || res.mode === 'TERPADU' ? s.mc100VolumeContractM3 : segs[i].mc100VolumeContractM3,
          dataSource: s.dataSource,
        };
      } else {
        added++;
        segs.push(s);
      }
    }
    update((x) => ({ ...x, segments: segs }));
    const modeLabel = res.mode === 'TERPADU' ? 'Terpadu (MC-0 & MC-100)' : res.mode === 'MC0' ? 'MC-0' : 'MC-100';
    setImportLog([
      `${res.segments.length} baris ${modeLabel} diproses: ${added} segmen baru ditambahkan, ${updatedCount} segmen diperbarui (data ukur lapangan dipertahankan).`,
      ...res.errors,
    ]);
    notify(`Impor data ${modeLabel} selesai.`);
  };

  const onJson = async (f: File) => {
    try {
      const proj = normalizeProject(JSON.parse(await f.text()));
      askConfirm({
        title: 'Muat Berkas Proyek JSON',
        message: `Muat proyek "${proj.contractInfo.packageName}" (${proj.segments.length} segmen)? Data proyek aktif pada perangkat akan diganti dengan berkas ini.`,
        isDestructive: true,
        onConfirm: () => {
          replaceProject(proj);
          notify('Proyek berhasil dimuat dari berkas JSON.');
        },
      });
    } catch (e) {
      notify('Berkas JSON tidak valid: ' + (e as Error).message, 'err');
    }
  };

  const onLogo = async (f: File) => {
    const img = await loadImage(await fileToDataUrl(f));
    const c = document.createElement('canvas');
    const s = Math.min(1, 240 / img.naturalHeight);
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    setA('logoDataUrl', c.toDataURL('image/png'));
  };

  const exportJson = () => {
    downloadBlob(
      JSON.stringify(p, null, 1),
      `SIMONEV_${safeFileName(p.contractInfo.packageName)}_${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
    );
    notify('Berkas cadangan proyek (.json) diunduh.');
  };

  const sides: { value: ConclusionMode; label: string }[] = [
    { value: 'OTOMATIS', label: 'Evaluasi Otomatis (Mengacu Toleransi & Daftar Cacat)' },
    { value: 'DAPAT_DITERIMA', label: 'Dapat Diterima untuk PHO (Sesuai Rencana)' },
    { value: 'DITERIMA_DENGAN_CATATAN', label: 'Diterima dengan Catatan Perbaikan (Defect List)' },
    { value: 'BELUM_DAPAT_DITERIMA', label: 'Belum Dapat Diterima (Pekerjaan Belum Tuntas / Cacat Kritis)' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* 1. Manajemen Berkas & Impor MC-0 / MC-100 */}
      <Card title="Manajemen Data & Impor Geometri (MC-0 & MC-100)" icon={<Database className="h-5 w-5 text-indigo-600" />}>
        <p className="text-xs text-slate-500">
          Unduh template CSV untuk rekayasa lapangan (MC-0), opname akhir (MC-100), atau impor sekaligus berkas CSV terpadu.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Btn onClick={() => downloadBlob(buildMc0Template(), 'Template_MC0_SIMONEV_PSDA.csv', 'text/csv;charset=utf-8')}>
            <Download className="h-4 w-4 text-emerald-600" />
            <span>Unduh Template MC-0</span>
          </Btn>
          <Btn onClick={() => downloadBlob(buildMc100Template(), 'Template_MC100_SIMONEV_PSDA.csv', 'text/csv;charset=utf-8')}>
            <Download className="h-4 w-4 text-sky-600" />
            <span>Unduh Template MC-100</span>
          </Btn>
          <Btn onClick={() => downloadBlob(buildMcTerpaduTemplate(), 'Template_MC_Terpadu_SIMONEV_PSDA.csv', 'text/csv;charset=utf-8')}>
            <Download className="h-4 w-4 text-purple-600" />
            <span>Unduh Template Terpadu</span>
          </Btn>
          <Btn onClick={() => csvRef.current?.click()} variant="warning">
            <Upload className="h-4 w-4" />
            <span>Impor Berkas CSV (MC-0 / MC-100)</span>
          </Btn>
          <Btn onClick={exportJson} variant="primary">
            <FileJson className="h-4 w-4 text-amber-400" />
            <span>Simpan Cadangan (.JSON)</span>
          </Btn>
          <Btn onClick={() => jsonRef.current?.click()}>
            <Upload className="h-4 w-4 text-indigo-600" />
            <span>Buka Cadangan (.JSON)</span>
          </Btn>
        </div>
        <input
          ref={csvRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onCsv(f);
            e.target.value = '';
          }}
        />
        <input
          ref={jsonRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onJson(f);
            e.target.value = '';
          }}
        />
        <div className="rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600 ring-1 ring-slate-200">
          <strong className="font-semibold text-slate-800">Sinkronisasi Cerdas:</strong> Sistem otomatis mendeteksi kolom MC-0 atau MC-100 dan menggabungkannya tanpa menghapus data ukur aktual lapangan.
        </div>
        {importLog.length > 0 && (
          <ul className="space-y-1 rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs font-semibold text-slate-800">
            {importLog.map((l, i) => (
              <li key={i}>• {l}</li>
            ))}
          </ul>
        )}
      </Card>

      {/* 2. Inisialisasi & Template Proyek */}
      <Card title="Inisialisasi & Template Proyek" icon={<FilePlus2 className="h-5 w-5 text-amber-600" />}>
        <p className="text-xs text-slate-500">
          Muat proyek percontohan untuk pelatihan monitoring evaluasi atau reset data ke proyek baru yang bersih.
        </p>
        <div className="grid gap-2.5">
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900">Proyek Contoh D.I. Lakbok Utara (MONEV Penuh)</div>
              <div className="text-[11px] text-slate-500">Dataset lengkap (4 segmen terpadu MC-0 vs MC-100, 10 minggu Kurva-S, NCR, log pemeliharaan, foto ber-watermark).</div>
            </div>
            <Btn
              onClick={() => {
                askConfirm({
                  title: 'Muat Proyek Contoh',
                  message: 'Muat ulang Proyek Contoh D.I. Lakbok Utara? Data proyek aktif pada perangkat akan diganti.',
                  isDestructive: true,
                  onConfirm: async () => {
                    replaceProject(await buildDemoProject());
                    notify('Proyek contoh dimuat.');
                  },
                });
              }}
              className="shrink-0"
            >
              <RotateCcw className="h-4 w-4 text-amber-600" />
              <span>Muat Demo</span>
            </Btn>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900">Mulai Proyek Kosong Baru</div>
              <div className="text-[11px] text-slate-500">Bersihkan semua segmen untuk inspeksi paket pekerjaan baru di lapangan.</div>
            </div>
            <Btn
              onClick={() => {
                askConfirm({
                  title: 'Buat Proyek Baru Kosong',
                  message: 'Buat proyek baru yang kosong? Pastikan Anda telah menyimpan cadangan JSON bila data aktif masih diperlukan.',
                  isDestructive: true,
                  onConfirm: () => {
                    replaceProject(blankProject());
                    notify('Proyek baru dibuat.');
                  },
                });
              }}
              className="shrink-0 text-rose-700 hover:bg-rose-50 hover:border-rose-300"
            >
              <FilePlus2 className="h-4 w-4 text-rose-600" />
              <span>Proyek Baru</span>
            </Btn>
          </div>
        </div>
      </Card>

      {/* 3. Kop Surat Instansi */}
      <Card title="Kop Surat Instansi" icon={<Building2 className="h-5 w-5 text-sky-600" />}>
        <div className="grid gap-3">
          <TextField
            label="Pemerintah / Kementerian / Balai"
            value={p.agencyHeader.ministryOrProvince}
            onChange={(v) => setA('ministryOrProvince', v)}
            placeholder="PEMERINTAH PROVINSI ... / BALAI BESAR WILAYAH SUNGAI ..."
          />
          <TextField
            label="Nama Dinas / Bidang"
            value={p.agencyHeader.departmentName}
            onChange={(v) => setA('departmentName', v)}
            placeholder="DINAS ... - BIDANG PSDA"
          />
          <TextField label="Alamat Kantor" value={p.agencyHeader.officeAddress} onChange={(v) => setA('officeAddress', v)} />
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
            <div className="mb-2 text-xs font-bold text-slate-700">Logo Kop Surat Resmi</div>
            <div className="flex items-center gap-3.5">
              {p.agencyHeader.logoDataUrl ? (
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
                  <img src={p.agencyHeader.logoDataUrl} alt="Logo Instansi" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-300/80 bg-slate-100 text-slate-400">
                  <ImageIcon className="h-7 w-7 opacity-50" />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Btn onClick={() => logoRef.current?.click()} className="text-xs">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{p.agencyHeader.logoDataUrl ? 'Ganti Logo' : 'Unggah Logo'}</span>
                  </Btn>
                  {p.agencyHeader.logoDataUrl && (
                    <Btn
                      variant="ghost"
                      onClick={() => setA('logoDataUrl', undefined)}
                      className="text-xs text-rose-600 hover:bg-rose-50"
                      title="Hapus Logo"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Hapus</span>
                    </Btn>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  Format PNG/JPG transparan. Tampil otomatis di header aplikasi dan kop surat Berita Acara A4.
                </div>
              </div>
            </div>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onLogo(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>
      </Card>

      {/* 4. Data Kontrak & Administrasi MC-0 / MC-100 */}
      <Card title="Data Kontrak & Administrasi (MC-0 & MC-100)" icon={<FileSpreadsheet className="h-5 w-5" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField label="Nama Paket Pekerjaan" value={p.contractInfo.packageName} onChange={(v) => setC('packageName', v)} />
          </div>
          <TextField label="Nomor Kontrak" value={p.contractInfo.contractNumber} onChange={(v) => setC('contractNumber', v)} />
          <TextField label="Tanggal Kontrak" type="date" value={p.contractInfo.contractDate} onChange={(v) => setC('contractDate', v)} />

          {/* Sub-administrasi MC-0 & MC-100 */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 sm:col-span-2">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-emerald-900">
              <Layers className="h-4 w-4 text-emerald-600" />
              <span>Administrasi Rekayasa Lapangan (MC-0) &amp; Opname Akhir (MC-100)</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Nomor Berita Acara MC-0 (Awal)"
                placeholder="602.1/045.MC0/PSDA/2026"
                value={p.contractInfo.mc0Number ?? ''}
                onChange={(v) => setC('mc0Number', v)}
              />
              <TextField
                label="Tanggal Berita Acara MC-0"
                type="date"
                value={p.contractInfo.mc0Date ?? ''}
                onChange={(v) => setC('mc0Date', v)}
              />
              <TextField
                label="Nomor Berita Acara MC-100 (Akhir)"
                placeholder="602.1/045.MC100/PSDA/2026"
                value={p.contractInfo.mc100Number}
                onChange={(v) => setC('mc100Number', v)}
              />
              <TextField
                label="Tanggal Berita Acara MC-100"
                type="date"
                value={p.contractInfo.mc100Date ?? ''}
                onChange={(v) => setC('mc100Date', v)}
              />
            </div>
          </div>

          <NumField
            label="Nilai Kontrak (Rp)"
            value={p.contractInfo.contractValueIdr}
            onChange={(v) => setC('contractValueIdr', v ?? 0)}
            integer
          />
          <TextField
            label="Tahun Anggaran"
            value={p.contractInfo.fiscalYear}
            onChange={(v) => setC('fiscalYear', v)}
            inputMode="numeric"
          />
          <TextField
            label="Daerah Irigasi / Sungai"
            value={p.contractInfo.irrigationAreaOrRiverName}
            onChange={(v) => setC('irrigationAreaOrRiverName', v)}
          />
          <div className="sm:col-span-2">
            <TextField label="Lokasi (Kecamatan / Kabupaten)" value={p.contractInfo.locationDistrict} onChange={(v) => setC('locationDistrict', v)} />
          </div>
          <TextField label="Penyedia Jasa (Kontraktor Pelaksana)" value={p.contractInfo.contractorName} onChange={(v) => setC('contractorName', v)} />
          <TextField
            label="Konsultan Pengawas"
            value={p.contractInfo.supervisingConsultantName}
            onChange={(v) => setC('supervisingConsultantName', v)}
          />
          <NumField
            label="Masa Pemeliharaan"
            unit="hari"
            value={p.contractInfo.maintenancePeriodDays}
            onChange={(v) => setC('maintenancePeriodDays', v ?? 0)}
            integer
          />
          <NumField
            label="Toleransi Deviasi Dimensi (τ)"
            unit="m"
            value={p.contractInfo.dimensionToleranceMeter}
            onChange={(v) => update((x) => ({ ...x, contractInfo: { ...x.contractInfo, dimensionToleranceMeter: Math.max(0, v ?? 0) } }))}
            hint="Kurang dimensi bila (aktual − MC-100) < −τ"
          />
        </div>
      </Card>

      {/* 5. Jadwal Pelaksanaan & SPMK */}
      <Card title="Jadwal Pelaksanaan & SPMK (MONEV Timeline)" icon={<Calendar className="h-5 w-5 text-amber-500" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Nomor SPMK (Surat Perintah Mulai Kerja)"
            placeholder="Contoh: 602.1/045.SPMK/PSDA/2026"
            value={p.timeline?.spmkNumber ?? ''}
            onChange={(v) => setL('spmkNumber', v)}
          />
          <TextField
            label="Tanggal SPMK"
            type="date"
            value={p.timeline?.spmkDate ?? ''}
            onChange={(v) => setL('spmkDate', v)}
          />
          <TextField
            label="Tanggal Mulai Pelaksanaan Fisik"
            type="date"
            value={p.timeline?.startDate ?? ''}
            onChange={(v) => setL('startDate', v)}
          />
          <TextField
            label="Tanggal Selesai Pelaksanaan (Batas Akhir)"
            type="date"
            value={p.timeline?.endDate ?? ''}
            onChange={(v) => setL('endDate', v)}
          />
          <NumField
            label="Masa Pelaksanaan Kontrak"
            unit="hari kalender"
            integer
            value={p.timeline?.totalCalendarDays ?? 150}
            onChange={(v) => setL('totalCalendarDays', v ?? 150)}
          />
          <TextField
            label="Target Tanggal FHO (Serah Terima Akhir)"
            type="date"
            value={p.timeline?.fhoTargetDate ?? ''}
            onChange={(v) => setL('fhoTargetDate', v)}
          />
        </div>
      </Card>

      {/* 6. Tim Pemeriksa & Panitia Serah Terima PHO */}
      <Card title="Tim Pengawas & Panitia Serah Terima Pertama (PHO)" icon={<Users className="h-5 w-5" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Nomor Berita Acara PHO" value={p.inspectionTeam.baNumber} onChange={(v) => setT('baNumber', v)} />
          <TextField
            label="Tanggal Pemeriksaan Fisik PHO"
            type="date"
            value={p.inspectionTeam.inspectionDate}
            onChange={(v) => setT('inspectionDate', v)}
          />
          <div className="sm:col-span-2">
            <TextField label="Nomor SK Tim Teknis / PPHP" value={p.inspectionTeam.skNumber} onChange={(v) => setT('skNumber', v)} />
          </div>
          <TextField
            label="Ketua Tim Teknis / PPHP"
            value={p.inspectionTeam.leadInspectorName}
            onChange={(v) => setT('leadInspectorName', v)}
          />
          <TextField
            label="NIP Ketua Tim"
            value={p.inspectionTeam.leadInspectorNip}
            onChange={(v) => setT('leadInspectorNip', v)}
            inputMode="numeric"
          />
          <TextField
            label="Direksi Teknis"
            value={p.inspectionTeam.technicalDirectorName}
            onChange={(v) => setT('technicalDirectorName', v)}
          />
          <TextField
            label="NIP Direksi Teknis"
            value={p.inspectionTeam.technicalDirectorNip}
            onChange={(v) => setT('technicalDirectorNip', v)}
            inputMode="numeric"
          />
          <TextField
            label="Wakil Konsultan Pengawas"
            value={p.inspectionTeam.consultantRepName}
            onChange={(v) => setT('consultantRepName', v)}
          />
          <TextField
            label="Jabatan Wakil Konsultan"
            value={p.inspectionTeam.consultantRepTitle}
            onChange={(v) => setT('consultantRepTitle', v)}
          />
          <TextField
            label="Wakil Kontraktor Pelaksana"
            value={p.inspectionTeam.contractorRepName}
            onChange={(v) => setT('contractorRepName', v)}
          />
          <TextField
            label="Jabatan Wakil Kontraktor"
            value={p.inspectionTeam.contractorRepTitle}
            onChange={(v) => setT('contractorRepTitle', v)}
          />
        </div>
      </Card>

      {/* 7. Administrasi Serah Terima Akhir (FHO) */}
      <Card title="Administrasi Serah Terima Akhir (FHO)" icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}>
        <p className="text-xs text-slate-500">
          Kelengkapan administrasi Berita Acara FHO setelah masa pemeliharaan selesai dan seluruh cacat mutu tertuntaskan.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 pt-1">
          <TextField
            label="Nomor Berita Acara FHO"
            placeholder="602.1/045.BA-FHO/PSDA/2027"
            value={p.fhoInfo?.baFhoNumber ?? ''}
            onChange={(v) => setF('baFhoNumber', v)}
          />
          <TextField
            label="Tanggal Berita Acara FHO"
            type="date"
            value={p.fhoInfo?.baFhoDate ?? ''}
            onChange={(v) => setF('baFhoDate', v)}
          />
          <TextField
            label="Tanggal Pemeriksaan Akhir Lapangan"
            type="date"
            value={p.fhoInfo?.inspectionDate ?? ''}
            onChange={(v) => setF('inspectionDate', v)}
          />
          <TextField
            label="Ketua Panitia FHO"
            value={p.fhoInfo?.leadInspectorName ?? p.inspectionTeam.leadInspectorName}
            onChange={(v) => setF('leadInspectorName', v)}
          />
          <TextField
            label="NIP Ketua Panitia FHO"
            value={p.fhoInfo?.leadInspectorNip ?? p.inspectionTeam.leadInspectorNip}
            onChange={(v) => setF('leadInspectorNip', v)}
          />
          <div className="sm:col-span-2">
            <TextField
              label="Catatan Akhir Penutupan Masa Pemeliharaan"
              placeholder="Contoh: Seluruh cacat mutu telah diperbaiki tuntas dan fungsi hidraulis bekerja 100% normal."
              value={p.fhoInfo?.closureNotes ?? ''}
              onChange={(v) => setF('closureNotes', v)}
            />
          </div>
        </div>
      </Card>

      {/* 8. Evaluasi Kelayakan PHO & Analisis AI */}
      <Card title="Evaluasi Kelayakan PHO & Analisis AI" icon={<KeyRound className="h-5 w-5 text-purple-600" />}>
        <div className="grid gap-3">
          <SelectField
            label="Status Rekomendasi Kelayakan PHO pada Berita Acara"
            value={p.conclusionMode}
            onChange={(v) => metaUp((x) => ({ ...x, conclusionMode: v }))}
            options={sides}
          />
          <div className="rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600 ring-1 ring-slate-200">
            <strong className="font-semibold text-slate-800">Evaluasi Otomatis:</strong> Cacat mutu KRITIS atau STA belum diukur → Belum Dapat Diterima. Terdapat cacat mutu minor/mayor (Defect List) → Diterima dengan Catatan. Selain itu → Dapat Diterima.
          </div>
          <TextField
            label="Kunci API Google AI Studio (Gemini)"
            type="password"
            value={apiKey}
            onChange={setApiKey}
            placeholder="AIzaSy…"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Btn
                variant="primary"
                onClick={() => {
                  setStoredApiKey(apiKey.trim());
                  notify(apiKey.trim() ? 'Kunci API disimpan di sesi peramban.' : 'Kunci API dihapus.');
                }}
              >
                Simpan Kunci
              </Btn>
              <Btn
                variant="ghost"
                onClick={() => {
                  setApiKey('');
                  setStoredApiKey('');
                  notify('Kunci API dihapus dari sesi peramban.');
                }}
              >
                Hapus Kunci
              </Btn>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tracking-tight',
                  resolveApiKey()
                    ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-500/20'
                    : 'bg-slate-100 text-slate-600 ring-1 ring-slate-300',
                )}
              >
                <span className={cx('h-2 w-2 rounded-full', resolveApiKey() ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')} />
                {resolveApiKey() ? 'AI Gemini 2.5 Flash Aktif' : 'Preset Lokal Offline'}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Kunci hanya disimpan di sesi peramban lokal Anda dan tidak akan diunggah ke berkas JSON atau dibagikan ke pihak ketiga.
          </p>
        </div>
      </Card>

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
