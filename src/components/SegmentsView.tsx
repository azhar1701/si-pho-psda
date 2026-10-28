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

export const SIDE_OPTIONS = (Object.keys(POSITION_LABEL) as PositionSide[]).map((k) => ({ value: k, label: POSITION_LABEL[k] }));

export default function SegmentsView({ project, update, selectedId, setSelectedId, notify, openCamera }: Props) {
  const [q, setQ] = useState('');
  const [mobileEdit, setMobileEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const sum = projectSummary(project);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return project.segments.filter((s) => !t || `${s.staCode} ${s.structureName} ${SUBTYPES[s.subType].label}`.toLowerCase().includes(t));
  }, [project.segments, q]);
  const selected = project.segments.find((s) => s.id === selectedId) ?? null;

  const open = (id: string) => { setSelectedId(id); setMobileEdit(true); window.scrollTo({ top: 0 }); };

  return (
    <div className="lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-4">
      <div className={cx('space-y-3', mobileEdit && 'hidden lg:block')}>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['STA Diperiksa', `${sum.measured}/${sum.total}`],
              ['Capaian Volume', `${fmt(sum.achievement, 2)}%`],
              ['Cacat Mutu', String(sum.defects.length)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-slate-300 bg-white px-3 py-2">
                <div className="text-[11px] font-bold uppercase text-slate-500">{k}</div>
                <div className="num text-xl font-extrabold text-slate-900">{v}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-300 bg-white p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Progres Opname Lapangan</span>
              <span className="num font-extrabold text-slate-900">
                {sum.total > 0 ? Math.round((sum.measured / sum.total) * 100) : 0}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${sum.total > 0 ? (sum.measured / sum.total) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 pt-0.5">
              <span className="text-emerald-700">✓ {sum.pass} Memenuhi</span>
              {sum.fail > 0 && <span className="text-red-700 font-bold">⚠ {sum.fail} Perlu Perbaikan</span>}
              <span className="text-slate-500">○ {sum.pending} Belum Diukur</span>
            </div>
          </div>
        </div>
        <Btn variant="primary" className="w-full text-base" onClick={() => setAdding(true)}>
          <Plus className="h-6 w-6" />Tambah Segmen STA / Bangunan
        </Btn>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari STA / nama bangunan" className="h-12 w-full rounded-lg border-2 border-slate-300 bg-white pl-10 pr-3 font-semibold outline-none focus:border-slate-900" />
        </div>
        <ul className="space-y-2">
          {list.map((s) => {
            const defects = s.defects.filter((d) => d.entryType === 'CACAT_MUTU').length;
            return (
              <li key={s.id}>
                <button onClick={() => open(s.id)}
                  className={cx('w-full rounded-xl border-2 bg-white p-3 text-left shadow-sm transition', s.id === selectedId ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:border-slate-400')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[15px] font-extrabold text-slate-900">{s.staCode}</div>
                      <div className="truncate text-sm font-semibold text-slate-600">{s.structureName || '-'}</div>
                    </div>
                    <StatusBadge status={s.evaluationStatus} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-600">
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 font-bold text-white">{CATEGORIES[s.category].code}</span>
                    <span>{SUBTYPES[s.subType].shortLabel}</span>
                    <span className="num">V {fmt(s.actualVolumeM3, 2)} / {fmt(s.mc100VolumeM3, 2)} m³</span>
                    <span>{s.samples.length} sampel</span>
                    {defects > 0 && <span className="font-bold text-red-700">{defects} cacat</span>}
                    {s.hasDimensionDeficit && <span className="font-bold text-red-700">KURANG DIMENSI</span>}
                  </div>
                </button>
              </li>
            );
          })}
          {!list.length && <li className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-sm font-semibold text-slate-500">Belum ada segmen. Tambah STA atau impor CSV MC-100 pada menu Proyek.</li>}
        </ul>
      </div>

      <div className={cx(!mobileEdit && 'hidden lg:block')}>
        {mobileEdit && (
          <button onClick={() => setMobileEdit(false)} className="mb-2 flex h-12 items-center gap-1 font-bold text-slate-800 lg:hidden"><ChevronLeft className="h-6 w-6" />Daftar STA</button>
        )}
        {selected ? (
          <SegmentEditor key={selected.id} project={project} seg={selected} update={update} notify={notify} openCamera={openCamera}
            onDeleted={() => { setSelectedId(project.segments.find((s) => s.id !== selected.id)?.id ?? null); setMobileEdit(false); }}
            onDuplicated={(id) => setSelectedId(id)} />
        ) : (
          <Card><p className="py-10 text-center font-semibold text-slate-500">Pilih segmen STA dari daftar.</p></Card>
        )}
      </div>

      {adding && <AddSegmentDialog project={project} onClose={() => setAdding(false)} onAdd={(seg) => {
        update((p) => ({ ...p, segments: [...p.segments, seg] }));
        setAdding(false);
        open(seg.id);
        notify(`Segmen ${seg.staCode} ditambahkan (Input Lapangan).`);
      }} />}
    </div>
  );
}

function AddSegmentDialog({ project, onClose, onAdd }: { project: PHOProject; onClose: () => void; onAdd: (s: ReturnType<typeof newSegment>) => void }) {
  const [cat, setCat] = useState<StructureCategory>('SALURAN_IRIGASI');
  const [sub, setSub] = useState<GeometrySubType>('TRAPESIUM_PASANGAN_BATU');
  const [sta, setSta] = useState('');
  const [name, setName] = useState('');
  const [side, setSide] = useState<PositionSide>('KIRI_KANAN');
  const [L, setL] = useState<number | undefined>(50);
  const st = SUBTYPES[sub];
  return (
    <div className="no-print fixed inset-0 z-40 flex items-end justify-center bg-slate-950/60 sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold uppercase">Tambah Segmen STA / Bangunan</h2>
          <button className="flex h-12 w-12 items-center justify-center rounded-lg hover:bg-slate-100" onClick={onClose}><X /></button>
        </div>
        <div className="grid gap-3">
          <SelectField label="Kategori Bangunan (Template Teknis)" value={cat} onChange={(v) => { setCat(v); setSub(CATEGORIES[v].subTypes[0]); setSide(v === 'BANGUNAN_PELENGKAP' || v === 'NORMALISASI_GALIAN' ? 'AS_TENGAH' : 'KIRI_KANAN'); }}
            options={CATEGORY_ORDER.map((c) => ({ value: c, label: `${CATEGORIES[c].label} — ${CATEGORIES[c].reference}` }))} />
          <SelectField label="Sub-Tipe Geometri" value={sub} onChange={setSub} options={CATEGORIES[cat].subTypes.map((s) => ({ value: s, label: SUBTYPES[s].label }))} />
          <TextField label="Kode STA / Unit Bangunan" value={sta} onChange={setSta} placeholder="STA 0+100 - 0+150" />
          <TextField label="Nama Ruas / Bangunan" value={name} onChange={setName} placeholder="Saluran Sekunder ..." />
          <SelectField label="Posisi" value={side} onChange={setSide} options={SIDE_OPTIONS} />
          <NumField label={st.lengthLabel} unit={st.lengthUnit} value={L} onChange={setL} />
          <p className="text-xs font-medium text-slate-600">Dimensi rencana MC-100 diisi pada kartu STA setelah segmen dibuat.</p>
          <Btn variant="primary" disabled={!sta.trim()} onClick={() => onAdd(newSegment({ staCode: sta.trim(), structureName: name.trim(), subType: sub, positionSide: side, length: L ?? 0, tol: project.contractInfo.dimensionToleranceMeter }))}>
            <Plus className="h-5 w-5" />Tambah Segmen
          </Btn>
        </div>
      </div>
    </div>
  );
}
