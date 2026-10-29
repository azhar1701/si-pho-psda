import { useState } from 'react';
import { AlertTriangle, Camera, CheckSquare, Copy, Plus, Ruler, Square, Trash2, Calculator, Image as ImageIcon, NotebookPen, Layers } from 'lucide-react';
import type { ChecklistStatus, DimKey, DimensionSet, InspectionSegment, MeasurementSample, MonevProject, StructureCategory, GeometrySubType } from '../types';
import type { Updater } from '../App';
import { Badge, Btn, Card, NumField, SelectField, TextField, cx } from './ui';
import { SeverityBadge, StatusBadge } from './StatusBadge';
import { CATEGORIES, CATEGORY_ORDER, SUBTYPES } from '../lib/templates';
import { deviation, isDeficit, sampleArea } from '../lib/calc';
import { fmt, fmtDim, stempelWaktu, uid } from '../lib/format';
import { buildChecklist, defaultDims, newSample } from '../lib/factory';
import { gpsText } from '../lib/inspection';
import { SIDE_OPTIONS } from '../lib/templates';
import { ConfirmDialog } from './ConfirmDialog';
import { PhotoThumbnail } from './PhotoThumbnail';

interface Props {
  project: MonevProject;
  seg: InspectionSegment;
  update: Updater;
  notify: (m: string, t?: 'ok' | 'err') => void;
  openCamera: () => void;
  onDeleted: () => void;
  onDuplicated: (id: string) => void;
}

