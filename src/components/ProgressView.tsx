import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Plus,
  Trash2,
  Wrench,
  X,
  TrendingUp,
  FileText,
  CalendarDays,
} from 'lucide-react';
import type { MaintenanceRecord, NCRItem, PHOProject, ProgressPeriod } from '../types';
import type { Updater } from '../App';
import { Btn, Card, NumField, SelectField, TextField, cx } from './ui';
import { MonevStatusBadge, NCRStatusBadge, SeverityBadge } from './StatusBadge';
import CurveSChart from './CurveSChart';
import { computeNCRStats, computeProgressSummary, computeTimelineSummary } from '../lib/progressCalc';
import { fmt, fmtIdr, todayISO } from '../lib/format';
import { newMaintenanceRecord, newNCRItem, newProgressPeriod } from '../lib/factory';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  project: PHOProject;
  update: Updater;
  notify: (m: string, t?: 'ok' | 'err') => void;
}

type MonevSubTab = 'kurva' | 'ncr' | 'pemeliharaan';

export default function ProgressView({ project: p, update, notify }: Props) {
  const [subTab, setSubTab] = useState<MonevSubTab>('kurva');
  const [ncrFilter, setNcrFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');

  // Dialog States
  const [editingPeriod, setEditingPeriod] = useState<ProgressPeriod | null>(null);
  const [isAddingPeriod, setIsAddingPeriod] = useState(false);

  const [editingNcr, setEditingNcr] = useState<NCRItem | null>(null);
  const [closingNcr, setClosingNcr] = useState<NCRItem | null>(null);
  const [isAddingNcr, setIsAddingNcr] = useState(false);

  const [isAddingMaint, setIsAddingMaint] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const timelineSummary = computeTimelineSummary(p.timeline, p.contractInfo.contractDate);
  const progressSummary = computeProgressSummary(p.progressPeriods ?? []);
  const ncrStats = computeNCRStats(p);

  // Period management
  const handleSavePeriod = (period: ProgressPeriod) => {
    update((prev) => {
      const periods = prev.progressPeriods ? [...prev.progressPeriods] : [];
      const idx = periods.findIndex((x) => x.id === period.id);
      if (idx >= 0) {
        periods[idx] = period;
      } else {
        periods.push(period);
      }
      periods.sort((a, b) => a.periodNumber - b.periodNumber);
      return { ...prev, progressPeriods: periods };
    });
    setEditingPeriod(null);
    setIsAddingPeriod(false);
    notify('Periode progres berhasil disimpan.');
  };

  const handleDeletePeriod = (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Hapus Periode Progres',
      message: 'Apakah Anda yakin ingin menghapus catatan periode progres ini?',
      onConfirm: () => {
        update((prev) => ({
          ...prev,
          progressPeriods: (prev.progressPeriods ?? []).filter((x) => x.id !== id),
        }));
        notify('Periode progres berhasil dihapus.');
      },
    });
  };

  // NCR Management
  const handleSaveNcr = (ncr: NCRItem) => {
    update((prev) => {
      const items = prev.ncrItems ? [...prev.ncrItems] : [];
      const idx = items.findIndex((x) => x.id === ncr.id);
      if (idx >= 0) {
        items[idx] = ncr;
      } else {
        items.push(ncr);
      }
      return { ...prev, ncrItems: items };
    });
    setEditingNcr(null);
    setIsAddingNcr(false);
    notify('Laporan NCR berhasil disimpan.');
  };

  const handleCloseNcrSubmit = (closureNotes: string, verifiedBy: string) => {
    if (!closingNcr) return;
    const updated: NCRItem = {
      ...closingNcr,
      status: 'CLOSED',
      actualClosureDate: todayISO(),
      closureNotes,
      verifiedBy,
    };
    handleSaveNcr(updated);
    setClosingNcr(null);
    notify('NCR berhasil ditutup dan diverifikasi.');
  };

  const handleDeleteNcr = (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Hapus Rekaman NCR',
      message: 'Apakah Anda yakin ingin menghapus data NCR ini?',
      onConfirm: () => {
        update((prev) => ({
          ...prev,
          ncrItems: (prev.ncrItems ?? []).filter((x) => x.id !== id),
        }));
        notify('Data NCR berhasil dihapus.');
      },
    });
  };

  // Maintenance Management
  const handleSaveMaint = (record: MaintenanceRecord) => {
    update((prev) => {
      const list = prev.maintenanceRecords ? [...prev.maintenanceRecords] : [];
      list.unshift(record);
      return { ...prev, maintenanceRecords: list };
    });
    setIsAddingMaint(false);
    notify('Catatan pemeliharaan berhasil ditambahkan.');
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: Project Monev Overview */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                MONITORING &amp; EVALUASI KONTRAK
              </span>
              <MonevStatusBadge status={progressSummary.status} />
            </div>
            <h1 className="mt-1 text-lg font-black text-slate-900 tracking-tight">
              {p.contractInfo.packageName || 'Paket Pekerjaan Belum Diisi'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              No. Kontrak: <strong>{p.contractInfo.contractNumber || '-'}</strong> · Nilai:{' '}
              <strong className="num text-slate-700">{fmtIdr(p.contractInfo.contractValueIdr)}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Btn
              variant="secondary"
              onClick={() => {
                const nextNum = (p.progressPeriods?.length ?? 0) + 1;
                setEditingPeriod(
                  newProgressPeriod({
                    periodNumber: nextNum,
                    label: `Minggu ke-${String(nextNum).padStart(2, '0')}`,
                    startDate: todayISO(),
                    endDate: todayISO(),
                    plannedPhysicalPercent: progressSummary.plannedPhysicalPercent,
                    actualPhysicalPercent: progressSummary.actualPhysicalPercent,
                  }),
                );
                setIsAddingPeriod(true);
              }}
            >
              <Plus className="h-4 w-4 text-amber-500" />
              Catat Progres Baru
            </Btn>
          </div>
        </div>

        {/* 4 Key Performance Indicators */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <CalendarDays className="h-3.5 w-3.5 text-slate-600" />
              Waktu Kalender
            </span>
            <div className="num text-lg font-black text-slate-900 mt-1">
              {timelineSummary.elapsedDays} / {timelineSummary.totalDays} Hari
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              Sisa <strong>{timelineSummary.remainingDays} hari</strong> ({fmt(timelineSummary.timeElapsedPercent, 1)}%)
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              Progres Fisik Realisasi
            </span>
            <div className="num text-lg font-black text-emerald-700 mt-1">
              {fmt(progressSummary.actualPhysicalPercent, 2)}%
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              Rencana: <span className="num font-bold">{fmt(progressSummary.plannedPhysicalPercent, 2)}%</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Deviasi Kumulatif
            </span>
            <div
              className={cx(
                'num text-lg font-black mt-1',
                progressSummary.deviationPercent >= 0 ? 'text-emerald-700' : 'text-rose-700',
              )}
            >
              {progressSummary.deviationPercent >= 0 ? '+' : ''}
              {fmt(progressSummary.deviationPercent, 2)}%
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              {progressSummary.statusLabel}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Pengendalian Mutu (NCR)
            </span>
            <div className="num text-lg font-black text-slate-900 mt-1">
              {ncrStats.open} Open <span className="text-xs font-normal text-slate-400">/ {ncrStats.total} Total</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              {ncrStats.closed} Selesai Diverifikasi
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setSubTab('kurva')}
          className={cx(
            'flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all',
            subTab === 'kurva'
              ? 'bg-[#0f172a] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200',
          )}
        >
          <TrendingUp className="h-4 w-4 text-amber-400" />
          Kurva-S &amp; Progres Periodik
        </button>

        <button
          type="button"
          onClick={() => setSubTab('ncr')}
          className={cx(
            'flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all',
            subTab === 'ncr'
              ? 'bg-[#0f172a] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200',
          )}
        >
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          Daftar NCR ({ncrStats.open} Open)
        </button>

        <button
          type="button"
          onClick={() => setSubTab('pemeliharaan')}
          className={cx(
            'flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all',
            subTab === 'pemeliharaan'
              ? 'bg-[#0f172a] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200',
          )}
        >
          <Wrench className="h-4 w-4 text-amber-400" />
          Masa Pemeliharaan (Menuju FHO)
        </button>
      </div>

      {/* SUBTAB 1: KURVA-S & PROGRES */}
      {subTab === 'kurva' && (
        <div className="space-y-4">
          <Card title="Kurva-S Realisasi vs Rencana Pelaksanaan" icon={<TrendingUp className="h-4 w-4 text-amber-500" />}>
            <CurveSChart periods={p.progressPeriods ?? []} />
          </Card>

          <Card
            title="Tabel Riwayat Progres Mingguan / Bulanan"
            icon={<FileSpreadsheet className="h-4 w-4 text-amber-500" />}
            right={
              <Btn
                variant="secondary"
                className="h-9 px-3 text-xs"
                onClick={() => {
                  const nextNum = (p.progressPeriods?.length ?? 0) + 1;
                  setEditingPeriod(
                    newProgressPeriod({
                      periodNumber: nextNum,
                      label: `Minggu ke-${String(nextNum).padStart(2, '0')}`,
                    }),
                  );
                  setIsAddingPeriod(true);
                }}
              >
                <Plus className="h-3.5 w-3.5 text-amber-500" /> Tambah Periode
              </Btn>
            }
          >
            {(!p.progressPeriods || p.progressPeriods.length === 0) ? (
              <div className="p-8 text-center text-sm font-semibold text-slate-500">
                Belum ada data periode progres. Klik tombol "Tambah Periode" untuk mencatat progres mingguan.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-600">
                      <th className="py-2.5 px-3">Periode</th>
                      <th className="py-2.5 px-3">Rentang Waktu</th>
                      <th className="py-2.5 px-3 text-right">Rencana Fisik</th>
                      <th className="py-2.5 px-3 text-right">Realisasi Fisik</th>
                      <th className="py-2.5 px-3 text-right">Deviasi</th>
                      <th className="py-2.5 px-3 text-right">Realisasi Keuangan</th>
                      <th className="py-2.5 px-3">Cuaca / Catatan</th>
                      <th className="py-2.5 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...p.progressPeriods]
                      .sort((a, b) => b.periodNumber - a.periodNumber)
                      .map((item) => {
                        const dev = item.actualPhysicalPercent - item.plannedPhysicalPercent;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{item.label}</td>
                            <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                              {item.startDate} s.d. {item.endDate}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-600">
                              {fmt(item.plannedPhysicalPercent, 2)}%
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                              {fmt(item.actualPhysicalPercent, 2)}%
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              <span
                                className={cx(
                                  'font-black px-1.5 py-0.5 rounded text-[11px]',
                                  dev >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800',
                                )}
                              >
                                {dev >= 0 ? '+' : ''}
                                {fmt(dev, 2)}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {fmt(item.actualFinancialPercent ?? 0, 2)}%
                            </td>
                            <td className="py-2.5 px-3 max-w-[200px] truncate text-slate-600" title={item.notes}>
                              {item.weatherSummary && <span className="font-semibold text-slate-700">{item.weatherSummary} · </span>}
                              {item.notes || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPeriod(item);
                                    setIsAddingPeriod(false);
                                  }}
                                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                                  title="Ubah"
                                >
                                  ✎
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePeriod(item.id)}
                                  className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                                  title="Hapus"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* SUBTAB 2: PENGENDALIAN MUTU & NCR */}
      {subTab === 'ncr' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Filter:</span>
              <button
                type="button"
                onClick={() => setNcrFilter('ALL')}
                className={cx('rounded-lg px-2.5 py-1 text-xs font-bold', ncrFilter === 'ALL' ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-600')}
              >
                Semua ({ncrStats.total})
              </button>
              <button
                type="button"
                onClick={() => setNcrFilter('OPEN')}
                className={cx('rounded-lg px-2.5 py-1 text-xs font-bold', ncrFilter === 'OPEN' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600')}
              >
                Open ({ncrStats.open})
              </button>
              <button
                type="button"
                onClick={() => setNcrFilter('CLOSED')}
                className={cx('rounded-lg px-2.5 py-1 text-xs font-bold', ncrFilter === 'CLOSED' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600')}
              >
                Closed ({ncrStats.closed})
              </button>
            </div>

            <Btn
              variant="warning"
              onClick={() => {
                const nextNum = (p.ncrItems?.length ?? 0) + 1;
                setEditingNcr(
                  newNCRItem({
                    ncrNumber: `NCR-${String(nextNum).padStart(2, '0')}/PSDA/${new Date().getFullYear()}`,
                    issuedBy: p.inspectionTeam.leadInspectorName || 'Pengawas Lapangan',
                  }),
                );
                setIsAddingNcr(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Terbitkan Lembar NCR Baru
            </Btn>
          </div>

          <div className="space-y-3">
            {(!p.ncrItems || p.ncrItems.length === 0) ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500 bg-white">
                Tidak ada temuan Non-Conformance Report (NCR). Mutu pelaksanaan pekerjaan terkendali baik.
              </div>
            ) : (
              p.ncrItems
                .filter((item) => (ncrFilter === 'ALL' ? true : ncrFilter === 'OPEN' ? item.status !== 'CLOSED' : item.status === 'CLOSED'))
                .map((item) => (
                  <div
                    key={item.id}
                    className={cx(
                      'rounded-2xl border bg-white p-4 shadow-xs transition-all space-y-3',
                      item.status === 'OPEN' ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200/90',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-slate-900">{item.ncrNumber}</span>
                          <NCRStatusBadge status={item.status} />
                          <SeverityBadge s={item.severity} />
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Diterbitkan oleh: <strong>{item.issuedBy}</strong> pada <strong>{item.issuedDate}</strong>
                          {item.staReference && <span> · Lokasi: <strong className="text-slate-800">{item.staReference}</strong></span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.status !== 'CLOSED' && (
                          <Btn
                            variant="success"
                            className="h-8 px-3 text-xs"
                            onClick={() => setClosingNcr(item)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Tutup &amp; Verifikasi
                          </Btn>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNcr(item);
                            setIsAddingNcr(false);
                          }}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                          title="Ubah"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNcr(item.id)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <span className="font-bold uppercase tracking-wider text-slate-600 block mb-1">
                          Deskripsi Ketidaksesuaian Teknis:
                        </span>
                        <p className="text-slate-900 font-medium leading-relaxed">{item.findingDescription}</p>
                        {item.rootCause && (
                          <p className="mt-2 text-slate-600">
                            <strong>Akar Masalah:</strong> {item.rootCause}
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <span className="font-bold uppercase tracking-wider text-slate-600 block mb-1">
                          Instruksi Tindakan Koreksi &amp; Pencegahan:
                        </span>
                        <p className="text-slate-900 font-medium leading-relaxed">{item.correctiveAction}</p>
                        <div className="mt-2 text-slate-600">
                          <strong>Target Selesai:</strong> {item.targetClosureDate}
                          {item.actualClosureDate && (
                            <span className="text-emerald-700 font-bold ml-2">
                              (Tuntas: {item.actualClosureDate})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {item.closureNotes && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5 text-xs text-emerald-950">
                        <strong>Catatan Verifikasi Penutupan:</strong> {item.closureNotes}
                        {item.verifiedBy && <span className="text-emerald-800"> — Diverifikasi oleh: {item.verifiedBy}</span>}
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: MASA PEMELIHARAAN (FHO) */}
      {subTab === 'pemeliharaan' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-amber-500" />
                  Masa Pemeliharaan Menuju Serah Terima Akhir (FHO)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Durasi pemeliharaan: <strong>{p.contractInfo.maintenancePeriodDays} hari kalender</strong> sejak tanggal Berita Acara PHO.
                </p>
              </div>

              <Btn variant="primary" onClick={() => setIsAddingMaint(true)}>
                <Plus className="h-4 w-4 text-amber-400" />
                Catat Kunjungan Lapangan
              </Btn>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-500 block">Tanggal PHO</span>
                <span className="text-sm font-black text-slate-900">{p.inspectionTeam.inspectionDate || '-'}</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-500 block">Target Tanggal FHO</span>
                <span className="text-sm font-black text-amber-700">{p.timeline?.fhoTargetDate || 'Menyesuaikan masa pemeliharaan'}</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-500 block">Sisa Cacat Mutu PHO</span>
                <span className="text-sm font-black text-slate-900">
                  {p.segments.flatMap((s) => s.defects.filter((d) => d.entryType === 'CACAT_MUTU')).length} Butir Cacat
                </span>
              </div>
            </div>
          </div>

          <Card title="Buku Log Pemeriksaan & Pemeliharaan Berkala" icon={<FileText className="h-4 w-4 text-amber-500" />}>
            {(!p.maintenanceRecords || p.maintenanceRecords.length === 0) ? (
              <div className="p-8 text-center text-sm font-semibold text-slate-500">
                Belum ada log catatan pemeliharaan. Tambahkan kunjungan inspeksi berkala di atas.
              </div>
            ) : (
              <div className="space-y-3">
                {p.maintenanceRecords.map((m) => (
                  <div key={m.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {m.visitDate} — {m.inspectorName}
                      </span>
                      <span
                        className={cx(
                          'px-2 py-0.5 rounded text-[10px] font-black uppercase',
                          m.isResolved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900',
                        )}
                      >
                        {m.isResolved ? 'TUNTAS / SELESAI' : 'DALAM PENANGANAN'}
                      </span>
                    </div>
                    {m.staReference && <div className="text-slate-600">Lokasi STA: {m.staReference}</div>}
                    <div className="text-slate-800 font-medium">{m.actionTaken}</div>
                    {m.notes && <div className="text-slate-500 italic mt-1">{m.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* MODAL: INPUT / EDIT PERIOD */}
      {(isAddingPeriod || editingPeriod) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                {isAddingPeriod ? 'Catat Periode Progres Baru' : 'Ubah Periode Progres'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditingPeriod(null);
                  setIsAddingPeriod(false);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editingPeriod && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSavePeriod(editingPeriod);
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label="Nomor Periode (Urutan)"
                    value={editingPeriod.periodNumber}
                    integer
                    onChange={(v) => setEditingPeriod({ ...editingPeriod, periodNumber: v ?? 1 })}
                  />
                  <TextField
                    label="Label Periode"
                    placeholder="Contoh: Minggu ke-05"
                    value={editingPeriod.label}
                    onChange={(v) => setEditingPeriod({ ...editingPeriod, label: v })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Tanggal Mulai"
                    type="date"
                    value={editingPeriod.startDate}
                    onChange={(v) => setEditingPeriod({ ...editingPeriod, startDate: v })}
                  />
                  <TextField
                    label="Tanggal Selesai"
                    type="date"
                    value={editingPeriod.endDate}
                    onChange={(v) => setEditingPeriod({ ...editingPeriod, endDate: v })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label="Rencana Fisik (%)"
                    unit="%"
                    value={editingPeriod.plannedPhysicalPercent}
                    onChange={(v) => setEditingPeriod({ ...editingPeriod, plannedPhysicalPercent: v ?? 0 })}
                  />
                  <NumField
                    label="Realisasi Fisik (%)"
                    unit="%"
                    value={editingPeriod.actualPhysicalPercent}
                    onChange={(v) => setEditingPeriod({ ...editingPeriod, actualPhysicalPercent: v ?? 0 })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label="Rencana Keuangan (%)"
                    unit="%"
                    value={editingPeriod.plannedFinancialPercent}
                    onChange={(v) => setEditingPeriod({ ...editingPeriod, plannedFinancialPercent: v ?? 0 })}
                  />
                  <NumField
                    label="Realisasi Keuangan (%)"
                    unit="%"
                    value={editingPeriod.actualFinancialPercent}
                    onChange={(v) => setEditingPeriod({ ...editingPeriod, actualFinancialPercent: v ?? 0 })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Ringkasan Cuaca"
                    placeholder="Cerah / Hujan"
                    value={editingPeriod.weatherSummary ?? ''}
                    onChange={(v) => setEditingPeriod({ ...editingPeriod, weatherSummary: v })}
                  />
                  <NumField
                    label="Jumlah Tenaga Kerja"
                    unit="Orang"
                    integer
                    value={editingPeriod.workerCount}
                    onChange={(v) => setEditingPeriod({ ...editingPeriod, workerCount: v })}
                  />
                </div>

                <TextField
                  label="Catatan Kendala &amp; Tindak Lanjut Lapangan"
                  multiline
                  placeholder="Deskripsikan item pekerjaan yang dikerjakan minggu ini serta kendala lapangan..."
                  value={editingPeriod.notes ?? ''}
                  onChange={(v) => setEditingPeriod({ ...editingPeriod, notes: v })}
                />

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Btn
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingPeriod(null);
                      setIsAddingPeriod(false);
                    }}
                  >
                    Batal
                  </Btn>
                  <Btn type="submit" variant="primary">
                    Simpan Periode Progres
                  </Btn>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: INPUT / EDIT NCR */}
      {(isAddingNcr || editingNcr) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                {isAddingNcr ? 'Terbitkan Lembar NCR Baru' : 'Ubah Lembar NCR'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditingNcr(null);
                  setIsAddingNcr(false);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editingNcr && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveNcr(editingNcr);
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Nomor NCR"
                    value={editingNcr.ncrNumber}
                    onChange={(v) => setEditingNcr({ ...editingNcr, ncrNumber: v })}
                  />
                  <SelectField
                    label="Tingkat Keparahan"
                    value={editingNcr.severity}
                    onChange={(v) => setEditingNcr({ ...editingNcr, severity: v })}
                    options={[
                      { value: 'MINOR', label: 'Minor (Ringan)' },
                      { value: 'MAYOR', label: 'Mayor (Sedang)' },
                      { value: 'KRITIS', label: 'Kritis (Berdampak Struktural)' },
                    ]}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Diterbitkan Oleh"
                    value={editingNcr.issuedBy}
                    onChange={(v) => setEditingNcr({ ...editingNcr, issuedBy: v })}
                  />
                  <TextField
                    label="Tanggal Penerbitan"
                    type="date"
                    value={editingNcr.issuedDate}
                    onChange={(v) => setEditingNcr({ ...editingNcr, issuedDate: v })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Lokasi STA / Struktur Terkait"
                    placeholder="Contoh: STA 0+050 Dinding Kiri"
                    value={editingNcr.staReference ?? ''}
                    onChange={(v) => setEditingNcr({ ...editingNcr, staReference: v })}
                  />
                  <TextField
                    label="Target Tanggal Penyelesaian"
                    type="date"
                    value={editingNcr.targetClosureDate}
                    onChange={(v) => setEditingNcr({ ...editingNcr, targetClosureDate: v })}
                  />
                </div>

                <TextField
                  label="Deskripsi Temuan Ketidaksesuaian"
                  multiline
                  placeholder="Uraikan temuan ketidaksesuaian dimensi atau mutu bahan secara spesifik..."
                  value={editingNcr.findingDescription}
                  onChange={(v) => setEditingNcr({ ...editingNcr, findingDescription: v })}
                />

                <TextField
                  label="Akar Masalah (Root Cause)"
                  placeholder="Contoh: Kurang pemadatan, semen expired, curing tidak cukup..."
                  value={editingNcr.rootCause ?? ''}
                  onChange={(v) => setEditingNcr({ ...editingNcr, rootCause: v })}
                />

                <TextField
                  label="Instruksi Tindakan Koreksi (Corrective Action)"
                  multiline
                  placeholder="Uraikan metode perbaikan yang wajib dilaksanakan oleh Kontraktor..."
                  value={editingNcr.correctiveAction}
                  onChange={(v) => setEditingNcr({ ...editingNcr, correctiveAction: v })}
                />

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Btn
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingNcr(null);
                      setIsAddingNcr(false);
                    }}
                  >
                    Batal
                  </Btn>
                  <Btn type="submit" variant="primary">
                    Simpan NCR
                  </Btn>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: VERIFIKASI & PENUTUPAN NCR */}
      {closingNcr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                Verifikasi Penutupan NCR
              </h2>
              <button type="button" onClick={() => setClosingNcr(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl space-y-1">
              <div>
                <strong>Nomor NCR:</strong> {closingNcr.ncrNumber}
              </div>
              <div>
                <strong>Temuan:</strong> {closingNcr.findingDescription}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const notes = (form.elements.namedItem('closureNotes') as HTMLTextAreaElement).value;
                const verifier = (form.elements.namedItem('verifiedBy') as HTMLInputElement).value;
                handleCloseNcrSubmit(notes, verifier);
              }}
              className="space-y-3 text-xs"
            >
              <TextField
                label="Nama Pejabat / Pengawas Pemeriksa"
                placeholder="Nama pemeriksa yang menyetujui perbaikan"
                value={p.inspectionTeam.technicalDirectorName || 'Direksi Teknis'}
                onChange={() => {}}
              />

              <label className="block">
                <span className="mb-1.5 block text-[13px] font-bold text-slate-700">
                  Catatan Hasil Pemeriksaan Lapangan
                </span>
                <textarea
                  name="closureNotes"
                  required
                  rows={3}
                  defaultValue="Pekerjaan perbaikan telah diperiksa di lapangan dan memenuhi toleransi spesifikasi teknis."
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm font-medium outline-none focus:border-amber-500"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Btn type="button" variant="secondary" onClick={() => setClosingNcr(null)}>
                  Batal
                </Btn>
                <Btn type="submit" variant="success">
                  <CheckCircle2 className="h-4 w-4" />
                  Konfirmasi Penutupan NCR
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KUNJUNGAN PEMELIHARAAN */}
      {isAddingMaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                Catat Kunjungan Pemeliharaan
              </h2>
              <button type="button" onClick={() => setIsAddingMaint(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const date = (form.elements.namedItem('visitDate') as HTMLInputElement).value;
                const inspector = (form.elements.namedItem('inspectorName') as HTMLInputElement).value;
                const sta = (form.elements.namedItem('sta') as HTMLInputElement).value;
                const action = (form.elements.namedItem('action') as HTMLTextAreaElement).value;
                const resolved = (form.elements.namedItem('isResolved') as HTMLInputElement).checked;

                handleSaveMaint(
                  newMaintenanceRecord({
                    visitDate: date,
                    inspectorName: inspector,
                    staReference: sta,
                    actionTaken: action,
                    isResolved: resolved,
                  }),
                );
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Tanggal Kunjungan" type="date" value={todayISO()} onChange={() => {}} />
                <TextField
                  label="Nama Pemeriksa"
                  placeholder="Pengawas / Direksi"
                  value={p.inspectionTeam.technicalDirectorName || ''}
                  onChange={() => {}}
                />
              </div>

              <TextField label="Lokasi STA" placeholder="Contoh: STA 0+010 s.d. 0+050" value="" onChange={() => {}} />

              <label className="block">
                <span className="mb-1.5 block text-[13px] font-bold text-slate-700">
                  Uraian Pemeriksaan / Tindakan Perbaikan
                </span>
                <textarea
                  name="action"
                  required
                  rows={3}
                  placeholder="Contoh: Kontraktor memobilisasi pekerja untuk perapihan siaran..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm font-medium outline-none focus:border-amber-500"
                />
              </label>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input type="checkbox" name="isResolved" className="h-4 w-4 rounded text-amber-500" />
                <span className="text-xs font-bold text-slate-800">Cacat mutu telah tuntas diperbaiki sepenuhnya</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Btn type="button" variant="secondary" onClick={() => setIsAddingMaint(false)}>
                  Batal
                </Btn>
                <Btn type="submit" variant="primary">
                  Simpan Catatan
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REUSABLE CONFIRM DIALOG */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
      />
    </div>
  );
}
