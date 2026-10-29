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
import type { MonevProject } from '../types';
import { DIM_KEYS } from '../types';
import { Btn, cx } from './ui';
import { CATEGORIES, CATEGORY_ORDER, POSITION_LABEL, SUBTYPES, SEVERITY_LABEL } from '../lib/templates';
import { STATUS_SHORT, isDeficit, projectSummary, resolveConclusion } from '../lib/calc';
import { computeNCRStats, computeProgressSummary, computeTimelineSummary } from '../lib/progressCalc';
import { fmt, fmtDim, fmtIdr, kalimatTanggal, tanggalPanjang, terbilang } from '../lib/format';
import { buildOpnameCsv } from '../lib/csv';
import { downloadBlob, safeFileName } from '../lib/storage';
import { PhotoThumbnail } from './PhotoThumbnail';

type ReportDocType = 'monev' | 'pho' | 'fho';

export default function ReportView({
  project: p,
  notify,
}: {
  project: MonevProject;
  notify: (m: string, t?: 'ok' | 'err') => void;
}) {
  const [docType, setDocType] = useState<ReportDocType>('monev');
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

        {/* Tab Selector Dokumen - Urutan Kronologis Kontrak MONEV */}
        <div className="mt-3.5 flex flex-wrap gap-2">
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
            1. Laporan Monev Periodik &amp; Kurva-S
          </button>

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
            2. Berita Acara PHO &amp; Lampiran (Uji Petik)
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
              downloadBlob(buildOpnameCsv(p), `Opname_3Pilar_MC0_MC100_Aktual_${base}.csv`, 'text/csv;charset=utf-8');
              notify('Berkas CSV audit 3-pilar diunduh.');
            }}
            className="w-full"
          >
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Ekspor Back-Up Opname (CSV)
          </Btn>
          <Btn
            variant="secondary"
            onClick={() => {
              downloadBlob(JSON.stringify(p, null, 1), `SIMONEV_${base}.json`, 'application/json');
              notify('Berkas cadangan proyek (.json) diunduh.');
            }}
            className="w-full"
          >
            <FileJson className="h-5 w-5 text-sky-600" />
            Simpan Cadangan (.JSON)
          </Btn>
        </div>
      </div>

      {/* Render Area Dokumen A4 */}
      <div className={cx('print-area flex flex-col items-center gap-6', mobileFit && 'mobile-fit')}>
        {docType === 'monev' && <LaporanMonevSheet p={p} />}

        {docType === 'pho' && (
          <>
            <BeritaAcara p={p} />
            <LampiranOpname p={p} />
            <LampiranDefect p={p} />
          </>
        )}

        {docType === 'fho' && <BeritaAcaraFHOSheet p={p} />}
      </div>
    </div>
  );
}

const dash = (v: string | number | undefined | null) => (v === undefined || v === null || v === '' ? '-' : String(v));