export default function SegmentEditor({ project, seg, update, notify, openCamera, onDeleted, onDuplicated }: Props) {
  const tol = project.contractInfo.dimensionToleranceMeter;
  const st = SUBTYPES[seg.subType];
  const cat = CATEGORIES[seg.category];

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title?: string;
    message: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    open: false,
    message: '',
    onConfirm: () => { },
  });

  const [activeMcTab, setActiveMcTab] = useState<'MC100' | 'MC0'>('MC100');
  const [photoFilter, setPhotoFilter] = useState<'ALL' | 'DOK' | 'DEFECT'>('ALL');

  const askConfirm = (opts: { title?: string; message: string; isDestructive?: boolean; onConfirm: () => void }) => {
    setConfirmState({ open: true, ...opts });
  };

  const set = (fn: (s: InspectionSegment) => InspectionSegment) =>
    update((p) => ({ ...p, segments: p.segments.map((s) => (s.id === seg.id ? fn(s) : s)) }));
  const setSample = (id: string, fn: (s: MeasurementSample) => MeasurementSample) =>
    set((s) => ({ ...s, samples: s.samples.map((x) => (x.id === id ? fn(x) : x)) }));

  const changeCategory = (c: StructureCategory) => {
    if (c === seg.category) return;
    askConfirm({
      title: 'Ubah Kategori Bangunan',
      message: 'Mengubah kategori akan mengganti template dimensi dan daftar simak visual segmen ini ke konfigurasi default. Lanjutkan?',
      isDestructive: false,
      onConfirm: () => {
        const sub = CATEGORIES[c].subTypes[0];
        set((s) => ({
          ...s,
          category: c,
          subType: sub,
          mc0Dimensions: defaultDims(sub),
          mc100Dimensions: defaultDims(sub),
          samples: [newSample(0, 0, defaultDims(sub))],
          visualChecklist: buildChecklist(c),
        }));
      },
    });
  };

  const changeSub = (sub: GeometrySubType) =>
    set((s) => ({
      ...s,
      subType: sub,
      mc0Dimensions: { ...defaultDims(sub), ...(s.mc0Dimensions ?? {}) },
      mc100Dimensions: { ...defaultDims(sub), ...s.mc100Dimensions },
    }));

  const addSample = () => {
    const last = seg.samples[seg.samples.length - 1];
    const L = st.lengthUnit === 'm' ? seg.segmentLengthMeter : 0;
    const step = L > 0 ? L / 4 : 5;
    const offset = Math.min(L > 0 ? L : Infinity, Math.round(((last?.offsetMeter ?? -step) + step) * 10) / 10);
    const idx = seg.samples.length;
    const pos = L > 0 && offset >= L ? 'Ujung STA' : L > 0 && Math.abs(offset - L / 2) < 0.01 ? 'Tengah Bentang' : 'Titik Uji';
    const keep: DimensionSet = {};
    if (last?.dimensions.wallSides !== undefined) keep.wallSides = last.dimensions.wallSides;
    if (last?.dimensions.unitCount !== undefined) keep.unitCount = last.dimensions.unitCount;
    if (last?.dimensions.m !== undefined) keep.m = last.dimensions.m;
    const smp = { ...newSample(idx, offset, keep), sampleLabel: `Sampel ${idx + 1} - ${pos} (+${offset.toLocaleString('id-ID')}m)` };
    set((s) => ({ ...s, samples: [...s.samples, smp] }));
  };

  const selectedCount = seg.samples.filter((s) => s.isSelected).length;
  const deficitLabels = seg.deficitParams.map((k) => st.fields.find((f) => f.key === k)?.symbol ?? k);

  const mc0Dims = seg.mc0Dimensions ?? seg.mc100Dimensions;
  const ccoPercent = seg.volumeCcoVariancePercent ?? 0;

  return (
    <div className="space-y-3">
      {/* 1. Identitas Segmen */}
      <Card
        title={<span className="font-mono normal-case">{seg.staCode}</span>}
        icon={<Ruler className="h-5 w-5" />}
        right={<StatusBadge status={seg.evaluationStatus} />}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <Badge tone="slate" wrap>
            {cat.code} · {cat.reference}
          </Badge>
          <Badge tone={seg.dataSource.startsWith('IMPORT') ? 'blue' : 'amber'}>
            {seg.dataSource === 'IMPORT_MC_TERPADU'
              ? 'Impor Terpadu (MC-0 & MC-100)'
              : seg.dataSource === 'IMPORT_MC0'
                ? 'Impor MC-0'
                : seg.dataSource === 'IMPORT_MC100'
                  ? 'Impor MC-100'
                  : 'Input Lapangan'}
          </Badge>
          {Math.abs(ccoPercent) > 0.01 && (
            <Badge tone={ccoPercent > 0 ? 'purple' : 'amber'}>
              CCO {ccoPercent > 0 ? '+' : ''}{fmt(ccoPercent, 1)}% ({ccoPercent > 0 ? 'Tambah' : 'Kurang'})
            </Badge>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Kode STA / Unit Bangunan" value={seg.staCode} onChange={(v) => set((s) => ({ ...s, staCode: v }))} />
          <TextField label="Nama Ruas / Bangunan" value={seg.structureName} onChange={(v) => set((s) => ({ ...s, structureName: v }))} />
          <SelectField
            label="Kategori Bangunan"
            value={seg.category}
            onChange={changeCategory}
            options={CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORIES[c].label }))}
          />
          <SelectField
            label="Sub-Tipe Geometri"
            value={seg.subType}
            onChange={changeSub}
            options={cat.subTypes.map((s) => ({ value: s, label: SUBTYPES[s].label }))}
          />
          <SelectField
            label="Posisi"
            value={seg.positionSide}
            onChange={(v) => set((s) => ({ ...s, positionSide: v }))}
            options={SIDE_OPTIONS}
          />
          <NumField
            label={st.lengthLabel}
            unit={st.lengthUnit}
            value={seg.segmentLengthMeter}
            onChange={(v) => set((s) => ({ ...s, segmentLengthMeter: v ?? 0 }))}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn
            onClick={() => {
              const copy: InspectionSegment = {
                ...seg,
                id: uid('sta'),
                staCode: seg.staCode + ' (salinan)',
                dataSource: 'INPUT_LAPANGAN',
                samples: [newSample(0, 0, defaultDims(seg.subType))],
                defects: [],
                visualChecklist: buildChecklist(seg.category),
                inspectorNotes: '',
              };
              update((p) => ({ ...p, segments: [...p.segments, copy] }));
              onDuplicated(copy.id);
              notify('Segmen disalin dengan dimensi rencana yang sama.');
            }}
          >
            <Copy className="h-4 w-4" />
            Salin Segmen
          </Btn>
          <Btn
            variant="ghost"
            className="text-red-700"
            onClick={() => {
              askConfirm({
                title: 'Hapus Segmen',
                message: `Hapus segmen ${seg.staCode} beserta seluruh data titik sampel dan foto temuannya? Tindakan ini tidak dapat dibatalkan.`,
                isDestructive: true,
                onConfirm: () => {
                  update((p) => ({ ...p, segments: p.segments.filter((s) => s.id !== seg.id) }));
                  onDeleted();
                },
              });
            }}
          >
            <Trash2 className="h-4 w-4" />
            Hapus Segmen
          </Btn>
        </div>
      </Card>

      {/* 2. Dimensi Rencana Rekayasa: MC-0 vs MC-100 */}
      <Card
        title="Dimensi Rencana Desain (MC-0 & MC-100)"
        icon={<Layers className="h-5 w-5 text-indigo-600" />}
        right={
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveMcTab('MC100')}
              className={cx(
                'px-2.5 py-1 text-xs font-bold rounded-md transition',
                activeMcTab === 'MC100' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              MC-100 (Akhir)
            </button>
            <button
              type="button"
              onClick={() => setActiveMcTab('MC0')}
              className={cx(
                'px-2.5 py-1 text-xs font-bold rounded-md transition',
                activeMcTab === 'MC0' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              MC-0 (Awal)
            </button>
          </div>
        }
      >
        {activeMcTab === 'MC100' ? (
          <div>
            <div className="mb-2 text-xs font-bold text-sky-900 flex items-center justify-between">
              <span>Dimensi Kaji Ulang Akhir — Target As-Built untuk PHO (MC-100)</span>
              <span className="font-mono text-[11px] text-slate-500">Vol: {fmt(seg.mc100VolumeM3, 2)} m³</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {st.fields.map((f) => (
                <NumField
                  key={f.key}
                  symbol={f.symbol}
                  label={f.label}
                  unit={f.unit === '-' ? undefined : f.unit}
                  integer={f.kind === 'count'}
                  compact
                  value={seg.mc100Dimensions[f.key]}
                  onChange={(v) => set((s) => ({ ...s, mc100Dimensions: { ...s.mc100Dimensions, [f.key]: v } }))}
                />
              ))}
              <NumField
                label="Volume kontrak MC-100 (opsional)"
                unit="m³"
                compact
                value={seg.mc100VolumeContractM3 ?? undefined}
                onChange={(v) => set((s) => ({ ...s, mc100VolumeContractM3: v ?? null }))}
                hint="Kosong = dihitung dari dimensi"
              />
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-2 text-xs font-bold text-emerald-900 flex items-center justify-between">
              <span>Dimensi Rekayasa Lapangan Awal — Desain MC-0 (Baseline)</span>
              <span className="font-mono text-[11px] text-slate-500">Vol: {fmt(seg.mc0VolumeM3, 2)} m³</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {st.fields.map((f) => (
                <NumField
                  key={f.key}
                  symbol={f.symbol}
                  label={f.label}
                  unit={f.unit === '-' ? undefined : f.unit}
                  integer={f.kind === 'count'}
                  compact
                  value={mc0Dims[f.key]}
                  onChange={(v) => set((s) => ({ ...s, mc0Dimensions: { ...mc0Dims, [f.key]: v } }))}
                />
              ))}
              <NumField
                label="Volume kontrak MC-0 (opsional)"
                unit="m³"
                compact
                value={seg.mc0VolumeContractM3 ?? undefined}
                onChange={(v) => set((s) => ({ ...s, mc0VolumeContractM3: v ?? null }))}
                hint="Kosong = dihitung dari dimensi"
              />
            </div>
          </div>
        )}

        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs font-semibold text-slate-700">
          <div className="mb-1 font-extrabold uppercase text-slate-900">Rumus Penampang — {st.label}</div>
          <div className="grid gap-0.5 font-mono sm:grid-cols-2">
            {st.formulaText.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </Card>

      {/* 3. Banner Kurang Dimensi */}
      {seg.hasDimensionDeficit && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-500/10 via-amber-50/60 to-rose-50/40 p-4 sm:p-5 shadow-[0_4px_20px_rgba(245,158,11,0.08)]">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-500 to-red-600" />
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pl-1">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950 shadow-sm animate-pulse">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-black uppercase tracking-wider text-amber-950">
                    Terindikasi Kurang Dimensi terhadap MC-100
                  </span>
                  <span className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    Uji Petik Diperlukan
                  </span>
                </div>
                <p className="text-xs font-semibold leading-relaxed text-slate-700">
                  Parameter deviasi: <strong className="text-red-700">{deficitLabels.join(', ')}</strong> · Toleransi izin <span className="num font-bold">τ = {fmt(tol, 3)} m</span>
                </p>
                <p className="text-xs font-bold text-slate-800">
                  {seg.averageDeficitParams.length ? (
                    <span className="text-red-700">
                      ⚠ Nilai rerata terpilih masih berada di bawah toleransi pada parameter:{' '}
                      {seg.averageDeficitParams.map((k) => st.fields.find((f) => f.key === k)?.symbol ?? k).join(', ')}
                    </span>
                  ) : (
                    <span className="text-emerald-700">
                      ✓ Nilai rerata terpilih telah memenuhi batas toleransi teknis
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Btn
              variant="danger"
              className="w-full sm:w-auto shrink-0 shadow-md hover:shadow-lg font-black text-sm"
              onClick={addSample}
            >
              <Plus className="h-4 w-4" />
              Tambah Titik Sampel (Uji Petik)
            </Btn>
          </div>
        </div>
      )}

      {/* 4. Titik Sampel Ukur Aktual */}
      <Card title={`Titik Sampel Ukur Lapangan (${selectedCount}/${seg.samples.length} direrata)`} icon={<Ruler className="h-5 w-5" />}>
        <div className="space-y-3">
          {seg.samples.map((smp) => (
            <SampleCard
              key={smp.id}
              seg={seg}
              smp={smp}
              tol={tol}
              onChange={(fn) => setSample(smp.id, fn)}
              onDelete={
                seg.samples.length > 1
                  ? () => {
                    askConfirm({
                      title: 'Hapus Titik Sampel',
                      message: `Hapus titik ukur "${smp.sampleLabel}"?`,
                      isDestructive: true,
                      onConfirm: () => {
                        set((s) => ({ ...s, samples: s.samples.filter((x) => x.id !== smp.id) }));
                      },
                    });
                  }
                  : undefined
              }
            />
          ))}
        </div>
        {!seg.hasDimensionDeficit && (
          <Btn className="mt-3 w-full" onClick={addSample}>
            <Plus className="h-4 w-4" />
            Tambah Titik Sampel Ukur (Uji Petik)
          </Btn>
        )}
      </Card>

      {/* 5. Komparator 3-Pilar: MC-0 vs MC-100 vs Rerata Aktual */}
      <Card title="Hasil Komparasi 3-Pilar: MC-0 vs MC-100 vs Rerata Aktual" icon={<Calculator className="h-5 w-5" />}>
        <div className="overflow-x-auto">
          <table className="num w-full min-w-[540px] text-sm">
            <thead>
              <tr className="border-b-2 border-slate-900 text-left text-xs uppercase text-slate-600">
                <th className="py-2">Parameter</th>
                <th className="text-right">MC-0 (Awal)</th>
                <th className="text-right">MC-100 (Akhir)</th>
                <th className="text-right">Rerata Aktual</th>
                <th className="text-right">Δ vs MC-100</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {st.fields.map((f) => {
                const m0 = mc0Dims[f.key];
                const m100 = seg.mc100Dimensions[f.key];
                const a = seg.averagedActualDimensions[f.key];
                const d = deviation(a, m100);
                const def = f.kind !== 'ratio' && isDeficit(a, m100, f.kind === 'count' ? 0 : tol);
                return (
                  <tr key={f.key} className="border-b border-slate-200">
                    <td className="py-2 font-bold text-slate-800">
                      {f.symbol} · {f.label}
                    </td>
                    <td className="text-right text-slate-500">{fmtDim(m0, f.kind)}</td>
                    <td className="text-right font-semibold text-slate-700">{fmtDim(m100, f.kind)}</td>
                    <td className="text-right font-extrabold text-slate-900">{fmtDim(a, f.kind)}</td>
                    <td className={cx('text-right font-bold', d === undefined ? 'text-slate-400' : d < 0 ? 'text-red-700' : 'text-emerald-700')}>
                      {d === undefined ? '-' : `${d > 0 ? '+' : ''}${fmt(d, f.kind === 'count' ? 0 : 3)}`}
                    </td>
                    <td className="text-right">
                      {f.kind === 'ratio' ? (
                        <span className="text-xs font-bold text-slate-500">KEMIRINGAN</span>
                      ) : def ? (
                        <Badge tone="red">KURANG</Badge>
                      ) : a !== undefined ? (
                        <Badge tone="green">MEMENUHI</Badge>
                      ) : (
                        <Badge tone="slate">-</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 4 Pilar Metrik Volume */}
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-900 p-3 text-white sm:grid-cols-4">
          <div>
            <div className="text-[11px] font-bold text-slate-400">Vol MC-0 (Awal)</div>
            <div className="text-base font-black text-emerald-400">{fmt(seg.mc0VolumeM3, 2)} m³</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Vol MC-100 (Akhir)</div>
            <div className="text-base font-black text-sky-400">{fmt(seg.mc100VolumeM3, 2)} m³</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Variasi CCO (Desain)</div>
            <div className="text-base font-black text-purple-400">
              {seg.volumeCcoVarianceM3 !== undefined ? `${seg.volumeCcoVarianceM3 > 0 ? '+' : ''}${fmt(seg.volumeCcoVarianceM3, 2)} m³` : '-'}
            </div>
            <div className="text-[10px] text-slate-400">({fmt(ccoPercent, 1)}%)</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Vol Aktual Lapangan</div>
            <div className="text-base font-black text-amber-400">{fmt(seg.actualVolumeM3, 2)} m³</div>
            <div className="text-[10px] text-slate-400">Capaian: {fmt(seg.volumeAchievementPercent, 1)}%</div>
          </div>
        </div>
      </Card>

      {/* 6. Daftar Simak Visual Mutu */}
      <Card title={`Daftar Simak Visual Mutu (${seg.visualChecklist.filter((x) => x.status === 'SESUAI').length}/${seg.visualChecklist.length} Sesuai)`}>
        <div className="divide-y divide-slate-200">
          {seg.visualChecklist.map((c) => (
            <div key={c.id} className="py-2.5 sm:flex sm:items-center sm:justify-between sm:gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900">{c.parameterName}</div>
                <div className="text-xs text-slate-500">{c.standardRef}</div>
              </div>
              <div className="mt-2 flex shrink-0 gap-1 sm:mt-0">
                {(['SESUAI', 'TIDAK_SESUAI', 'TIDAK_RELEVAN'] as ChecklistStatus[]).map((stt) => (
                  <button
                    key={stt}
                    type="button"
                    onClick={() =>
                      set((s) => ({
                        ...s,
                        visualChecklist: s.visualChecklist.map((x) => (x.id === c.id ? { ...x, status: stt } : x)),
                      }))
                    }
                    className={cx(
                      'rounded-md px-2.5 py-1 text-xs font-bold transition',
                      c.status === stt
                        ? stt === 'SESUAI'
                          ? 'bg-emerald-700 text-white'
                          : stt === 'TIDAK_SESUAI'
                            ? 'bg-red-700 text-white'
                            : 'bg-slate-700 text-white'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
                    )}
                  >
                    {stt === 'SESUAI' ? 'Sesuai' : stt === 'TIDAK_SESUAI' ? 'Tidak Sesuai' : 'Tidak Relevan'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 7. Temuan Cacat Mutu & Dokumentasi */}
      {(() => {
        const docPhotos = seg.defects.filter((d) => d.entryType === 'DOKUMENTASI');
        const defectPhotos = seg.defects.filter((d) => d.entryType === 'CACAT_MUTU');
        const displayedPhotos =
          photoFilter === 'DOK' ? docPhotos : photoFilter === 'DEFECT' ? defectPhotos : seg.defects;

        return (
          <Card
            title={`Temuan Cacat Mutu & Dokumentasi (${seg.defects.length})`}
            icon={<ImageIcon className="h-5 w-5 text-amber-500" />}
            right={
              <Btn variant="primary" className="min-h-[44px]" onClick={openCamera}>
                <Camera className="h-4 w-4" />
                Buka Kamera
              </Btn>
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPhotoFilter('ALL')}
                  className={cx(
                    'rounded-lg px-2.5 py-1 text-xs font-bold transition',
                    photoFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  Semua ({seg.defects.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoFilter('DOK')}
                  className={cx(
                    'rounded-lg px-2.5 py-1 text-xs font-bold transition',
                    photoFilter === 'DOK'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-sky-50 text-sky-700 hover:bg-sky-100',
                  )}
                >
                  Dokumentasi Fisik ({docPhotos.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoFilter('DEFECT')}
                  className={cx(
                    'rounded-lg px-2.5 py-1 text-xs font-bold transition',
                    photoFilter === 'DEFECT'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-2xs'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100',
                  )}
                >
                  Cacat Mutu ({defectPhotos.length})
                </button>
              </div>
              <div className="text-[11px] text-slate-500">
                Foto otomatis terbakar watermark legal dan tercetak pada Lampiran II A4.
              </div>
            </div>

            {displayedPhotos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center text-xs font-medium text-slate-500">
                {photoFilter === 'ALL'
                  ? 'Belum ada foto dokumentasi atau temuan pada segmen ini. Tekan tombol "Buka Kamera" untuk mengambil foto.'
                  : photoFilter === 'DOK'
                    ? 'Belum ada foto dokumentasi fisik (Hulu/Hilir/Penampang).'
                    : 'Tidak ada temuan cacat mutu pada segmen ini.'}
              </div>
            ) : (
              <ul className="space-y-3 pt-1">
                {displayedPhotos.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col sm:flex-row gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs hover:border-slate-300"
                  >
                    <PhotoThumbnail
                      photoId={d.watermarkedPhotoId}
                      fallbackDataUrl={d.watermarkedPhotoDataUrl}
                      alt={d.defectCode}
                      className="h-28 w-full sm:w-36 shrink-0 rounded-lg object-cover border border-slate-100 bg-slate-100"
                    />
                    <div className="min-w-0 flex-1 text-sm space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-extrabold text-slate-900">{d.defectCode}</span>
                        {d.entryType === 'CACAT_MUTU' ? (
                          <SeverityBadge s={d.severity} />
                        ) : (
                          <Badge tone="green">Dokumentasi Fisik</Badge>
                        )}
                        <Badge tone="slate">{d.analysisSource === 'GEMINI_VISION' ? 'Gemini Vision' : 'Preset Lapangan'}</Badge>
                      </div>
                      <div className="font-bold text-slate-900">{d.defectTitle}</div>
                      <div className="text-xs text-slate-600 line-clamp-2">{d.technicalFinding}</div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] font-medium text-slate-500">
                        {d.entryType === 'CACAT_MUTU' && (
                          <span className="font-semibold text-amber-700">Batas: {d.dueDays} hari</span>
                        )}
                        <span>{gpsText(d.gpsCoordinates)}</span>
                        <span>{stempelWaktu(d.capturedAt)}</span>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center justify-end sm:justify-start">
                      <button
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        aria-label="Hapus foto"
                        title="Hapus Foto"
                        onClick={() => {
                          askConfirm({
                            title: 'Hapus Foto Temuan',
                            message: `Hapus foto ${d.defectCode} (${d.defectTitle})?`,
                            isDestructive: true,
                            onConfirm: () => {
                              set((s) => ({ ...s, defects: s.defects.filter((x) => x.id !== d.id) }));
                            },
                          });
                        }}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })()}

      {/* 8. Catatan Pemeriksa */}
      <Card title="Catatan Pemeriksa Lapangan" icon={<NotebookPen className="h-5 w-5" />}>
        <TextField
          label="Catatan teknis segmen (dicetak pada Lampiran I BA PHO)"
          multiline
          value={seg.inspectorNotes ?? ''}
          onChange={(v) => set((s) => ({ ...s, inspectorNotes: v }))}
        />
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

function SampleCard({
  seg,
  smp,
  tol,
  onChange,
  onDelete,
}: {
  seg: InspectionSegment;
  smp: MeasurementSample;
  tol: number;
  onChange: (fn: (s: MeasurementSample) => MeasurementSample) => void;
  onDelete?: () => void;
}) {
  const st = SUBTYPES[seg.subType];
  const setDim = (k: DimKey, v: number | undefined) =>
    onChange((s) => ({ ...s, dimensions: { ...s.dimensions, [k]: v }, recordedAt: new Date().toISOString() }));
  return (
    <div
      className={cx(
        'rounded-2xl border p-3.5 sm:p-4 transition-all duration-150',
        smp.isSelected
          ? 'border-slate-300 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.03)]'
          : 'border-dashed border-slate-300/80 bg-slate-50/70 opacity-80',
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => onChange((s) => ({ ...s, isSelected: true }))}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition',
              smp.isSelected ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            <CheckSquare className="h-4 w-4" />
            Direrata
          </button>
          <button
            type="button"
            onClick={() => onChange((s) => ({ ...s, isSelected: false }))}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition',
              !smp.isSelected ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <Square className="h-4 w-4" />
            Diabaikan
          </button>
        </div>
        <input
          value={smp.sampleLabel}
          onChange={(e) => onChange((s) => ({ ...s, sampleLabel: e.target.value }))}
          className="order-last h-11 w-full min-w-0 rounded-xl border-2 border-slate-200 bg-slate-50/40 px-3 text-sm font-bold text-slate-900 outline-none transition focus:bg-white focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 sm:order-none sm:w-auto sm:flex-1"
        />
        {onDelete && <span className="flex-1 sm:hidden" />}
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 transition"
            aria-label="Hapus sampel"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <NumField
          label="Offset dari patok awal"
          unit="m"
          compact
          value={smp.offsetMeter}
          onChange={(v) => onChange((s) => ({ ...s, offsetMeter: v ?? 0 }))}
        />
        {st.fields.map((f) => {
          const a = smp.dimensions[f.key];
          const m = seg.mc100Dimensions[f.key];
          const d = deviation(a, m);
          const def = f.kind !== 'ratio' && isDeficit(a, m, f.kind === 'count' ? 0 : tol);
          return (
            <NumField
              key={f.key}
              symbol={f.symbol}
              label={f.label}
              unit={f.unit === '-' ? undefined : f.unit}
              integer={f.kind === 'count'}
              compact
              tone={a === undefined || f.kind === 'ratio' ? 'normal' : def ? 'deficit' : 'ok'}
              hint={
                m === undefined
                  ? 'MC-100: -'
                  : `MC-100 ${fmtDim(m, f.kind)}${d !== undefined ? ` · Δ ${d > 0 ? '+' : ''}${fmt(d, f.kind === 'count' ? 0 : 3)}` : ''}${def ? ' KURANG' : ''
                  }`
              }
              value={a}
              onChange={(v) => setDim(f.key, v)}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <input
          value={smp.sampleNote ?? ''}
          placeholder="Catatan titik sampel (posisi/kondisi/alasan diabaikan)"
          onChange={(e) => onChange((s) => ({ ...s, sampleNote: e.target.value }))}
          className="h-12 min-w-0 flex-1 rounded-lg border-2 border-slate-200 px-3 text-sm font-medium outline-none focus:border-slate-900"
        />
        <span className="num rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
          A titik = {fmt(sampleArea(seg, smp), 3)} m²
        </span>
      </div>
    </div>
  );
}
