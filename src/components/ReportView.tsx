import { Fragment, useState } from 'react';
import {
  FileJson,
  FileSpreadsheet,
  Printer,
  Maximize2,
  ZoomIn,
  Eye,
  FileCheck2,
  TrendingUp,
  Award,
} from 'lucide-react';
import type { PHOProject } from '../types';
import { DIM_KEYS } from '../types';
import { Btn, cx } from './ui';
import { CATEGORIES, CATEGORY_ORDER, POSITION_LABEL, SUBTYPES, SEVERITY_LABEL } from '../lib/templates';
import { STATUS_SHORT, isDeficit, projectSummary, resolveConclusion, sampleArea } from '../lib/calc';
import { computeNCRStats, computeProgressSummary, computeTimelineSummary } from '../lib/progressCalc';
import { addDays, fmt, fmtDim, fmtIdr, kalimatTanggal, stempelWaktu, tanggalPanjang, terbilang } from '../lib/format';
import { buildOpnameCsv } from '../lib/csv';
import { downloadBlob, safeFileName } from '../lib/storage';
import { gpsText } from '../lib/inspection';
import { PhotoThumbnail } from './PhotoThumbnail';

type ReportDocType = 'pho' | 'monev' | 'fho';

export default function ReportView({
  project: p,
  notify,
}: {
  project: PHOProject;
  notify: (m: string, t?: 'ok' | 'err') => void;
}) {
  const [docType, setDocType] = useState<ReportDocType>('pho');
  const base = `${safeFileName(p.contractInfo.packageName)}_${p.inspectionTeam.inspectionDate}`;
  const [mobileFit, setMobileFit] = useState(false);

  return (
    <div className="space-y-4">
      {/* Action Header Card */}
      <div className="no-print rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h1 className="text-base font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Eye className="h-5 w-5 text-amber-500" />
              Pusat Dokumen Resmi &amp; Laporan Kedinasan (A4)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Standar dokumen fisik kedinasan bidang Pengelolaan Sumber Daya Air (format A4 siap cetak &amp; PDF).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileFit((v) => !v)}
              className={cx(
                'inline-flex lg:hidden items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition shadow-xs',
                mobileFit
                  ? 'border-amber-500 bg-amber-50 text-amber-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              {mobileFit ? <ZoomIn className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {mobileFit ? 'Skala Asli 100%' : 'Pas di Layar Ponsel'}
            </button>
          </div>
        </div>

        {/* Tab Selector Dokumen */}
        <div className="mt-3.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDocType('pho')}
            className={cx(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all',
              docType === 'pho'
                ? 'bg-[#0f172a] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            )}
          >
            <FileCheck2 className="h-4 w-4 text-amber-400" />
            1. Berita Acara PHO &amp; Lampiran (Uji Petik)
          </button>

          <button
            type="button"
            onClick={() => setDocType('monev')}
            className={cx(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all',
              docType === 'monev'
                ? 'bg-[#0f172a] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            )}
          >
            <TrendingUp className="h-4 w-4 text-amber-400" />
            2. Laporan Monev Periodik &amp; Kurva-S
          </button>

          <button
            type="button"
            onClick={() => setDocType('fho')}
            className={cx(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all',
              docType === 'fho'
                ? 'bg-[#0f172a] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            )}
          >
            <Award className="h-4 w-4 text-amber-400" />
            3. Berita Acara FHO (Serah Terima Akhir)
          </button>
        </div>

        <div className="mt-3.5 grid gap-2.5 sm:grid-cols-3">
          <Btn variant="primary" onClick={() => window.print()} className="w-full">
            <Printer className="h-5 w-5 text-amber-400" />
            Cetak / Simpan PDF (A4)
          </Btn>
          <Btn
            variant="secondary"
            onClick={() => {
              downloadBlob(buildOpnameCsv(p), `Opname_MC100_vs_Realisasi_${base}.csv`, 'text/csv;charset=utf-8');
              notify('Berkas CSV opname diunduh.');
            }}
            className="w-full"
          >
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Ekspor Back-Up Opname (CSV)
          </Btn>
          <Btn
            variant="secondary"
            onClick={() => {
              downloadBlob(JSON.stringify(p, null, 1), `SIPHO_${base}.json`, 'application/json');
              notify('Berkas proyek (.json) diunduh.');
            }}
            className="w-full"
          >
            <FileJson className="h-5 w-5 text-sky-600" />
            Simpan Cadangan (.JSON)
          </Btn>
        </div>
        <p className="mt-3 text-[11px] font-medium text-slate-500">
          💡 Tips pencetakan: Pada dialog cetak peramban pilih ukuran kertas A4, margin "Sesuai default / None", dan pastikan opsi "Grafik latar belakang (Background graphics)" aktif.
        </p>
      </div>

      {/* Printable Sheet Wrapper */}
      <div className={cx('print-wrap overflow-x-auto pb-8', mobileFit && 'overflow-x-hidden flex justify-center')}>
        <div
          className={cx(
            'doc print-root screen-scale transition-all duration-200',
            mobileFit ? 'origin-top scale-[0.44] sm:scale-[0.62] md:scale-[0.80]' : 'min-w-max',
          )}
        >
          {docType === 'pho' && (
            <>
              <BeritaAcara p={p} />
              <LampiranOpname p={p} />
              <LampiranDefect p={p} />
            </>
          )}

          {docType === 'monev' && <LaporanMonevSheet p={p} />}

          {docType === 'fho' && <BeritaAcaraFHOSheet p={p} />}
        </div>
      </div>
    </div>
  );
}

function Kop({ p }: { p: PHOProject }) {
  const a = p.agencyHeader;
  return (
    <div className="kop mb-4 flex items-center gap-4 pb-2">
      {a.logoDataUrl ? (
        <img src={a.logoDataUrl} alt="" style={{ height: '22mm', width: '22mm', objectFit: 'contain' }} />
      ) : (
        <div style={{ width: '22mm' }} />
      )}
      <div className="flex-1 text-center">
        <div style={{ fontSize: '13pt', fontWeight: 700 }}>{a.ministryOrProvince || '[PEMERINTAH / KEMENTERIAN]'}</div>
        <div style={{ fontSize: '12.5pt', fontWeight: 700 }}>{a.departmentName || '[DINAS / BALAI — BIDANG PSDA]'}</div>
        <div style={{ fontSize: '10pt' }}>{a.officeAddress}</div>
      </div>
      <div style={{ width: '22mm' }} />
    </div>
  );
}

const dash = (s: string | undefined) => (s && s.trim() ? s : '……………………');

function Signatures({ p, compact }: { p: PHOProject; compact?: boolean }) {
  const t = p.inspectionTeam,
    c = p.contractInfo;
  const cols = [
    {
      role: 'Tim Teknis / PPHP',
      org: 'Ketua',
      name: t.leadInspectorName,
      id: t.leadInspectorNip ? `NIP. ${t.leadInspectorNip}` : 'NIP. ……………………',
    },
    {
      role: 'Direksi Teknis',
      org: '',
      name: t.technicalDirectorName,
      id: t.technicalDirectorNip ? `NIP. ${t.technicalDirectorNip}` : 'NIP. ……………………',
    },
    { role: 'Konsultan Pengawas', org: c.supervisingConsultantName, name: t.consultantRepName, id: t.consultantRepTitle },
    { role: 'Kontraktor Pelaksana', org: c.contractorName, name: t.contractorRepName, id: t.contractorRepTitle },
  ];
  return (
    <table className="t avoid" style={{ marginTop: compact ? '6pt' : '14pt', fontSize: compact ? '8pt' : '10pt' }}>
      <tbody>
        <tr>
          {cols.map((x) => (
            <td key={x.role} className="text-center" style={{ width: '25%', fontWeight: 700 }}>
              {x.role}
              {x.org ? <div style={{ fontWeight: 400 }}>{x.org}</div> : null}
            </td>
          ))}
        </tr>
        <tr>
          {cols.map((x) => (
            <td key={x.role} style={{ height: compact ? '16mm' : '24mm' }} />
          ))}
        </tr>
        <tr>
          {cols.map((x) => (
            <td key={x.role} className="text-center">
              <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{dash(x.name)}</div>
              <div>{x.id || '……………………'}</div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function BeritaAcara({ p }: { p: PHOProject }) {
  const c = p.contractInfo,
    t = p.inspectionTeam;
  const s = projectSummary(p);
  const k = kalimatTanggal(t.inspectionDate);
  const concl = resolveConclusion(p);
  const byCat = CATEGORY_ORDER.map((cat) => {
    const segs = p.segments.filter((x) => x.category === cat);
    const mc = segs.reduce((a, x) => a + x.mc100VolumeM3, 0),
      act = segs.reduce((a, x) => a + x.actualVolumeM3, 0);
    return { cat, n: segs.length, mc, act, pct: mc > 0 ? (act / mc) * 100 : 0 };
  }).filter((x) => x.n > 0);
  const idRows: [string, string][] = [
    ['Nama Paket Pekerjaan', c.packageName],
    ['Nomor / Tanggal Kontrak', `${dash(c.contractNumber)} / ${c.contractDate ? tanggalPanjang(c.contractDate) : '……'}`],
    ['Nilai Kontrak', fmtIdr(c.contractValueIdr)],
    ['Tahun Anggaran', c.fiscalYear],
    ['Nomor Berita Acara MC-100', c.mc100Number],
    ['Daerah Irigasi / Sungai', c.irrigationAreaOrRiverName],
    ['Lokasi', c.locationDistrict],
    ['Penyedia Jasa (Kontraktor Pelaksana)', c.contractorName],
    ['Konsultan Pengawas', c.supervisingConsultantName],
    ['Masa Pemeliharaan', `${c.maintenancePeriodDays} (${terbilang(c.maintenancePeriodDays)}) hari kalender`],
  ];
  return (
    <section className="sheet">
      <Kop p={p} />
      <div className="text-center" style={{ fontWeight: 700, fontSize: '12pt', lineHeight: 1.35 }}>
        <div style={{ textDecoration: 'underline' }}>BERITA ACARA PEMERIKSAAN LAPANGAN</div>
        <div>DALAM RANGKA SERAH TERIMA PERTAMA PEKERJAAN (PHO)</div>
        <div style={{ fontWeight: 400, fontSize: '10.5pt', marginTop: '2pt' }}>Nomor: {dash(t.baNumber)}</div>
      </div>
      <p style={{ marginTop: '12pt', textIndent: '10mm', textAlign: 'justify' }}>
        Pada hari ini, <b>{k.hari}</b> tanggal <b>{k.tanggal}</b> bulan <b>{k.bulan}</b> tahun <b>{k.tahun}</b> ({k.angka}), bertempat di lokasi pekerjaan konstruksi keairan, kami yang bertanda tangan di bawah ini Tim Teknis Pemeriksa / Panitia Pemeriksa Hasil Pekerjaan yang dibentuk berdasarkan Keputusan Pejabat Pembuat Komitmen Nomor <b>{dash(t.skNumber)}</b>, bersama Direksi Teknis, Konsultan Pengawas, dan Penyedia Jasa, telah melaksanakan pemeriksaan fisik bersama uji petik dimensi dan mutu hasil pekerjaan atas:
      </p>
      <table className="plain avoid" style={{ width: '100%', margin: '8pt 0 10pt', fontSize: '10.5pt' }}>
        <tbody>
          {idRows.map(([lbl, val]) => (
            <tr key={lbl}>
              <td style={{ width: '52mm' }}>{lbl}</td>
              <td style={{ width: '3mm' }}>:</td>
              <td style={{ fontWeight: lbl === 'Nama Paket Pekerjaan' || lbl === 'Nilai Kontrak' ? 700 : 400 }}>{dash(val)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontWeight: 700, marginBottom: '3pt' }}>I. Rekapitulasi Hasil Opname Fisik Lapangan</div>
      <table className="t avoid" style={{ fontSize: '10pt', marginBottom: '8pt' }}>
        <thead>
          <tr>
            <th>No</th>
            <th>Kategori Pekerjaan</th>
            <th>Jml STA</th>
            <th>Vol MC-100 (m³)</th>
            <th>Vol Terukur (m³)</th>
            <th>Deviasi (m³)</th>
            <th>Capaian (%)</th>
          </tr>
        </thead>
        <tbody>
          {byCat.map((x, i) => (
            <tr key={x.cat}>
              <td className="text-center">{i + 1}</td>
              <td>{CATEGORIES[x.cat].label}</td>
              <td className="text-center">{x.n}</td>
              <td className="text-right num">{fmt(x.mc, 2)}</td>
              <td className="text-right num">{fmt(x.act, 2)}</td>
              <td className="text-right num">{fmt(x.act - x.mc, 2)}</td>
              <td className="text-right num font-bold">{fmt(x.pct, 2)}%</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 700, background: '#f9fafb' }}>
            <td colSpan={2} className="text-center">TOTAL KESELURUHAN</td>
            <td className="text-center">{s.total}</td>
            <td className="text-right num">{fmt(s.mcVol, 2)}</td>
            <td className="text-right num">{fmt(s.actVol, 2)}</td>
            <td className="text-right num">{fmt(s.actVol - s.mcVol, 2)}</td>
            <td className="text-right num">{fmt(s.achievement, 2)}%</td>
          </tr>
        </tbody>
      </table>
      <div style={{ fontWeight: 700, marginBottom: '3pt' }}>II. Kesimpulan dan Rekomendasi</div>
      <div style={{ border: '1pt solid #000', padding: '6pt 8pt', fontSize: '10.5pt', background: '#fafafa', marginBottom: '8pt' }} className="avoid">
        <div>
          Status Kesimpulan Teknis:{' '}
          <b>
            {concl === 'DAPAT_DITERIMA'
              ? 'DAPAT DITERIMA (LULUS UJI PETIK)'
              : concl === 'DITERIMA_DENGAN_CATATAN'
              ? 'DAPAT DITERIMA DENGAN CATATAN (DEFECT LIST TERLAMPIR)'
              : 'BELUM DAPAT DITERIMA (PERLU PERBAIKAN TOTAL)'}
          </b>
        </div>
        <div style={{ marginTop: '3pt', textAlign: 'justify', fontSize: '9.5pt' }}>
          {concl === 'DAPAT_DITERIMA' && 'Berdasarkan hasil uji petik dimensi geometris dan pengujian visual, seluruh parameter pekerjaan memenuhi kriteria toleransi teknis yang disyaratkan dalam kontrak.'}
          {concl === 'DITERIMA_DENGAN_CATATAN' && `Pekerjaan secara umum dapat diterima secara fungsional, namun Penyedia Jasa diwajibkan menyelesaikan perbaikan atas ${s.defects.length} butir cacat mutu sebagaimana tercantum dalam Lampiran II dalam batas waktu yang ditetapkan.`}
          {concl === 'BELUM_DAPAT_DITERIMA' && 'Terdapat temuan cacat mutu tingkat kritis atau ketidaksesuaian dimensi mendasar yang belum memenuhi persyaratan teknis. Uji petik ulang akan dijadwalkan kembali setelah perbaikan menyeluruh.'}
        </div>
      </div>
      <Signatures p={p} />
    </section>
  );
}

function LampiranHead({ p, no, title }: { p: PHOProject; no: string; title: string }) {
  const c = p.contractInfo,
    t = p.inspectionTeam;
  return (
    <div className="avoid" style={{ marginBottom: '6pt', borderBottom: '1.5pt solid #000', paddingBottom: '4pt' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <div>
          <b>{p.agencyHeader.departmentName || 'DINAS TEKNIS PSDA'}</b> · Paket: <b>{c.packageName}</b>
        </div>
        <div>
          Lampiran BA PHO No: <b>{dash(t.baNumber)}</b>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '10.5pt', marginTop: '2pt' }}>
        {no.toUpperCase()} — {title.toUpperCase()}
      </div>
    </div>
  );
}

function LampiranOpname({ p }: { p: PHOProject }) {
  const tol = p.contractInfo.dimensionToleranceMeter;
  const usedSubtypes = Array.from(new Set(p.segments.map((s) => s.subType)));
  return (
    <section className="sheet landscape">
      <LampiranHead p={p} no="Lampiran I" title="TABEL PENGUKURAN DIMENSI GEOMETRIS DAN PERHITUNGAN VOLUME HASIL OPNAME (MC-100 VS REALISASI)" />
      <table className="t opname">
        <thead>
          <tr>
            <th rowSpan={2} style={{ width: '6mm' }}>No</th>
            <th rowSpan={2} style={{ width: '28mm' }}>STA / Nama Bangunan</th>
            <th rowSpan={2} style={{ width: '26mm' }}>Sub-Tipe Struktur</th>
            <th rowSpan={2} style={{ width: '12mm' }}>Posisi</th>
            <th rowSpan={2} style={{ width: '10mm' }}>P (m)</th>
            <th colSpan={DIM_KEYS.length}>Dimensi Terukur vs Rencana (MC-100)</th>
            <th colSpan={3}>Volume Pekerjaan</th>
            <th rowSpan={2} style={{ width: '18mm' }}>Status Evaluasi</th>
          </tr>
          <tr>
            {DIM_KEYS.map((k) => (
              <th key={k} style={{ width: '11mm' }}>{k}</th>
            ))}
            <th style={{ width: '14mm' }}>MC-100</th>
            <th style={{ width: '14mm' }}>Aktual</th>
            <th style={{ width: '11mm' }}>%</th>
          </tr>
        </thead>
        <tbody>
          {p.segments.map((seg, i) => {
            const st = SUBTYPES[seg.subType];
            const activeKeys = new Set(st.fields.map((f) => f.key));
            return (
              <Fragment key={seg.id}>
                <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
                  <td className="text-center">{i + 1}</td>
                  <td>
                    {seg.staCode}
                    <div style={{ fontWeight: 400, fontSize: '6.5pt' }}>{seg.structureName}</div>
                  </td>
                  <td>{st.label}</td>
                  <td className="text-center">{POSITION_LABEL[seg.positionSide]}</td>
                  <td className="text-right num">{fmt(seg.segmentLengthMeter, 1)}</td>
                  {DIM_KEYS.map((k) => {
                    if (!activeKeys.has(k)) return <td key={k} className="text-center" style={{ color: '#9ca3af' }}>-</td>;
                    const act = seg.averagedActualDimensions[k];
                    const mc = seg.mc100Dimensions[k];
                    const def = isDeficit(act, mc, tol);
                    return (
                      <td key={k} className="text-right num" style={{ color: def ? '#b91c1c' : 'inherit', fontWeight: def ? 700 : 400 }}>
                        {fmtDim(act, st.fields.find((f) => f.key === k)?.kind)}
                        {def ? '*' : ''}
                      </td>
                    );
                  })}
                  <td className="text-right num">{fmt(seg.mc100VolumeM3, 2)}</td>
                  <td className="text-right num">{fmt(seg.actualVolumeM3, 2)}</td>
                  <td className="text-right num">{fmt(seg.volumeAchievementPercent, 1)}%</td>
                  <td className="text-center" style={{ fontSize: '6.5pt' }}>{STATUS_SHORT[seg.evaluationStatus]}</td>
                </tr>
                {seg.samples.map((smp) => (
                  <tr key={smp.id} style={{ color: smp.isSelected ? '#374151' : '#9ca3af' }}>
                    <td></td>
                    <td colSpan={3} style={{ paddingLeft: '8mm' }}>
                      {smp.isSelected ? '✓ ' : '✗ '}
                      {smp.sampleLabel}
                    </td>
                    <td className="text-right num">+{smp.offsetMeter}m</td>
                    {DIM_KEYS.map((k) => {
                      if (!activeKeys.has(k)) return <td key={k} className="text-center">-</td>;
                      const v = smp.dimensions[k];
                      const mc = seg.mc100Dimensions[k];
                      const def = isDeficit(v, mc, tol);
                      return (
                        <td key={k} className="text-right num" style={{ color: def ? '#b91c1c' : 'inherit' }}>
                          {fmtDim(v, st.fields.find((f) => f.key === k)?.kind)}
                        </td>
                      );
                    })}
                    <td className="text-right num" colSpan={3}>
                      A = {fmt(sampleArea(seg, smp), 3)} m²
                    </td>
                    <td></td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="avoid" style={{ fontSize: '7.5pt', marginTop: '5pt', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <b>Keterangan:</b> * = kurang dimensi terhadap MC-100 melampaui toleransi τ = {fmt(tol, 3)} m. Dimensi akhir dihitung sebagai rerata aritmetik titik sampel bertanda [✓]. Capaian = V terukur / V MC-100 × 100%.
        {usedSubtypes.map((id) => {
          const st = SUBTYPES[id];
          return (
            <div key={id}>
              <b>{st.label}:</b> {st.fields.map((f) => `${f.symbol} = ${f.label}`).join('; ')}; L = {st.lengthLabel.replace(/ \(L\)$/, '')}. Rumus: {st.formulaText.join('; ')}.
            </div>
          );
        })}
      </div>
      <Signatures p={p} compact />
    </section>
  );
}

function LampiranDefect({ p }: { p: PHOProject }) {
  const defects = p.segments.flatMap((s) => s.defects.filter((d) => d.entryType === 'CACAT_MUTU').map((d) => ({ d, s })));
  const docs = p.segments.flatMap((s) => s.defects.filter((d) => d.entryType === 'DOKUMENTASI').map((d) => ({ d, s })));
  const checklistRows = p.segments.flatMap((s) => s.visualChecklist.map((c) => ({ s, c })));
  const resLabel = {
    BELUM_DIPERIKSA: 'Belum diperiksa',
    SESUAI: 'Sesuai',
    TIDAK_SESUAI: 'Tidak Sesuai',
    TIDAK_RELEVAN: 'Tidak Relevan',
  } as const;

  return (
    <section className="sheet landscape">
      <LampiranHead p={p} no="Lampiran II" title="DAFTAR CACAT MUTU (DEFECT LIST) DAN DOKUMENTASI VISUAL LAPANGAN" />
      <div style={{ fontWeight: 700, fontSize: '10pt', margin: '4pt 0' }}>A. Daftar Cacat Mutu</div>
      <table className="t defect">
        <thead>
          <tr>
            <th style={{ width: '7mm' }}>No</th>
            <th style={{ width: '34mm' }}>Lokasi STA, Posisi &amp; Koordinat GPS</th>
            <th style={{ width: '72mm' }}>Foto Bukti Ber-Watermark</th>
            <th>Kode &amp; Uraian Temuan Teknis</th>
            <th style={{ width: '15mm' }}>Tingkat</th>
            <th>Instruksi Perbaikan</th>
            <th style={{ width: '22mm' }}>Volume / Luas Terdampak</th>
            <th style={{ width: '20mm' }}>Batas Waktu</th>
            <th style={{ width: '22mm' }}>Paraf Verifikasi Perbaikan</th>
          </tr>
        </thead>
        <tbody>
          {defects.map(({ d, s }, i) => (
            <tr key={d.id}>
              <td className="text-center">{i + 1}</td>
              <td>
                <b>{s.staCode}</b>
                <br />
                {s.structureName}
                <br />
                Posisi: {POSITION_LABEL[d.positionSide]}
                <br />
                GPS: {gpsText(d.gpsCoordinates)}
                <br />
                {stempelWaktu(d.capturedAt)}
              </td>
              <td>
                <PhotoThumbnail
                  photoId={d.watermarkedPhotoId}
                  fallbackDataUrl={d.watermarkedPhotoDataUrl}
                  alt={d.defectCode}
                  style={{ width: '70mm', display: 'block' }}
                  disableLink
                />
              </td>
              <td>
                <b>{d.defectCode} — {d.defectTitle}</b>
                <br />
                {d.technicalFinding}
              </td>
              <td className="text-center">
                <b>{SEVERITY_LABEL[d.severity].toUpperCase()}</b>
              </td>
              <td>{d.repairInstruction}</td>
              <td>{d.affectedVolumeOrArea}</td>
              <td className="text-center">
                {d.dueDays} hari kalender
                <br />
                s.d. {tanggalPanjang(addDays(p.inspectionTeam.inspectionDate, d.dueDays))}
              </td>
              <td>
                <div style={{ fontSize: '7pt' }}>Tgl:</div>
                <div style={{ height: '14mm' }} />
                <div style={{ fontSize: '7pt' }}>Paraf:</div>
              </td>
            </tr>
          ))}
          {!defects.length && (
            <tr>
              <td colSpan={9} className="text-center">
                Tidak terdapat catatan cacat mutu pada pemeriksaan fisik PHO.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ fontWeight: 700, fontSize: '10pt', margin: '10pt 0 4pt' }} className="avoid">
        B. Rekapitulasi Daftar Simak Pemeriksaan Visual &amp; Uji Fungsi
      </div>
      <table className="t defect">
        <thead>
          <tr>
            <th style={{ width: '7mm' }}>No</th>
            <th style={{ width: '40mm' }}>STA / Unit</th>
            <th>Parameter Pemeriksaan</th>
            <th style={{ width: '26mm' }}>Acuan</th>
            <th style={{ width: '24mm' }}>Hasil</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {checklistRows.map(({ s, c }, i) => (
            <tr key={c.id}>
              <td className="text-center">{i + 1}</td>
              <td>{s.staCode}</td>
              <td>{c.parameterName}</td>
              <td>{c.standardRef}</td>
              <td className="text-center" style={{ fontWeight: c.status === 'TIDAK_SESUAI' ? 700 : 400 }}>
                {resLabel[c.status]}
              </td>
              <td>{c.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {docs.length > 0 && (
        <>
          <div style={{ fontWeight: 700, fontSize: '10pt', margin: '10pt 0 4pt' }} className="avoid">
            C. Dokumentasi Visual Lapangan
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4mm' }}>
            {docs.map(({ d, s }) => (
              <figure
                key={d.id}
                className="avoid"
                style={{
                  border: '0.75pt solid #000',
                  padding: '2mm',
                  margin: 0,
                  fontSize: '7.5pt',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                }}
              >
                <PhotoThumbnail
                  photoId={d.watermarkedPhotoId}
                  fallbackDataUrl={d.watermarkedPhotoDataUrl}
                  alt={d.defectCode}
                  style={{ width: '100%', display: 'block' }}
                  disableLink
                />
                <figcaption>
                  <b>{s.staCode}</b> · {POSITION_LABEL[d.positionSide]} · {d.technicalFinding}
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
      <Signatures p={p} compact />
    </section>
  );
}

/** LAPORAN MONITORING EVALUASI (MONEV) BERKALA & KURVA-S */
function LaporanMonevSheet({ p }: { p: PHOProject }) {
  const c = p.contractInfo;
  const periods = p.progressPeriods ?? [];
  const progSummary = computeProgressSummary(periods);
  const timeSummary = computeTimelineSummary(p.timeline, c.contractDate);
  const ncrStats = computeNCRStats(p);

  return (
    <section className="sheet">
      <Kop p={p} />
      <div className="text-center" style={{ fontWeight: 700, fontSize: '12pt', lineHeight: 1.35 }}>
        <div style={{ textDecoration: 'underline' }}>LAPORAN MONITORING DAN EVALUASI PELAKSANAAN PEKERJAAN</div>
        <div style={{ fontSize: '10.5pt', fontWeight: 600 }}>KONTROL JADWAL KURVA-S, PROGRESS FISIK &amp; MUTU</div>
      </div>

      <table className="plain avoid" style={{ width: '100%', margin: '10pt 0', fontSize: '10.5pt' }}>
        <tbody>
          <tr>
            <td style={{ width: '48mm' }}>Paket Pekerjaan</td>
            <td style={{ width: '3mm' }}>:</td>
            <td style={{ fontWeight: 700 }}>{c.packageName}</td>
          </tr>
          <tr>
            <td>Nomor &amp; Tanggal Kontrak</td>
            <td>:</td>
            <td>
              {c.contractNumber} / {tanggalPanjang(c.contractDate)}
            </td>
          </tr>
          <tr>
            <td>Nilai Kontrak Fisik</td>
            <td>:</td>
            <td style={{ fontWeight: 700 }}>{fmtIdr(c.contractValueIdr)}</td>
          </tr>
          <tr>
            <td>Penyedia Jasa &amp; Konsultan</td>
            <td>:</td>
            <td>
              {c.contractorName} / {c.supervisingConsultantName}
            </td>
          </tr>
          <tr>
            <td>Waktu Pelaksanaan Kontrak</td>
            <td>:</td>
            <td>
              {timeSummary.totalDays} Hari Kalender (Terpakai: {timeSummary.elapsedDays} hari / Sisa: {timeSummary.remainingDays} hari)
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontWeight: 700, marginBottom: '3pt', fontSize: '11pt' }}>I. Ringkasan Kinerja Progres &amp; Evaluasi Deviasi</div>
      <table className="t avoid" style={{ fontSize: '10pt', marginBottom: '10pt' }}>
        <thead>
          <tr>
            <th>Parameter Kinerja</th>
            <th>Rencana (%)</th>
            <th>Realisasi (%)</th>
            <th>Deviasi (%)</th>
            <th>Status Evaluasi Kontrak (Permen PUPR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <b>Progres Fisik Konstruksi</b>
            </td>
            <td className="text-right num font-bold">{fmt(progSummary.plannedPhysicalPercent, 2)}%</td>
            <td className="text-right num font-bold">{fmt(progSummary.actualPhysicalPercent, 2)}%</td>
            <td className="text-right num font-bold" style={{ color: progSummary.deviationPercent >= 0 ? '#047857' : '#b91c1c' }}>
              {progSummary.deviationPercent >= 0 ? '+' : ''}
              {fmt(progSummary.deviationPercent, 2)}%
            </td>
            <td>
              <b>{progSummary.statusLabel}</b>
            </td>
          </tr>
          <tr>
            <td>
              <b>Realisasi Penyerapan Keuangan</b>
            </td>
            <td className="text-right num">{fmt(progSummary.plannedFinancialPercent, 2)}%</td>
            <td className="text-right num font-bold">{fmt(progSummary.actualFinancialPercent, 2)}%</td>
            <td className="text-right num">
              {progSummary.financialDeviationPercent >= 0 ? '+' : ''}
              {fmt(progSummary.financialDeviationPercent, 2)}%
            </td>
            <td>Sesuai Termyn Pembayaran</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontWeight: 700, marginBottom: '3pt', fontSize: '11pt' }}>II. Rekapitulasi Progres Periodik (Kurva-S)</div>
      <table className="t avoid" style={{ fontSize: '9pt', marginBottom: '10pt' }}>
        <thead>
          <tr>
            <th>Periode</th>
            <th>Rentang Tanggal</th>
            <th>Rencana (%)</th>
            <th>Realisasi (%)</th>
            <th>Deviasi (%)</th>
            <th>Tenaga Kerja</th>
            <th>Uraian Kegiatan Pokok Lapangan</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((item) => {
            const dev = item.actualPhysicalPercent - item.plannedPhysicalPercent;
            return (
              <tr key={item.id}>
                <td className="font-bold">{item.label}</td>
                <td className="font-mono text-center">
                  {item.startDate} s.d. {item.endDate}
                </td>
                <td className="text-right num">{fmt(item.plannedPhysicalPercent, 2)}%</td>
                <td className="text-right num font-bold">{fmt(item.actualPhysicalPercent, 2)}%</td>
                <td className="text-right num font-bold" style={{ color: dev >= 0 ? '#047857' : '#b91c1c' }}>
                  {dev >= 0 ? '+' : ''}
                  {fmt(dev, 2)}%
                </td>
                <td className="text-center num">{item.workerCount ?? '-'} Org</td>
                <td style={{ fontSize: '8.5pt' }}>{item.notes || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ fontWeight: 700, marginBottom: '3pt', fontSize: '11pt' }}>III. Pengendalian Mutu &amp; Rekapitulasi NCR</div>
      <div style={{ border: '0.75pt solid #000', padding: '6pt 8pt', fontSize: '9.5pt', marginBottom: '10pt' }} className="avoid">
        <div>
          Total Terbitan NCR: <b>{ncrStats.total} Berkas</b> · Status Open: <b>{ncrStats.open} Butir</b> · Selesai Ditutup: <b>{ncrStats.closed} Butir</b>
        </div>
        <div style={{ marginTop: '3pt', fontSize: '9pt' }}>
          {ncrStats.open > 0
            ? `Penyedia Jasa wajib segera menuntaskan tindakan koreksi pada ${ncrStats.open} temuan ketidaksesuaian sebelum pengajuan opname tahap berikutnya.`
            : 'Seluruh temuan ketidaksesuaian mutu telah tuntas diperbaiki dan diverifikasi oleh Direksi Teknis/Konsultan Pengawas.'}
        </div>
      </div>

      <Signatures p={p} />
    </section>
  );
}

/** BERITA ACARA SERAH TERIMA AKHIR (FHO) */
function BeritaAcaraFHOSheet({ p }: { p: PHOProject }) {
  const c = p.contractInfo,
    t = p.inspectionTeam;

  return (
    <section className="sheet">
      <Kop p={p} />
      <div className="text-center" style={{ fontWeight: 700, fontSize: '12pt', lineHeight: 1.35 }}>
        <div style={{ textDecoration: 'underline' }}>BERITA ACARA SERAH TERIMA AKHIR PEKERJAAN</div>
        <div>(FINAL HAND OVER - FHO)</div>
        <div style={{ fontWeight: 400, fontSize: '10.5pt', marginTop: '2pt' }}>
          Nomor: 602.1/BA-FHO/{p.contractInfo.fiscalYear}
        </div>
      </div>

      <p style={{ marginTop: '12pt', textIndent: '10mm', textAlign: 'justify' }}>
        Pada hari ini, tanggal <b>{tanggalPanjang(t.inspectionDate)}</b> bertempat di lokasi pekerjaan, kami yang bertanda tangan di bawah ini Tim Penerima Akhir Hasil Pekerjaan bersama Pejabat Pembuat Komitmen, Konsultan Pengawas, dan Penyedia Jasa telah melakukan pemeriksaan akhir atas masa pemeliharaan paket pekerjaan konstruksi keairan:
      </p>

      <table className="plain avoid" style={{ width: '100%', margin: '10pt 0', fontSize: '10.5pt' }}>
        <tbody>
          <tr>
            <td style={{ width: '48mm' }}>Nama Paket Pekerjaan</td>
            <td style={{ width: '3mm' }}>:</td>
            <td style={{ fontWeight: 700 }}>{c.packageName}</td>
          </tr>
          <tr>
            <td>Nomor &amp; Tanggal Kontrak</td>
            <td>:</td>
            <td>
              {c.contractNumber} / {tanggalPanjang(c.contractDate)}
            </td>
          </tr>
          <tr>
            <td>Berita Acara PHO</td>
            <td>:</td>
            <td>
              {t.baNumber} ({tanggalPanjang(t.inspectionDate)})
            </td>
          </tr>
          <tr>
            <td>Masa Pemeliharaan</td>
            <td>:</td>
            <td>
              {c.maintenancePeriodDays} Hari Kalender
            </td>
          </tr>
          <tr>
            <td>Penyedia Jasa Pelaksana</td>
            <td>:</td>
            <td style={{ fontWeight: 700 }}>{c.contractorName}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontWeight: 700, marginBottom: '4pt' }}>Menyatakan dengan sesungguhnya bahwa:</div>
      <ol style={{ paddingLeft: '6mm', margin: '4pt 0 12pt', textAlign: 'justify', fontSize: '10pt', lineHeight: 1.5 }}>
        <li style={{ marginBottom: '4pt' }}>
          Penyedia Jasa telah menyelesaikan seluruh masa pemeliharaan sesuai ketentuan dokumen kontrak kerja konstruksi selama {c.maintenancePeriodDays} hari kalender.
        </li>
        <li style={{ marginBottom: '4pt' }}>
          Seluruh daftar cacat mutu (Defect List) dan lembar Non-Conformance Report (NCR) yang tercantum pada Berita Acara PHO telah diperbaiki secara tuntas dan berfungsi normal.
        </li>
        <li style={{ marginBottom: '4pt' }}>
          Fisik bangunan irigasi/sungai dan kelengkapannya berada dalam kondisi baik, kokoh, dan siap dimanfaatkan untuk pelayanan masyarakat.
        </li>
        <li>
          Dengan ditandatanganinya Berita Acara ini, maka penyerahan akhir pekerjaan (Final Hand Over) dinyatakan <b>DITERIMA DENGAN LENGKAP DAN BAIK</b>, dan jaminan pemeliharaan dapat dikembalikan sesuai ketentuan perundang-undangan.
        </li>
      </ol>

      <Signatures p={p} />
    </section>
  );
}