function Kop({ p }: { p: MonevProject }) {
  const h = p.agencyHeader;
  return (
    <div className="avoid" style={{ borderBottom: '2.5pt double #000', paddingBottom: '6pt', marginBottom: '10pt' }}>
      <table className="plain" style={{ width: '100%' }}>
        <tbody>
          <tr>
            {h.logoDataUrl && (
              <td style={{ width: '22mm', textAlign: 'center', verticalAlign: 'middle', paddingRight: '8pt' }}>
                <img src={h.logoDataUrl} alt="Logo" style={{ maxHeight: '20mm', maxWidth: '20mm', objectFit: 'contain' }} />
              </td>
            )}
            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
              <div style={{ fontSize: '12pt', fontWeight: 700, letterSpacing: '0.5pt' }}>
                {h.ministryOrProvince || 'PEMERINTAH DAERAH'}
              </div>
              <div style={{ fontSize: '13pt', fontWeight: 800, letterSpacing: '0.5pt' }}>
                {h.departmentName || 'DINAS PENGELOLAAN SUMBER DAYA AIR'}
              </div>
              <div style={{ fontSize: '8.5pt', fontStyle: 'italic', marginTop: '2pt', color: '#222' }}>
                {h.officeAddress || 'Alamat Kantor Instansi Pelaksana Kegiatan'}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Signatures({ p, compact }: { p: MonevProject; compact?: boolean }) {
  const t = p.inspectionTeam;
  const mt = compact ? '10pt' : '18pt';
  return (
    <div className="avoid" style={{ marginTop: mt, fontSize: compact ? '8.5pt' : '9.5pt', lineHeight: 1.25 }}>
      <div style={{ textAlign: 'center', marginBottom: '8pt', fontWeight: 700 }}>
        Dibuat dan Disahkan Bersama oleh Para Pihak:
      </div>
      <table className="plain" style={{ width: '100%', textAlign: 'center' }}>
        <tbody>
          <tr>
            <td style={{ width: '50%', verticalAlign: 'top', padding: '0 8pt' }}>
              <div style={{ fontWeight: 700 }}>KONSULTAN PENGAWAS</div>
              <div style={{ fontSize: '8.5pt', color: '#444' }}>{p.contractInfo.supervisingConsultantName || '-'}</div>
              <div style={{ height: compact ? '16mm' : '22mm' }} />
              <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{dash(t.consultantRepName)}</div>
              <div>{dash(t.consultantRepTitle || 'Team Leader / Pengawas')}</div>
            </td>
            <td style={{ width: '50%', verticalAlign: 'top', padding: '0 8pt' }}>
              <div style={{ fontWeight: 700 }}>PENYEDIA JASA PELAKSANA</div>
              <div style={{ fontSize: '8.5pt', color: '#444' }}>{p.contractInfo.contractorName || '-'}</div>
              <div style={{ height: compact ? '16mm' : '22mm' }} />
              <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{dash(t.contractorRepName)}</div>
              <div>{dash(t.contractorRepTitle || 'Direktur / Kuasa Direksi')}</div>
            </td>
          </tr>
          <tr>
            <td colSpan={2} style={{ height: compact ? '8pt' : '14pt' }} />
          </tr>
          <tr>
            <td style={{ width: '50%', verticalAlign: 'top', padding: '0 8pt' }}>
              <div style={{ fontWeight: 700 }}>DIREKSI TEKNIS LAPANGAN</div>
              <div style={{ fontSize: '8.5pt', color: '#444' }}>Dinas Pengelolaan Sumber Daya Air</div>
              <div style={{ height: compact ? '16mm' : '22mm' }} />
              <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{dash(t.technicalDirectorName)}</div>
              <div>NIP. {dash(t.technicalDirectorNip)}</div>
            </td>
            <td style={{ width: '50%', verticalAlign: 'top', padding: '0 8pt' }}>
              <div style={{ fontWeight: 700 }}>TIM TEKNIS PEMERIKSA / PPHP</div>
              <div style={{ fontSize: '8.5pt', color: '#444' }}>Ketua Tim Peneliti Fisik</div>
              <div style={{ height: compact ? '16mm' : '22mm' }} />
              <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{dash(t.leadInspectorName)}</div>
              <div>NIP. {dash(t.leadInspectorNip)}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BeritaAcara({ p }: { p: MonevProject }) {
  const c = p.contractInfo,
    t = p.inspectionTeam;
  const k = kalimatTanggal(t.inspectionDate);
  const s = projectSummary(p);
  const concl = resolveConclusion(p);

  const idRows: [string, string][] = [
    ['Nama Paket Pekerjaan', c.packageName],
    ['Nomor Kontrak', c.contractNumber],
    ['Tanggal Kontrak', tanggalPanjang(c.contractDate)],
    ['Nomor Berita Acara MC-0', c.mc0Number ?? '-'],
    ['Nomor Berita Acara MC-100', c.mc100Number],
    ['Nilai Kontrak', `${fmtIdr(c.contractValueIdr)} (${terbilang(c.contractValueIdr)})`],
    ['Tahun Anggaran', c.fiscalYear],
    ['Daerah Irigasi / Sungai', c.irrigationAreaOrRiverName],
    ['Lokasi Pekerjaan', c.locationDistrict],
    ['Penyedia Jasa (Kontraktor)', c.contractorName],
    ['Konsultan Pengawas', c.supervisingConsultantName],
    ['Masa Pemeliharaan', `${c.maintenancePeriodDays} hari kalender terhitung sejak penandatanganan BA PHO`],
  ];

  const byCat = CATEGORY_ORDER.map((cat) => {
    const segs = p.segments.filter((x) => x.category === cat);
    const mc = segs.reduce((a, x) => a + x.mc100VolumeM3, 0),
      act = segs.reduce((a, x) => a + x.actualVolumeM3, 0);
    return { cat, n: segs.length, mc, act, pct: mc > 0 ? (act / mc) * 100 : 0 };
  }).filter((x) => x.n > 0);

  return (
    <section className="sheet">
      <Kop p={p} />
      <div className="text-center" style={{ fontWeight: 700, fontSize: '12pt', lineHeight: 1.35 }}>
        <div style={{ textDecoration: 'underline' }}>BERITA ACARA PEMERIKSAAN BERSAMA DAN HASIL OPNAME LAPANGAN</div>
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

function LampiranHead({ p, no, title }: { p: MonevProject; no: string; title: string }) {
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

function LampiranOpname({ p }: { p: MonevProject }) {
  const tol = p.contractInfo.dimensionToleranceMeter;
  return (
    <section className="sheet landscape">
      <LampiranHead p={p} no="Lampiran I" title="TABEL PENGUKURAN DIMENSI GEOMETRIS DAN PERHITUNGAN VOLUME HASIL OPNAME (MC-100 VS REALISASI)" />
      <p style={{ fontSize: '8.5pt', margin: '2pt 0 6pt', textAlign: 'justify' }}>
        Toleransi deviasi dimensi yang diizinkan mengacu Standar Perencanaan Irigasi KP-PU: <b>τ = {fmt(tol, 3)} m</b>. Titik sampel dengan deviasi negatif melebihi toleransi (Δp &lt; −τ) dinyatakan Kurang Dimensi Lokal. Volume akhir mengacu pada rerata aritmetik titik sampel uji petik yang diverifikasi.
      </p>

      <table className="t dense">
        <thead>
          <tr>
            <th rowSpan={2} style={{ width: '6mm' }}>No</th>
            <th rowSpan={2} style={{ width: '28mm' }}>Kode STA</th>
            <th rowSpan={2} style={{ width: '38mm' }}>Nama Ruas / Bangunan</th>
            <th rowSpan={2} style={{ width: '12mm' }}>Panjang (m)</th>
            <th rowSpan={2} style={{ width: '24mm' }}>Titik Sampel</th>
            <th colSpan={DIM_KEYS.length}>Dimensi Terukur vs Desain MC-100 (m)</th>
            <th rowSpan={2} style={{ width: '14mm' }}>Vol MC-0 (m³)</th>
            <th rowSpan={2} style={{ width: '15mm' }}>Vol MC-100 (m³)</th>
            <th rowSpan={2} style={{ width: '15mm' }}>Vol Aktual (m³)</th>
            <th rowSpan={2} style={{ width: '14mm' }}>Deviasi (m³)</th>
            <th rowSpan={2} style={{ width: '20mm' }}>Status Evaluasi</th>
          </tr>
          <tr>
            {DIM_KEYS.map((k) => (
              <th key={k} style={{ width: '11mm' }}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.segments.map((seg, i) => {
            const st = SUBTYPES[seg.subType];
            const activeKeys = new Set(st.fields.map((f) => f.key));
            const rowSpan = seg.samples.length + 1;
            return (
              <Fragment key={seg.id}>
                {seg.samples.map((smp, sIdx) => (
                  <tr key={smp.id} className={!smp.isSelected ? 'strike' : undefined}>
                    {sIdx === 0 && (
                      <>
                        <td rowSpan={rowSpan} className="text-center">{i + 1}</td>
                        <td rowSpan={rowSpan} style={{ fontWeight: 700 }}>{seg.staCode}</td>
                        <td rowSpan={rowSpan} style={{ fontSize: '7.5pt' }}>
                          <div>{seg.structureName || '-'}</div>
                          <div style={{ color: '#555', fontStyle: 'italic' }}>{st.shortLabel}</div>
                        </td>
                        <td rowSpan={rowSpan} className="text-right num">{fmt(seg.segmentLengthMeter, 1)}</td>
                      </>
                    )}
                    <td style={{ fontSize: '7.5pt' }}>
                      {smp.sampleLabel.split(' - ')[1] || smp.sampleLabel}
                      {!smp.isSelected && ' (diabaikan)'}
                    </td>
                    {DIM_KEYS.map((k) => {
                      if (!activeKeys.has(k)) return <td key={k} style={{ background: '#f3f4f6' }} />;
                      const a = smp.dimensions[k];
                      const mc = seg.mc100Dimensions[k];
                      const def = isDeficit(a, mc, tol);
                      return (
                        <td key={k} className="text-right num" style={{ color: def ? '#b91c1c' : undefined, fontWeight: def ? 700 : 400 }}>
                          {fmtDim(a)}
                        </td>
                      );
                    })}
                    {sIdx === 0 && (
                      <>
                        <td rowSpan={rowSpan} className="text-right num">{fmt(seg.mc0VolumeM3, 2)}</td>
                        <td rowSpan={rowSpan} className="text-right num font-semibold">{fmt(seg.mc100VolumeM3, 2)}</td>
                        <td rowSpan={rowSpan} className="text-right num font-bold">{fmt(seg.actualVolumeM3, 2)}</td>
                        <td rowSpan={rowSpan} className="text-right num font-bold" style={{ color: seg.volumeDeviationM3 < 0 ? '#b91c1c' : '#047857' }}>
                          {seg.volumeDeviationM3 > 0 ? '+' : ''}{fmt(seg.volumeDeviationM3, 2)}
                        </td>
                        <td rowSpan={rowSpan} className="text-center" style={{ fontSize: '7.5pt', fontWeight: 700 }}>
                          {STATUS_SHORT[seg.evaluationStatus]}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                <tr style={{ background: '#f9fafb', fontWeight: 700 }}>
                  <td style={{ fontSize: '7.5pt', color: '#000' }}>RERATA HASIL UKUR</td>
                  {DIM_KEYS.map((k) => {
                    if (!activeKeys.has(k)) return <td key={k} style={{ background: '#f3f4f6' }} />;
                    const a = seg.averagedActualDimensions[k];
                    const mc = seg.mc100Dimensions[k];
                    const def = isDeficit(a, mc, tol);
                    return (
                      <td key={k} className="text-right num" style={{ color: def ? '#b91c1c' : '#000' }}>
                        {fmtDim(a)}
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <Signatures p={p} compact />
    </section>
  );
}

function LampiranDefect({ p }: { p: MonevProject }) {
  const defects = p.segments.flatMap((s) => s.defects.filter((d) => d.entryType === 'CACAT_MUTU').map((d) => ({ d, s })));
  const docs = p.segments.flatMap((s) => s.defects.filter((d) => d.entryType === 'DOKUMENTASI').map((d) => ({ d, s })));
  const checklistRows = p.segments.flatMap((s) => s.visualChecklist.map((c) => ({ s, c })));
  const resLabel: Record<string, string> = {
    SESUAI: 'Sesuai',
    TIDAK_SESUAI: 'Tidak Sesuai',
    TIDAK_RELEVAN: 'N/A',
    BELUM_DIPERIKSA: 'Belum',
  };

  return (
    <section className="sheet">
      <LampiranHead p={p} no="Lampiran II" title="DAFTAR TEMUAN CACAT MUTU (DEFECT LIST), DAFTAR SIMAK, DAN FOTO INSPEKSI" />
      <div style={{ fontWeight: 700, fontSize: '10pt', marginBottom: '4pt' }} className="avoid">
        A. Rekapitulasi Cacat Mutu Konstruksi (Wajib Diperbaiki dalam Masa Pemeliharaan)
      </div>
      <table className="t defect">
        <thead>
          <tr>
            <th style={{ width: '7mm' }}>No</th>
            <th style={{ width: '18mm' }}>Kode</th>
            <th style={{ width: '30mm' }}>Lokasi STA</th>
            <th>Uraian Kerusakan / Cacat Mutu</th>
            <th style={{ width: '18mm' }}>Tingkat</th>
            <th>Instruksi Penanganan / Rekomendasi</th>
            <th style={{ width: '15mm' }}>Batas</th>
          </tr>
        </thead>
        <tbody>
          {defects.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center" style={{ fontStyle: 'italic', padding: '12pt' }}>
                Tidak terdapat catatan cacat mutu pada pemeriksaan fisik PHO.
              </td>
            </tr>
          ) : (
            defects.map(({ d, s }, i) => (
              <tr key={d.id}>
                <td className="text-center">{i + 1}</td>
                <td className="font-mono text-center font-bold">{d.defectCode}</td>
                <td>
                  <div>{s.staCode}</div>
                  <div style={{ fontSize: '7.5pt', color: '#555' }}>{POSITION_LABEL[d.positionSide]}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 700 }}>{d.defectTitle}</div>
                  <div style={{ fontSize: '8pt', color: '#333' }}>{d.technicalFinding}</div>
                </td>
                <td className="text-center font-bold">{SEVERITY_LABEL[d.severity]}</td>
                <td style={{ fontSize: '8pt' }}>{d.repairInstruction}</td>
                <td className="text-center num">{d.dueDays} hr</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {defects.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4mm', marginTop: '6pt' }}>
          {defects.map(({ d, s }) => (
            <figure
              key={d.id}
              className="avoid"
              style={{
                border: '0.75pt solid #000',
                padding: '2.5mm',
                margin: 0,
                fontSize: '8pt',
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
              <figcaption style={{ marginTop: '2mm', lineHeight: 1.25 }}>
                <b>
                  {d.defectCode} · {d.defectTitle}
                </b>{' '}
                [{SEVERITY_LABEL[d.severity]}]
                <br />
                {s.staCode} · {POSITION_LABEL[d.positionSide]} · {d.affectedVolumeOrArea}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

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
function LaporanMonevSheet({ p }: { p: MonevProject }) {
  const c = p.contractInfo;
  const periods = p.progressPeriods ?? [];
  const progSummary = computeProgressSummary(periods);
  const timeSummary = computeTimelineSummary(p.timeline, c.contractDate);
  const ncrStats = computeNCRStats(p);
  const sum = projectSummary(p);

  return (
    <section className="sheet">
      <Kop p={p} />
      <div className="text-center" style={{ fontWeight: 700, fontSize: '12pt', lineHeight: 1.35 }}>
        <div style={{ textDecoration: 'underline' }}>LAPORAN MONITORING DAN EVALUASI PELAKSANAAN PEKERJAAN</div>
        <div style={{ fontSize: '10.5pt', fontWeight: 600 }}>KONTROL JADWAL KURVA-S, PROGRESS FISIK &amp; REKAYASA MUTU</div>
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
            <td>Berita Acara MC-0 &amp; MC-100</td>
            <td>:</td>
            <td>
              MC-0: {c.mc0Number || '-'} ({c.mc0Date ? tanggalPanjang(c.mc0Date) : '-'}) · MC-100: {c.mc100Number}
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

      <div style={{ fontWeight: 700, marginBottom: '3pt', fontSize: '11pt' }}>II. Rekapitulasi Komparasi Volume 3-Pilar (MC-0 vs MC-100 vs Aktual)</div>
      <table className="t avoid" style={{ fontSize: '9pt', marginBottom: '10pt' }}>
        <thead>
          <tr>
            <th>No</th>
            <th>STA / Ruas Bangunan</th>
            <th>Sub-Tipe</th>
            <th>Vol MC-0 (m³)</th>
            <th>Vol MC-100 (m³)</th>
            <th>Variasi CCO</th>
            <th>Vol Aktual (m³)</th>
            <th>Capaian (%)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {p.segments.map((seg, idx) => {
            const cco = seg.volumeCcoVariancePercent ?? 0;
            return (
              <tr key={seg.id}>
                <td className="text-center">{idx + 1}</td>
                <td className="font-bold">{seg.staCode}</td>
                <td>{SUBTYPES[seg.subType].shortLabel}</td>
                <td className="text-right num">{fmt(seg.mc0VolumeM3, 2)}</td>
                <td className="text-right num font-semibold">{fmt(seg.mc100VolumeM3, 2)}</td>
                <td className="text-right num" style={{ color: cco > 0 ? '#6b21a8' : cco < 0 ? '#b45309' : undefined }}>
                  {cco > 0 ? '+' : ''}{fmt(cco, 1)}%
                </td>
                <td className="text-right num font-bold">{fmt(seg.actualVolumeM3, 2)}</td>
                <td className="text-right num">{fmt(seg.volumeAchievementPercent, 1)}%</td>
                <td className="text-center" style={{ fontSize: '8pt', fontWeight: 700 }}>
                  {STATUS_SHORT[seg.evaluationStatus]}
                </td>
              </tr>
            );
          })}
          <tr style={{ background: '#f9fafb', fontWeight: 700 }}>
            <td colSpan={3} className="text-center">TOTAL KESELURUHAN</td>
            <td className="text-right num">{fmt(sum.mc0Vol, 2)}</td>
            <td className="text-right num">{fmt(sum.mcVol, 2)}</td>
            <td className="text-right num" style={{ color: sum.ccoVariancePercent > 0 ? '#6b21a8' : '#b45309' }}>
              {sum.ccoVariancePercent >= 0 ? '+' : ''}{fmt(sum.ccoVariancePercent, 1)}%
            </td>
            <td className="text-right num">{fmt(sum.actVol, 2)}</td>
            <td className="text-right num">{fmt(sum.achievement, 1)}%</td>
            <td className="text-center">{sum.pass}/{sum.total} Memenuhi</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontWeight: 700, marginBottom: '3pt', fontSize: '11pt' }}>III. Rekapitulasi Progres Periodik (Kurva-S)</div>
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

      <div style={{ fontWeight: 700, marginBottom: '3pt', fontSize: '11pt' }}>IV. Pengendalian Mutu &amp; Rekapitulasi NCR</div>
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
function BeritaAcaraFHOSheet({ p }: { p: MonevProject }) {
  const c = p.contractInfo,
    t = p.inspectionTeam,
    f = p.fhoInfo;

  const fhoBaNo = f?.baFhoNumber || `602.1/BA-FHO/${p.contractInfo.fiscalYear}`;
  const fhoDateStr = f?.baFhoDate || p.timeline?.fhoTargetDate || t.inspectionDate;

  return (
    <section className="sheet">
      <Kop p={p} />
      <div className="text-center" style={{ fontWeight: 700, fontSize: '12pt', lineHeight: 1.35 }}>
        <div style={{ textDecoration: 'underline' }}>BERITA ACARA SERAH TERIMA AKHIR PEKERJAAN</div>
        <div>(FINAL HAND OVER - FHO)</div>
        <div style={{ fontWeight: 400, fontSize: '10.5pt', marginTop: '2pt' }}>
          Nomor: {fhoBaNo}
        </div>
      </div>

      <p style={{ marginTop: '12pt', textIndent: '10mm', textAlign: 'justify' }}>
        Pada hari ini, tanggal <b>{tanggalPanjang(fhoDateStr)}</b> bertempat di lokasi pekerjaan, kami yang bertanda tangan di bawah ini Tim Penerima Akhir Hasil Pekerjaan bersama Pejabat Pembuat Komitmen, Konsultan Pengawas, dan Penyedia Jasa telah melakukan pemeriksaan akhir atas masa pemeliharaan paket pekerjaan konstruksi keairan:
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
          Seluruh daftar cacat mutu (Defect List) dan lembar Non-Conformance Report (NCR) yang tercantum pada Berita Acara PHO telah diperbaiki secara tuntas dan diverifikasi berfungsi normal.
        </li>
        <li style={{ marginBottom: '4pt' }}>
          Fisik bangunan air dan kelengkapannya berada dalam kondisi prima, kokoh, dan siap dimanfaatkan secara berkelanjutan.
        </li>
        <li>
          Dengan ditandatanganinya Berita Acara ini, maka penyerahan akhir pekerjaan (Final Hand Over) dinyatakan <b>DITERIMA DENGAN LENGKAP DAN BAIK</b>, dan jaminan pemeliharaan dapat dikembalikan sesuai ketentuan perundang-undangan.
        </li>
      </ol>

      <div style={{ border: '0.75pt solid #000', padding: '6pt 8pt', fontSize: '9.5pt', marginBottom: '10pt' }} className="avoid">
        <div style={{ fontWeight: 700 }}>Catatan Verifikasi Tim Teknis Pemeliharaan:</div>
        <div style={{ fontSize: '9pt', marginTop: '2pt' }}>
          {f?.closureNotes || 'Pemeriksaan lapangan membuktikan seluruh fungsi bangunan air, debit aliran, dan stabilitas dinding pasangan batu bekerja 100% normal tanpa kebocoran.'}
        </div>
      </div>

      <Signatures p={p} />
    </section>
  );
}
