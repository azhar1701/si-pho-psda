import { useRef, useState } from 'react';
import {
  Building2,
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
} from 'lucide-react';
import type { ConclusionMode, PHOProject } from '../types';
import type { Updater } from '../App';
import { Btn, Card, NumField, SelectField, TextField } from './ui';
import { buildMc100Template, importMc100 } from '../lib/csv';
import { downloadBlob, getStoredApiKey, normalizeProject, safeFileName, setStoredApiKey } from '../lib/storage';
import { buildDemoProject } from '../lib/demo';
import { blankProject } from '../lib/factory';
import { fileToDataUrl, loadImage } from '../lib/imaging';
import { resolveApiKey } from '../lib/gemini';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  project: PHOProject;
  update: Updater;
  updateMeta?: Updater;
  replaceProject: (p: PHOProject) => void;
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

  const setC = <K extends keyof PHOProject['contractInfo']>(k: K, v: PHOProject['contractInfo'][K]) =>
    metaUp((x) => ({ ...x, contractInfo: { ...x.contractInfo, [k]: v } }));
  const setT = <K extends keyof PHOProject['inspectionTeam']>(k: K, v: PHOProject['inspectionTeam'][K]) =>
    metaUp((x) => ({ ...x, inspectionTeam: { ...x.inspectionTeam, [k]: v } }));
  const setA = <K extends keyof PHOProject['agencyHeader']>(k: K, v: PHOProject['agencyHeader'][K]) =>
    metaUp((x) => ({ ...x, agencyHeader: { ...x.agencyHeader, [k]: v } }));

  const onCsv = async (f: File) => {
    const text = await f.text();
    const res = importMc100(text, p.contractInfo.dimensionToleranceMeter);
    if (!res.segments.length) {
      setImportLog(res.errors);
      notify('Impor MC-100 gagal: tidak ada baris valid.', 'err');
      return;
    }
    let added = 0,
      updated = 0;
    const segs = [...p.segments];
    for (const s of res.segments) {
      const i = segs.findIndex((e) => e.staCode.trim().toUpperCase() === s.staCode.trim().toUpperCase() && e.subType === s.subType);
      if (i >= 0) {
        updated++;
        segs[i] = {
          ...segs[i],
          structureName: s.structureName || segs[i].structureName,
          positionSide: s.positionSide,
          segmentLengthMeter: s.segmentLengthMeter,
          mc100Dimensions: s.mc100Dimensions,
          mc100VolumeContractM3: s.mc100VolumeContractM3,
          dataSource: 'IMPORT_MC100',
        };
      } else {
        added++;
        segs.push(s);
      }
    }
    update((x) => ({ ...x, segments: segs }));
    setImportLog([
      `${res.segments.length} baris MC-100 diproses: ${added} segmen baru ditambahkan, ${updated} segmen diperbarui (data ukur lapangan dipertahankan).`,
      ...res.errors,
    ]);
    notify('Impor MC-100 selesai.');
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
      `SIPHO_${safeFileName(p.contractInfo.packageName)}_${p.inspectionTeam.inspectionDate}.json`,
      'application/json',
    );
    notify('Berkas cadangan proyek (.json) diunduh.');
  };

  const sides = [
    { value: 'OTOMATIS', label: 'Otomatis (berdasarkan hasil pemeriksaan)' },
    { value: 'DAPAT_DITERIMA', label: 'Dapat diterima untuk PHO' },
    { value: 'DITERIMA_DENGAN_CATATAN', label: 'Dapat diterima dengan catatan perbaikan (Defect List)' },
    { value: 'BELUM_DAPAT_DITERIMA', label: 'Belum dapat diterima (pemeriksaan ulang)' },
  ] as { value: ConclusionMode; label: string }[];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card title="Manajemen Data Proyek" icon={<Database className="h-5 w-5" />} className="lg:col-span-2">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Btn onClick={() => downloadBlob(buildMc100Template(), 'Template_MC100_SIPHO_PSDA.csv', 'text/csv;charset=utf-8')}>
            <Download className="h-5 w-5" />
            Unduh Template CSV MC-100
          </Btn>
          <Btn variant="primary" onClick={() => csvRef.current?.click()}>
            <FileSpreadsheet className="h-5 w-5" />
            Impor CSV MC-100
          </Btn>
          <Btn onClick={exportJson}>
            <FileJson className="h-5 w-5" />
            Simpan Proyek (.JSON)
          </Btn>
          <Btn onClick={() => jsonRef.current?.click()}>
            <Upload className="h-5 w-5" />
            Muat Proyek (.JSON)
          </Btn>
          <Btn
            variant="ghost"
            className="border-2 border-dashed border-slate-300"
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
          >
            <RotateCcw className="h-5 w-5" />
            Muat Proyek Contoh
          </Btn>
          <Btn
            variant="ghost"
            className="border-2 border-dashed border-slate-300"
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
          >
            <FilePlus2 className="h-5 w-5" />
            Proyek Baru (Kosong)
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
        <p className="mt-3 text-xs font-medium text-slate-600">
          Impor MC-100 bersifat gabung: STA dengan kode & sub-tipe sama diperbarui dimensi rencananya tanpa menghapus hasil ukur lapangan; STA baru
          ditambahkan. Format template: pemisah titik koma (;), desimal koma.
        </p>
        {importLog.length > 0 && (
          <ul className="mt-2 space-y-1 rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs font-semibold text-slate-800">
            {importLog.map((l, i) => (
              <li key={i}>• {l}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Kop Surat Instansi" icon={<Building2 className="h-5 w-5" />}>
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
          <div className="flex items-center gap-3">
            {p.agencyHeader.logoDataUrl ? (
              <img src={p.agencyHeader.logoDataUrl} alt="Logo" className="h-14 w-14 rounded border object-contain" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded border-2 border-dashed text-slate-400">
                <ImageIcon />
              </div>
            )}
            <Btn onClick={() => logoRef.current?.click()}>Unggah Logo Kop</Btn>
            {p.agencyHeader.logoDataUrl && (
              <Btn variant="ghost" onClick={() => setA('logoDataUrl', undefined)}>
                <Trash2 className="h-5 w-5" />
              </Btn>
            )}
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

      <Card title="Data Kontrak & MC-100" icon={<FileSpreadsheet className="h-5 w-5" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField label="Nama Paket Pekerjaan" value={p.contractInfo.packageName} onChange={(v) => setC('packageName', v)} />
          </div>
          <TextField label="Nomor Kontrak" value={p.contractInfo.contractNumber} onChange={(v) => setC('contractNumber', v)} />
          <TextField label="Tanggal Kontrak" type="date" value={p.contractInfo.contractDate} onChange={(v) => setC('contractDate', v)} />
          <TextField label="Nomor Berita Acara MC-100" value={p.contractInfo.mc100Number} onChange={(v) => setC('mc100Number', v)} />
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

      <Card title="Tim Pemeriksa & Para Pihak" icon={<Users className="h-5 w-5" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Nomor Berita Acara PHO" value={p.inspectionTeam.baNumber} onChange={(v) => setT('baNumber', v)} />
          <TextField
            label="Tanggal Pemeriksaan"
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

      <Card title="Kesimpulan BA & Analisis AI" icon={<KeyRound className="h-5 w-5" />}>
        <div className="grid gap-3">
          <SelectField
            label="Pernyataan Kelayakan PHO pada Berita Acara"
            value={p.conclusionMode}
            onChange={(v) => metaUp((x) => ({ ...x, conclusionMode: v }))}
            options={sides}
          />
          <p className="text-xs font-medium text-slate-600">
            Mode otomatis: terdapat cacat mutu KRITIS atau STA belum diukur → belum dapat diterima; terdapat STA perlu perbaikan / defect list →
            diterima dengan catatan; selain itu → dapat diterima.
          </p>
          <TextField
            label="Kunci API Google AI Studio (Gemini) — disimpan hanya di sesi ini"
            type="password"
            value={apiKey}
            onChange={setApiKey}
            placeholder="AIza…"
          />
          <div className="flex flex-wrap gap-2">
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
          <p className="text-xs font-medium text-slate-600">
            Status:{' '}
            {resolveApiKey()
              ? 'kunci tersedia — analisis Gemini 2.5 Flash aktif saat daring.'
              : 'kunci belum tersedia — analisis memakai Pustaka Preset Cacat Mutu PSDA lokal.'}{' '}
            Kunci tidak ikut tersimpan dalam berkas cadangan JSON.
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
