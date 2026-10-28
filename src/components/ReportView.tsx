import { Fragment, useState } from 'react';
import { FileJson, FileSpreadsheet, Printer, Maximize2, ZoomIn, Eye } from 'lucide-react';
import type { InspectionSegment, PHOProject, StructureCategory } from '../types';
import { DIM_KEYS } from '../types';
import { Btn, cx } from './ui';
import { CATEGORIES, CATEGORY_ORDER, POSITION_LABEL, SUBTYPES, SEVERITY_LABEL } from '../lib/templates';
import { STATUS_SHORT, isDeficit, projectSummary, resolveConclusion, sampleArea } from '../lib/calc';
import { addDays, fmt, fmtDim, fmtIdr, kalimatTanggal, stempelWaktu, tanggalPanjang, terbilang } from '../lib/format';
import { buildOpnameCsv } from '../lib/csv';
import { downloadBlob, safeFileName } from '../lib/storage';
import { gpsText } from '../lib/inspection';
import { PhotoThumbnail } from './PhotoThumbnail';

export default function ReportView({ project: p, notify }: { project: PHOProject; notify: (m: string, t?: 'ok' | 'err') => void }) {
  const base = `${safeFileName(p.contractInfo.packageName)}_${p.inspectionTeam.inspectionDate}`;
  const [mobileFit, setMobileFit] = useState(false);

  return (
    <div className="space-y-4">
      <div className="no-print rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h1 className="text-base font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Eye className="h-5 w-5 text-amber-500" />
              Pratinjau Dokumen Berita Acara &amp; Lampiran PHO
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Format standar dinas pekerjaan umum (A4 fisik). Bagian I Potret, Lampiran I &amp; II Lanskap.
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
            Simpan Proyek (.JSON)
          </Btn>
        </div>
        <p className="mt-3 text-[11px] font-medium text-slate-500">
          💡 Tips pencetakan: Pada dialog cetak peramban pilih ukuran kertas A4, margin "Sesuai default / None", dan pastikan opsi "Grafik latar belakang (Background graphics)" aktif.
        </p>
      </div>

      <div className={cx('print-wrap overflow-x-auto pb-8', mobileFit && 'overflow-x-hidden flex justify-center')}>
        <div
          className={cx(
            'doc print-root screen-scale transition-all duration-200',
            mobileFit ? 'origin-top scale-[0.44] sm:scale-[0.62] md:scale-[0.80]' : 'min-w-max',
          )}
        >
          <BeritaAcara p={p} />
          <LampiranOpname p={p} />
          <LampiranDefect p={p} />
        </div>
      </div>
    </div>
  );
}

