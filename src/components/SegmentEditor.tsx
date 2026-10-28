import { useState } from 'react';
import { AlertTriangle, Camera, CheckSquare, Copy, Plus, Ruler, Square, Trash2, Calculator, Image as ImageIcon, NotebookPen } from 'lucide-react';
import type { ChecklistStatus, DimKey, DimensionSet, InspectionSegment, MeasurementSample, PHOProject, StructureCategory, GeometrySubType } from '../types';
import type { Updater } from '../App';
import { Badge, Btn, Card, NumField, SelectField, TextField, cx } from './ui';
import { SeverityBadge, StatusBadge } from './StatusBadge';
import { CATEGORIES, CATEGORY_ORDER, SUBTYPES, SEVERITY_LABEL } from '../lib/templates';
import { deviation, isDeficit, sampleArea } from '../lib/calc';
import { fmt, fmtDim, stempelWaktu, uid } from '../lib/format';
import { buildChecklist, defaultDims, newSample } from '../lib/factory';
import { gpsText } from '../lib/inspection';
import { SIDE_OPTIONS } from './SegmentsView';
import { ConfirmDialog } from './ConfirmDialog';
import { PhotoThumbnail } from './PhotoThumbnail';

interface Props {
  project: PHOProject;
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
    onConfirm: () => {},
  });

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
          mc100Dimensions: defaultDims(sub),
          samples: [newSample(0, 0, defaultDims(sub))],
          visualChecklist: buildChecklist(c),
        }));
      },
    });
  };

  const changeSub = (sub: GeometrySubType) =>
    set((s) => ({ ...s, subType: sub, mc100Dimensions: { ...defaultDims(sub), ...s.mc100Dimensions } }));

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

  return (
    <div className="space-y-3">
      {/* Identitas */}
      <Card
        title={<span className="font-mono normal-case">{seg.staCode}</span>}
        icon={<Ruler className="h-5 w-5" />}
        right={<StatusBadge status={seg.evaluationStatus} />}
      >
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <Badge tone="slate" wrap>
            {cat.code} · {cat.reference}
          </Badge>
          <Badge tone={seg.dataSource === 'IMPORT_MC100' ? 'blue' : 'amber'}>
            {seg.dataSource === 'IMPORT_MC100' ? 'Impor MC-100' : 'Input Lapangan'}
          </Badge>
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
              notify('Segmen disalin dengan dimensi MC-100 yang sama.');
            }}
          >
            <Copy className="h-5 w-5" />
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
            <Trash2 className="h-5 w-5" />
            Hapus Segmen
          </Btn>
        </div>
      </Card>

      {/* MC-100 */}
      <Card title="Dimensi Rencana MC-100" icon={<Calculator className="h-5 w-5" />}>
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
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs font-semibold text-slate-700">
          <div className="mb-1 font-extrabold uppercase text-slate-900">Rumus — {st.label}</div>
          <div className="grid gap-0.5 font-mono sm:grid-cols-2">
            {st.formulaText.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </Card>

      {/* Banner kurang dimensi */}
      {seg.hasDimensionDeficit && (
        <div className="rounded-xl border-4 border-red-700 bg-amber-300 p-4 text-slate-950 shadow">
          <div className="flex gap-3">
            <AlertTriangle className="h-8 w-8 shrink-0 text-red-700" />
            <div>
              <p className="text-[15px] font-black uppercase leading-snug">
                Terindikasi kurang dimensi terhadap MC-100 — aktifkan pengambilan titik sampel tambahan (uji petik segmen)
              </p>
              <p className="mt-1 text-sm font-bold">
                Parameter: {deficitLabels.join(', ')} · Toleransi τ = {fmt(tol, 3)} m
                {seg.averageDeficitParams.length
                  ? ` · Rerata terpilih masih kurang pada: ${seg.averageDeficitParams
                      .map((k) => st.fields.find((f) => f.key === k)?.symbol ?? k)
                      .join(', ')}`
                  : ' · Rerata terpilih memenuhi'}
              </p>
            </div>
          </div>
          <Btn variant="danger" className="mt-3 w-full" onClick={addSample}>
            <Plus className="h-5 w-5" />
            Tambah Titik Sampel Ukur (Uji Petik)
          </Btn>
        </div>
      )}

      {/* Sampel */}
      <Card title={`Titik Sampel Ukur Aktual (${selectedCount}/${seg.samples.length} direrata)`} icon={<Ruler className="h-5 w-5" />}>
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
            <Plus className="h-5 w-5" />
            Tambah Titik Sampel Ukur (Uji Petik)
          </Btn>
        )}
      </Card>

      {/* Hasil */}
      <Card title="Hasil Rerata Terpilih vs MC-100" icon={<Calculator className="h-5 w-5" />}>
        <div className="overflow-x-auto">
          <table className="num w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b-2 border-slate-900 text-left text-xs uppercase text-slate-600">
                <th className="py-2">Parameter</th>
                <th className="text-right">MC-100</th>
                <th className="text-right">Rerata Aktual</th>
                <th className="text-right">Δ</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {st.fields.map((f) => {
                const a = seg.averagedActualDimensions[f.key];
                const m = seg.mc100Dimensions[f.key];
                const d = deviation(a, m);
                const def = f.kind !== 'ratio' && isDeficit(a, m, f.kind === 'count' ? 0 : tol);
                return (
                  <tr key={f.key} className="border-b border-slate-200">
                    <td className="py-2 font-bold text-slate-800">
                      {f.symbol} · {f.label}
                    </td>
                    <td className="text-right text-slate-600">{fmtDim(m, f.kind)}</td>
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
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-900 p-3 text-white sm:grid-cols-4">
          <div>
            <div className="text-[11px] font-bold text-slate-400">Luas MC-100</div>
            <div className="text-lg font-black">{fmt(seg.mc100CrossSectionAreaM2, 3)} m²</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Luas Rerata</div>
            <div className="text-lg font-black">{fmt(seg.actualCrossSectionAreaM2, 3)} m²</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Vol MC-100</div>
            <div className="text-lg font-black">{fmt(seg.mc100VolumeM3, 2)} m³</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Vol Rerata</div>
            <div className="text-lg font-black">{fmt(seg.actualVolumeM3, 2)} m³</div>
          </div>
        </div>
      </Card>

      {/* Visual checklist */}
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

      {/* Temuan */}
      <Card
        title={`Temuan Cacat Mutu & Dokumentasi (${seg.defects.length})`}
        icon={<ImageIcon className="h-5 w-5" />}
        right={
          <Btn variant="primary" className="min-h-[44px]" onClick={openCamera}>
            <Camera className="h-5 w-5" />
            Kamera
          </Btn>
        }
      >
        {seg.defects.length === 0 && <p className="text-sm font-semibold text-slate-500">Belum ada foto temuan pada segmen ini.</p>}
        <ul className="space-y-3">
          {seg.defects.map((d) => (
            <li key={d.id} className="flex gap-3 rounded-lg border border-slate-200 p-2">
              <PhotoThumbnail
                photoId={d.watermarkedPhotoId}
                fallbackDataUrl={d.watermarkedPhotoDataUrl}
                alt={d.defectCode}
                className="h-24 w-32 shrink-0 rounded object-cover"
              />
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono font-extrabold">{d.defectCode}</span>
                  {d.entryType === 'CACAT_MUTU' ? <SeverityBadge s={d.severity} /> : <Badge tone="green">Dokumentasi</Badge>}
                  <Badge tone="slate">{d.analysisSource === 'GEMINI_VISION' ? 'Gemini Vision' : 'Preset Lokal'}</Badge>
                </div>
                <div className="font-bold">{d.defectTitle}</div>
                <div className="text-xs font-medium text-slate-600">
                  {d.affectedVolumeOrArea} · {d.entryType === 'CACAT_MUTU' ? `${d.dueDays} hari · ${SEVERITY_LABEL[d.severity]}` : ''} ·{' '}
                  {gpsText(d.gpsCoordinates)} · {stempelWaktu(d.capturedAt)}
                </div>
              </div>
              <button
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-red-700 hover:bg-red-50"
                aria-label="Hapus temuan"
                onClick={() => {
                  askConfirm({
                    title: 'Hapus Temuan',
                    message: `Hapus temuan ${d.defectCode} (${d.defectTitle})?`,
                    isDestructive: true,
                    onConfirm: () => {
                      set((s) => ({ ...s, defects: s.defects.filter((x) => x.id !== d.id) }));
                    },
                  });
                }}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Catatan Pemeriksa" icon={<NotebookPen className="h-5 w-5" />}>
        <TextField
          label="Catatan teknis segmen (dicetak pada Lampiran I)"
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
    <div className={cx('rounded-xl border-2 p-3', smp.isSelected ? 'border-slate-900 bg-white' : 'border-dashed border-slate-300 bg-slate-50')}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onChange((s) => ({ ...s, isSelected: !s.isSelected }))}
          className={cx(
            'flex h-12 shrink-0 items-center gap-2 rounded-lg border-2 px-3 text-sm font-extrabold',
            smp.isSelected ? 'border-emerald-800 bg-emerald-700 text-white' : 'border-slate-400 bg-white text-slate-600',
          )}
          aria-pressed={smp.isSelected}
        >
          {smp.isSelected ? <CheckSquare className="h-6 w-6" /> : <Square className="h-6 w-6" />}
          {smp.isSelected ? 'Direrata' : 'Diabaikan'}
        </button>
        <input
          value={smp.sampleLabel}
          onChange={(e) => onChange((s) => ({ ...s, sampleLabel: e.target.value }))}
          className="order-last h-12 w-full min-w-0 rounded-lg border-2 border-slate-200 px-2 text-sm font-bold outline-none focus:border-slate-900 sm:order-none sm:w-auto sm:flex-1"
        />
        {onDelete && <span className="flex-1 sm:hidden" />}
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-red-700 hover:bg-red-50"
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
                  : `MC-100 ${fmtDim(m, f.kind)}${d !== undefined ? ` · Δ ${d > 0 ? '+' : ''}${fmt(d, f.kind === 'count' ? 0 : 3)}` : ''}${
                      def ? ' KURANG' : ''
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
