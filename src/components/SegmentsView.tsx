import { useMemo, useState } from 'react';
import { ChevronLeft, Plus, Search, X } from 'lucide-react';
import type { GeometrySubType, PHOProject, PositionSide, StructureCategory } from '../types';
import type { Updater } from '../App';
import { Btn, Card, NumField, SelectField, TextField, cx } from './ui';
import { StatusBadge } from './StatusBadge';
import { CATEGORIES, CATEGORY_ORDER, POSITION_LABEL, SUBTYPES } from '../lib/templates';
import { fmt } from '../lib/format';
import { newSegment } from '../lib/factory';
import { projectSummary } from '../lib/calc';
import SegmentEditor from './SegmentEditor';

interface Props {
  project: PHOProject;
  update: Updater;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  notify: (m: string, t?: 'ok' | 'err') => void;
  openCamera: () => void;
}

export const SIDE_OPTIONS = (Object.keys(POSITION_LABEL) as PositionSide[]).map((k) => ({
  value: k,
  label: POSITION_LABEL[k],
}));

export default function SegmentsView({
  project,
  update,
  selectedId,
  setSelectedId,
  notify,
  openCamera,
}: Props) {
  const [q, setQ] = useState('');
  const [mobileEdit, setMobileEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const sum = projectSummary(project);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return project.segments.filter(
      (s) => !t || `${s.staCode} ${s.structureName} ${SUBTYPES[s.subType].label}`.toLowerCase().includes(t),
    );
  }, [project.segments, q]);
  const selected = project.segments.find((s) => s.id === selectedId) ?? null;

  const open = (id: string) => {
    setSelectedId(id);
    setMobileEdit(true);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="lg:grid lg:grid-cols-[390px_minmax(0,1fr)] lg:gap-4">
      <div className={cx('space-y-3', mobileEdit && 'hidden lg:block')}>
        {/* Metric Overview Strip */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs space-y-3">
          <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
            <div className="px-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">STA Terukur</div>
              <div className="num text-lg font-black text-slate-900 mt-0.5">
                {sum.measured} <span className="text-xs font-normal text-slate-400">/ {sum.total}</span>
              </div>
            </div>
            <div className="px-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Capaian Vol</div>
              <div className="num text-lg font-black text-emerald-700 mt-0.5">{fmt(sum.achievement, 1)}%</div>
            </div>
            <div className="px-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cacat Mutu</div>
              <div
                className={cx(
                  'num text-lg font-black mt-0.5',
                  sum.defects.length > 0 ? 'text-rose-600' : 'text-slate-900',
                )}
              >
                {sum.defects.length}
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-700">Progres Opname</span>
              <span className="num font-black text-slate-900">
                {sum.total > 0 ? Math.round((sum.measured / sum.total) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${sum.total > 0 ? (sum.measured / sum.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        <Btn variant="primary" className="w-full text-xs font-black shadow-xs" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 text-amber-400" />
          Tambah Segmen STA / Bangunan
        </Btn>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari STA atau nama ruas saluran..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-xs font-bold text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 placeholder:font-normal placeholder:text-slate-400"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              aria-label="Hapus pencarian"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* STA Segment List */}
        <ul className="space-y-2">
          {list.map((s) => {
            const defects = s.defects.filter((d) => d.entryType === 'CACAT_MUTU').length;
            const isSel = s.id === selectedId;
            return (
              <li key={s.id}>
                <button
                  onClick={() => open(s.id)}
                  className={cx(
                    'w-full rounded-2xl border p-3.5 text-left transition-all duration-150',
                    isSel
                      ? 'border-amber-400 bg-amber-50/30 shadow-xs border-l-4 border-l-amber-500'
                      : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-black tracking-tight text-slate-900">{s.staCode}</div>
                      <div className="truncate text-xs font-semibold text-slate-600 mt-0.5">{s.structureName || '-'}</div>
                    </div>
                    <StatusBadge status={s.evaluationStatus} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-slate-500">
                    <span className="rounded bg-slate-800 px-1.5 py-0.2 font-bold text-white text-[10px]">
                      {CATEGORIES[s.category].code}
                    </span>
                    <span>{SUBTYPES[s.subType].shortLabel}</span>
                    <span className="num">
                      V: {fmt(s.actualVolumeM3, 1)} / {fmt(s.mc100VolumeM3, 1)} m³
                    </span>
                    <span>{s.samples.length} sampel</span>
                    {defects > 0 && <span className="font-bold text-rose-600">⚠ {defects} cacat</span>}
                    {s.hasDimensionDeficit && <span className="font-bold text-rose-600">KURANG DIMENSI</span>}
                  </div>
                </button>
              </li>
            );
          })}
          {!list.length && (
            <li className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs font-semibold text-slate-500 bg-white">
              Belum ada segmen STA. Tambahkan segmen baru atau impor tabel CSV MC-100 pada tab Proyek.
            </li>
          )}
        </ul>
      </div>

      <div className={cx(!mobileEdit && 'hidden lg:block')}>
        {mobileEdit && (
          <button
            onClick={() => setMobileEdit(false)}
            className="mb-2 flex h-11 items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-950 lg:hidden"
          >
            <ChevronLeft className="h-5 w-5" /> Kembali ke Daftar STA
          </button>
        )}
        {selected ? (
          <SegmentEditor
            key={selected.id}
            project={project}
            seg={selected}
            update={update}
            notify={notify}
            openCamera={openCamera}
            onDeleted={() => {
              setSelectedId(project.segments.find((s) => s.id !== selected.id)?.id ?? null);
              setMobileEdit(false);
            }}
            onDuplicated={(id) => setSelectedId(id)}
          />
        ) : (
          <Card>
            <p className="py-12 text-center text-xs font-semibold text-slate-400">Pilih segmen STA dari daftar di sebelah kiri.</p>
          </Card>
        )}
      </div>

      {adding && (
        <AddSegmentDialog
          project={project}
          onClose={() => setAdding(false)}
          onAdd={(seg) => {
            update((p) => ({ ...p, segments: [...p.segments, seg] }));
            setAdding(false);
            open(seg.id);
            notify(`Segmen ${seg.staCode} ditambahkan.`);
          }}
        />
      )}
    </div>
  );
}

function AddSegmentDialog({
  project,
  onClose,
  onAdd,
}: {
  project: PHOProject;
  onClose: () => void;
  onAdd: (s: ReturnType<typeof newSegment>) => void;
}) {
  const [cat, setCat] = useState<StructureCategory>('SALURAN_IRIGASI');
  const [sub, setSub] = useState<GeometrySubType>('TRAPESIUM_PASANGAN_BATU');
  const [sta, setSta] = useState('');
  const [name, setName] = useState('');
  const [side, setSide] = useState<PositionSide>('KIRI_KANAN');
  const [L, setL] = useState<number | undefined>(50);
  const st = SUBTYPES[sub];

  return (
    <div className="no-print fixed inset-0 z-40 flex items-end justify-center bg-slate-950/60 sm:items-center backdrop-blur-xs" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">Tambah Segmen STA / Bangunan</h2>
          <button className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-3">
          <SelectField
            label="Kategori Bangunan (Standar PU)"
            value={cat}
            onChange={(v) => {
              setCat(v);
              setSub(CATEGORIES[v].subTypes[0]);
              setSide(v === 'BANGUNAN_PELENGKAP' || v === 'NORMALISASI_GALIAN' ? 'AS_TENGAH' : 'KIRI_KANAN');
            }}
            options={CATEGORY_ORDER.map((c) => ({
              value: c,
              label: `${CATEGORIES[c].label} (${CATEGORIES[c].code})`,
            }))}
          />
          <SelectField
            label="Sub-Tipe Geometri"
            value={sub}
            onChange={setSub}
            options={CATEGORIES[cat].subTypes.map((s) => ({ value: s, label: SUBTYPES[s].label }))}
          />
          <TextField label="Kode STA / Nomor Bangunan" value={sta} onChange={setSta} placeholder="Contoh: STA 0+100 - 0+150" />
          <TextField label="Nama Ruas / Bangunan" value={name} onChange={setName} placeholder="Contoh: Saluran Sekunder BLU.1" />
          <SelectField label="Posisi Penampang" value={side} onChange={setSide} options={SIDE_OPTIONS} />
          <NumField label={st.lengthLabel} unit={st.lengthUnit} value={L} onChange={setL} />
          <p className="text-xs text-slate-500 font-medium">Dimensi rencana MC-100 dapat diatur pada editor setelah segmen dibuat.</p>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Btn variant="secondary" onClick={onClose}>
              Batal
            </Btn>
            <Btn
              variant="primary"
              disabled={!sta.trim()}
              onClick={() =>
                onAdd(
                  newSegment({
                    staCode: sta.trim(),
                    structureName: name.trim(),
                    subType: sub,
                    positionSide: side,
                    length: L ?? 0,
                    tol: project.contractInfo.dimensionToleranceMeter,
                  }),
                )
              }
            >
              <Plus className="h-4 w-4 text-amber-400" />
              Simpan Segmen
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