function Kop({ p }: { p: PHOProject }) {
  const a = p.agencyHeader;
  return (
    <div className="kop mb-4 flex items-center gap-4 pb-2">
      {a.logoDataUrl ? <img src={a.logoDataUrl} alt="" style={{ height: '22mm', width: '22mm', objectFit: 'contain' }} /> : <div style={{ width: '22mm' }} />}
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
  const t = p.inspectionTeam, c = p.contractInfo;
  const cols = [
    { role: 'Tim Teknis / PPHP', org: 'Ketua', name: t.leadInspectorName, id: t.leadInspectorNip ? `NIP. ${t.leadInspectorNip}` : 'NIP. ……………………' },
    { role: 'Direksi Teknis', org: '', name: t.technicalDirectorName, id: t.technicalDirectorNip ? `NIP. ${t.technicalDirectorNip}` : 'NIP. ……………………' },
    { role: 'Konsultan Pengawas', org: c.supervisingConsultantName, name: t.consultantRepName, id: t.consultantRepTitle },
    { role: 'Kontraktor Pelaksana', org: c.contractorName, name: t.contractorRepName, id: t.contractorRepTitle },
  ];
  return (
    <table className="t avoid" style={{ marginTop: compact ? '6pt' : '14pt', fontSize: compact ? '8pt' : '10pt' }}>
      <tbody>
        <tr>{cols.map((x) => <td key={x.role} className="text-center" style={{ width: '25%', fontWeight: 700 }}>{x.role}{x.org ? <div style={{ fontWeight: 400 }}>{x.org}</div> : null}</td>)}</tr>
        <tr>{cols.map((x) => <td key={x.role} style={{ height: compact ? '16mm' : '24mm' }} />)}</tr>
        <tr>{cols.map((x) => <td key={x.role} className="text-center"><div style={{ fontWeight: 700, textDecoration: 'underline' }}>{dash(x.name)}</div><div>{x.id || '……………………'}</div></td>)}</tr>
      </tbody>
    </table>
  );
}

function BeritaAcara({ p }: { p: PHOProject }) {
  const c = p.contractInfo, t = p.inspectionTeam;
  const s = projectSummary(p);
  const k = kalimatTanggal(t.inspectionDate);
  const concl = resolveConclusion(p);
  const byCat = CATEGORY_ORDER.map((cat) => {
    const segs = p.segments.filter((x) => x.category === cat);
    const mc = segs.reduce((a, x) => a + x.mc100VolumeM3, 0), act = segs.reduce((a, x) => a + x.actualVolumeM3, 0);
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
        <div style={{ fontWeight: 400, fontSize: '11pt' }}>Nomor: {dash(t.baNumber)}</div>
      </div>
      <p style={{ marginTop: '10pt', textAlign: 'justify' }}>
        Pada hari ini <b>{k.hari}</b> tanggal <b>{k.tanggal}</b> bulan <b>{k.bulan}</b> tahun <b>{k.tahun}</b> ({k.angka}), bertempat di lokasi pekerjaan {dash(c.irrigationAreaOrRiverName)}, {dash(c.locationDistrict)}, kami yang bertanda tangan di bawah ini, Tim Teknis / Panitia Pemeriksa Hasil Pekerjaan (PPHP) yang ditetapkan berdasarkan Surat Keputusan Nomor {dash(t.skNumber)}, bersama-sama dengan Direksi Teknis, Konsultan Pengawas, dan Kontraktor Pelaksana, telah melaksanakan pemeriksaan lapangan atas hasil pekerjaan sebagai berikut:
      </p>
      <table className="plain" style={{ margin: '6pt 0 6pt 12pt' }}>
        <tbody>
          {idRows.map(([a, b]) => (
            <tr key={a}><td style={{ width: '62mm' }}>{a}</td><td style={{ width: '4mm' }}>:</td><td>{dash(b)}</td></tr>
          ))}
        </tbody>
      </table>
      <p style={{ textAlign: 'justify' }}>
        Pemeriksaan dilaksanakan dengan metode pengukuran dimensi fisik terpasang (opname) pada setiap STA / unit bangunan dan pemeriksaan visual serta uji fungsi lapangan, mengacu pada Kriteria Perencanaan Ditjen SDA (KP-02, KP-03, KP-04, KP-05, KP-07), SNI 1724:2015, dan SNI 2406, dengan batas toleransi deviasi dimensi {fmt(c.dimensionToleranceMeter * 100, 1)} cm. Pada STA dengan indikasi kurang dimensi dilakukan pengambilan titik sampel tambahan (uji petik) dan dimensi akhir ditetapkan dari rerata titik sampel terpilih yang disepakati para pihak. Hasil pemeriksaan sebagai berikut:
      </p>
      <table className="t avoid" style={{ marginTop: '6pt', fontSize: '10pt' }}>
        <thead>
          <tr><th style={{ width: '8mm' }}>No</th><th>Uraian</th><th style={{ width: '24mm' }}>Jumlah STA</th><th style={{ width: '28mm' }}>Volume MC-100 (m³)</th><th style={{ width: '28mm' }}>Volume Terukur (m³)</th><th style={{ width: '20mm' }}>Capaian (%)</th></tr>
        </thead>
        <tbody>
          {byCat.map((x, i) => (
            <tr key={x.cat}><td className="text-center">{i + 1}</td><td>{CATEGORIES[x.cat as StructureCategory].label}</td><td className="text-center">{x.n}</td><td className="text-right num">{fmt(x.mc, 3)}</td><td className="text-right num">{fmt(x.act, 3)}</td><td className="text-right num">{fmt(x.pct, 2)}</td></tr>
          ))}
          <tr style={{ fontWeight: 700 }}><td colSpan={2} className="text-center">JUMLAH</td><td className="text-center">{s.total}</td><td className="text-right num">{fmt(s.mcVol, 3)}</td><td className="text-right num">{fmt(s.actVol, 3)}</td><td className="text-right num">{fmt(s.achievement, 2)}</td></tr>
        </tbody>
      </table>
      <table className="t avoid" style={{ marginTop: '6pt', fontSize: '10pt' }}>
        <tbody>
          <tr><td style={{ width: '70%' }}>Jumlah segmen / STA diperiksa (terukur / total)</td><td className="text-center num">{s.measured} / {s.total}</td></tr>
          <tr><td>Selisih volume terukur terhadap MC-100</td><td className="text-center num">{s.actVol - s.mcVol > 0 ? '+' : ''}{fmt(s.actVol - s.mcVol, 3)} m³</td></tr>
          <tr><td>Segmen memenuhi syarat dimensi dan visual</td><td className="text-center num">{s.pass}</td></tr>
          <tr><td>Segmen dengan catatan perbaikan (Defect List / kurang dimensi)</td><td className="text-center num">{s.fail}</td></tr>
          <tr><td>Jumlah cacat mutu tercatat (Kritis / Mayor / Minor)</td><td className="text-center num">{s.defects.length} ({s.kritis} / {s.mayor} / {s.minor})</td></tr>
        </tbody>
      </table>
      <p style={{ marginTop: '8pt', textAlign: 'justify' }}>
        Berdasarkan hasil pemeriksaan tersebut di atas, hasil pekerjaan dinyatakan{' '}
        {concl === 'DAPAT_DITERIMA' && <>telah sesuai dengan ketentuan kontrak dan <b>DAPAT DITERIMA</b> untuk dilaksanakan Serah Terima Pertama Pekerjaan (PHO). Kontraktor Pelaksana berkewajiban melaksanakan pemeliharaan selama masa pemeliharaan {c.maintenancePeriodDays} hari kalender.</>}
        {concl === 'DITERIMA_DENGAN_CATATAN' && <><b>DAPAT DITERIMA DENGAN CATATAN</b> untuk dilaksanakan Serah Terima Pertama Pekerjaan (PHO). Kontraktor Pelaksana wajib menyelesaikan seluruh perbaikan sebagaimana tercantum dalam Lampiran II (Daftar Cacat Mutu) sesuai batas waktu yang ditetapkan dan dalam masa pemeliharaan {c.maintenancePeriodDays} hari kalender. Selisih volume terhadap MC-100 sebagaimana tercantum dalam Lampiran I diperhitungkan berdasarkan volume terpasang.</>}
        {concl === 'BELUM_DAPAT_DITERIMA' && <><b>BELUM DAPAT DITERIMA</b> untuk dilaksanakan Serah Terima Pertama Pekerjaan (PHO). Kontraktor Pelaksana wajib menyelesaikan perbaikan sebagaimana tercantum dalam Lampiran II (Daftar Cacat Mutu) serta pemenuhan dimensi sebagaimana tercantum dalam Lampiran I, dan selanjutnya dilakukan pemeriksaan ulang.</>}
      </p>
      <p style={{ textAlign: 'justify' }}>Lampiran I (Tabel Rekapitulasi Opname Dimensi dan Perhitungan Volume) dan Lampiran II (Daftar Cacat Mutu dan Dokumentasi Visual Lapangan) merupakan bagian yang tidak terpisahkan dari Berita Acara ini.</p>
      <p style={{ textAlign: 'justify' }}>Demikian Berita Acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.</p>
      <Signatures p={p} />
    </section>
  );
}

function LampiranHead({ p, no, title }: { p: PHOProject; no: string; title: string }) {
  return (
    <div style={{ marginBottom: '6pt' }}>
      <table className="plain" style={{ fontSize: '9pt', marginLeft: 'auto' }}>
        <tbody>
          <tr><td>{no} Berita Acara Nomor</td><td>:</td><td>{dash(p.inspectionTeam.baNumber)}</td></tr>
          <tr><td>Tanggal</td><td>:</td><td>{tanggalPanjang(p.inspectionTeam.inspectionDate)}</td></tr>
        </tbody>
      </table>
      <div className="text-center" style={{ fontWeight: 700, fontSize: '11pt', marginTop: '4pt' }}>{title}</div>
      <div className="text-center" style={{ fontSize: '9.5pt' }}>Paket: {dash(p.contractInfo.packageName)} · Kontrak No. {dash(p.contractInfo.contractNumber)} · MC-100 No. {dash(p.contractInfo.mc100Number)}</div>
    </div>
  );
}

const DIM_HEAD: Record<string, string> = { b: 'b', B: 'B', H: 'H', m: 'm', ta: 'ta', tb: 'tb', td: 'td', wallSides: 'n', unitCount: 'N' };

function LampiranOpname({ p }: { p: PHOProject }) {
  const tol = p.contractInfo.dimensionToleranceMeter;
  const s = projectSummary(p);
  const usedSubtypes = [...new Set(p.segments.map((x) => x.subType))];
  const cell = (seg: InspectionSegment, k: (typeof DIM_KEYS)[number], v: number | undefined, mark: boolean) => {
    const f = SUBTYPES[seg.subType].fields.find((x) => x.key === k);
    if (!f) return <td key={k} className="text-center">—</td>;
    const def = mark && f.kind !== 'ratio' && isDeficit(v, seg.mc100Dimensions[k], f.kind === 'count' ? 0 : tol);
    return <td key={k} className="text-right num" style={def ? { fontWeight: 700, textDecoration: 'underline' } : undefined}>{fmtDim(v, f.kind)}{def ? '*' : ''}</td>;
  };
  return (
    <section className="sheet landscape">
      <LampiranHead p={p} no="Lampiran I" title="TABEL REKAPITULASI OPNAME DIMENSI DAN PERHITUNGAN VOLUME (MC-100 VS REALISASI LAPANGAN)" />
      <table className="t opname">
        <thead>
          <tr>
            <th rowSpan={2}>No</th><th rowSpan={2}>STA / Unit &amp; Posisi</th><th rowSpan={2}>Uraian Bangunan / Tipe &amp; Acuan</th><th rowSpan={2}>Data Ukur</th><th rowSpan={2}>Offset (m)</th><th rowSpan={2}>L</th>
            <th colSpan={DIM_KEYS.length}>Dimensi (m)</th>
            <th rowSpan={2}>A (m²)</th><th rowSpan={2}>V (m³)</th><th rowSpan={2}>ΔV (m³)</th><th rowSpan={2}>Capaian (%)</th><th rowSpan={2}>Status</th>
          </tr>
          <tr>{DIM_KEYS.map((k) => <th key={k}>{DIM_HEAD[k]}</th>)}</tr>
        </thead>
        <tbody>
          {p.segments.map((seg, i) => {
            const st = SUBTYPES[seg.subType];
            const rows = 2 + seg.samples.length;
            const selCount = seg.samples.filter((x) => x.isSelected).length;
            return (
              <Fragment key={seg.id}>
                <tr>
                  <td rowSpan={rows} className="text-center">{i + 1}</td>
                  <td rowSpan={rows}><b>{seg.staCode}</b><br />{POSITION_LABEL[seg.positionSide]}<br /><i>{seg.dataSource === 'IMPORT_MC100' ? 'Impor MC-100' : 'Input Lapangan'}</i></td>
                  <td rowSpan={rows} style={{ maxWidth: '48mm' }}>{seg.structureName}<br /><i>{st.label}</i><br />Acuan: {CATEGORIES[seg.category].reference}{seg.inspectorNotes ? <><br />Catatan: {seg.inspectorNotes}</> : null}</td>
                  <td style={{ fontWeight: 700 }}>MC-100</td>
                  <td className="text-center">—</td>
                  <td className="text-right num">{fmt(seg.segmentLengthMeter, 2)}{st.lengthUnit !== 'm' ? ` ${st.lengthUnit}` : ''}</td>
                  {DIM_KEYS.map((k) => cell(seg, k, seg.mc100Dimensions[k], false))}
                  <td className="text-right num">{fmt(seg.mc100CrossSectionAreaM2, 3)}</td>
                  <td className="text-right num">{fmt(seg.mc100VolumeM3, 3)}{seg.mc100VolumeContractM3 ? '†' : ''}</td>
                  <td rowSpan={rows} className="text-right num" style={{ fontWeight: 700 }}>{seg.volumeDeviationM3 > 0 ? '+' : ''}{fmt(seg.volumeDeviationM3, 3)}</td>
                  <td rowSpan={rows} className="text-right num" style={{ fontWeight: 700 }}>{fmt(seg.volumeAchievementPercent, 2)}</td>
                  <td rowSpan={rows} className="text-center" style={{ fontWeight: 700 }}>{STATUS_SHORT[seg.evaluationStatus]}</td>
                </tr>
                <tr style={{ fontWeight: 700, background: '#f3f4f6' }}>
                  <td>Rerata Terpilih ({selCount}/{seg.samples.length})</td>
                  <td className="text-center">—</td>
                  <td className="text-right num">{fmt(seg.segmentLengthMeter, 2)}</td>
                  {DIM_KEYS.map((k) => cell(seg, k, seg.averagedActualDimensions[k], true))}
                  <td className="text-right num">{fmt(seg.actualCrossSectionAreaM2, 3)}</td>
                  <td className="text-right num">{fmt(seg.actualVolumeM3, 3)}</td>
                </tr>
                {seg.samples.map((smp) => (
                  <tr key={smp.id} style={{ color: smp.isSelected ? '#000' : '#555', fontStyle: smp.isSelected ? 'normal' : 'italic' }}>
                    <td>{smp.isSelected ? '[✓] Direrata' : '[x] Diabaikan'} — {smp.sampleLabel}{smp.sampleNote ? <><br /><span style={{ fontSize: '6.5pt' }}>Ket: {smp.sampleNote}</span></> : null}</td>
                    <td className="text-right num">{fmt(smp.offsetMeter, 2)}</td>
                    <td className="text-center">—</td>
                    {DIM_KEYS.map((k) => cell(seg, k, smp.dimensions[k], true))}
                    <td className="text-right num">{fmt(sampleArea(seg, smp), 3)}</td>
                    <td className="text-center">—</td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
          <tr style={{ fontWeight: 700 }}>
            <td colSpan={6 + DIM_KEYS.length} className="text-right">JUMLAH VOLUME MC-100 / TERUKUR</td>
            <td className="text-center">—</td>
            <td className="text-right num">{fmt(s.mcVol, 3)}<br />{fmt(s.actVol, 3)}</td>
            <td className="text-right num">{s.actVol - s.mcVol > 0 ? '+' : ''}{fmt(s.actVol - s.mcVol, 3)}</td>
            <td className="text-right num">{fmt(s.achievement, 2)}</td>
            <td />
          </tr>
        </tbody>
      </table>
      <div className="avoid" style={{ fontSize: '7.5pt', marginTop: '5pt', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <b>Keterangan:</b> * = kurang dimensi terhadap MC-100 melampaui toleransi τ = {fmt(tol, 3)} m (Δp = p aktual − p MC-100 &lt; −τ). † = volume MC-100 mengacu dokumen kontrak. Dimensi akhir dihitung sebagai rerata aritmetik titik sampel bertanda [✓]; titik [x] tercatat sebagai jejak audit dan tidak diikutkan. Capaian = V terukur / V MC-100 × 100%.
        {usedSubtypes.map((id) => {
          const st = SUBTYPES[id];
          return <div key={id}><b>{st.label}:</b> {st.fields.map((f) => `${f.symbol} = ${f.label}`).join('; ')}; L = {st.lengthLabel.replace(/ \(L\)$/, '')}. Rumus: {st.formulaText.join('; ')}.</div>;
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
  const resLabel = { BELUM_DIPERIKSA: 'Belum diperiksa', SESUAI: 'Sesuai', TIDAK_SESUAI: 'Tidak Sesuai', TIDAK_RELEVAN: 'Tidak Relevan' } as const;
  return (
    <section className="sheet landscape">
      <LampiranHead p={p} no="Lampiran II" title="DAFTAR CACAT MUTU (DEFECT LIST) DAN DOKUMENTASI VISUAL LAPANGAN" />
      <div style={{ fontWeight: 700, fontSize: '10pt', margin: '4pt 0' }}>A. Daftar Cacat Mutu</div>
      <table className="t defect">
        <thead>
          <tr>
            <th style={{ width: '7mm' }}>No</th><th style={{ width: '34mm' }}>Lokasi STA, Posisi &amp; Koordinat GPS</th><th style={{ width: '72mm' }}>Foto Bukti Ber-Watermark</th>
            <th>Kode &amp; Uraian Temuan Teknis</th><th style={{ width: '15mm' }}>Tingkat</th><th>Instruksi Perbaikan</th><th style={{ width: '22mm' }}>Volume / Luas Terdampak</th>
            <th style={{ width: '20mm' }}>Batas Waktu</th><th style={{ width: '22mm' }}>Paraf Verifikasi Perbaikan</th>
          </tr>
        </thead>
        <tbody>
          {defects.map(({ d, s }, i) => (
            <tr key={d.id}>
              <td className="text-center">{i + 1}</td>
              <td><b>{s.staCode}</b><br />{s.structureName}<br />Posisi: {POSITION_LABEL[d.positionSide]}<br />GPS: {gpsText(d.gpsCoordinates)}<br />{stempelWaktu(d.capturedAt)}</td>
              <td>
                <PhotoThumbnail
                  photoId={d.watermarkedPhotoId}
                  fallbackDataUrl={d.watermarkedPhotoDataUrl}
                  alt={d.defectCode}
                  style={{ width: '70mm', display: 'block' }}
                  disableLink
                />
              </td>
              <td><b>{d.defectCode} — {d.defectTitle}</b><br />{d.technicalFinding}<br /><i>Sumber klasifikasi: {d.analysisSource === 'GEMINI_VISION' ? 'Gemini Vision (diverifikasi pemeriksa)' : 'Pustaka preset PSDA'}</i></td>
              <td className="text-center"><b>{SEVERITY_LABEL[d.severity].toUpperCase()}</b></td>
              <td>{d.repairInstruction}</td>
              <td>{d.affectedVolumeOrArea}</td>
              <td className="text-center">{d.dueDays} hari kalender<br />s.d. {tanggalPanjang(addDays(p.inspectionTeam.inspectionDate, d.dueDays))}</td>
              <td><div style={{ fontSize: '7pt' }}>Tgl:</div><div style={{ height: '14mm' }} /><div style={{ fontSize: '7pt' }}>Paraf:</div></td>
            </tr>
          ))}
          {!defects.length && <tr><td colSpan={9} className="text-center">Tidak terdapat cacat mutu.</td></tr>}
        </tbody>
      </table>

      <div style={{ fontWeight: 700, fontSize: '10pt', margin: '10pt 0 4pt', breakAfter: 'avoid', pageBreakAfter: 'avoid' }} className="avoid">B. Rekapitulasi Daftar Simak Pemeriksaan Visual &amp; Uji Fungsi</div>
      <table className="t defect">
        <thead><tr><th style={{ width: '7mm' }}>No</th><th style={{ width: '40mm' }}>STA / Unit</th><th>Parameter Pemeriksaan</th><th style={{ width: '26mm' }}>Acuan</th><th style={{ width: '24mm' }}>Hasil</th><th>Keterangan</th></tr></thead>
        <tbody>
          {checklistRows.map(({ s, c }, i) => (
            <tr key={c.id}><td className="text-center">{i + 1}</td><td>{s.staCode}</td><td>{c.parameterName}</td><td>{c.standardRef}</td><td className="text-center" style={{ fontWeight: c.status === 'TIDAK_SESUAI' ? 700 : 400 }}>{resLabel[c.status]}</td><td>{c.remarks}</td></tr>
          ))}
        </tbody>
      </table>

      {docs.length > 0 && (
        <>
          <div style={{ fontWeight: 700, fontSize: '10pt', margin: '10pt 0 4pt', breakAfter: 'avoid', pageBreakAfter: 'avoid' }} className="avoid">C. Dokumentasi Visual Lapangan</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4mm' }}>
            {docs.map(({ d, s }) => (
              <figure key={d.id} className="avoid" style={{ border: '0.75pt solid #000', padding: '2mm', margin: 0, fontSize: '7.5pt', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                <PhotoThumbnail
                  photoId={d.watermarkedPhotoId}
                  fallbackDataUrl={d.watermarkedPhotoDataUrl}
                  alt={d.defectCode}
                  style={{ width: '100%', display: 'block' }}
                  disableLink
                />
                <figcaption><b>{s.staCode}</b> · {POSITION_LABEL[d.positionSide]} · {d.technicalFinding}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
      <Signatures p={p} compact />
    </section>
  );
}
