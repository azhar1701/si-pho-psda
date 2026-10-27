import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ClipboardList, FileText, FolderCog, HardDrive, Loader2, Ruler, Wifi, WifiOff } from 'lucide-react';
import type { PHOProject } from './types';
import { recomputeProject } from './lib/calc';
import { loadProject, saveProject, type StorageMode } from './lib/storage';
import { buildDemoProject } from './lib/demo';
import { cx } from './components/ui';
import ProjectView from './components/ProjectView';
import SegmentsView from './components/SegmentsView';
import CameraView from './components/CameraView';
import ReportView from './components/ReportView';

export type ViewId = 'proyek' | 'segmen' | 'kamera' | 'laporan';
export type Updater = (fn: (p: PHOProject) => PHOProject) => void;

const NAV: { id: ViewId; label: string; icon: typeof Camera }[] = [
  { id: 'proyek', label: 'Proyek', icon: FolderCog },
  { id: 'segmen', label: 'Opname STA', icon: Ruler },
  { id: 'kamera', label: 'Kamera', icon: Camera },
  { id: 'laporan', label: 'Laporan', icon: FileText },
];

export default function App() {
  const [project, setProject] = useState<PHOProject | null>(null);
  const [view, setView] = useState<ViewId>('segmen');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [saveState, setSaveState] = useState<{ mode: StorageMode; at: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    window.setTimeout(() => setToast(null), 3800);
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await loadProject();
      const p = stored ?? (await buildDemoProject());
      setProject(p);
      setSelectedId(p.segments[0]?.id ?? null);
    })();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    if (!project) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        const mode = await saveProject(project);
        setSaveState({ mode, at: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) });
      } catch (e) {
        notify('Penyimpanan lokal gagal: ' + (e as Error).message, 'err');
      }
    }, 350);
  }, [project, notify]);

  const update: Updater = useCallback((fn) => {
    setProject((prev) => (prev ? recomputeProject({ ...fn(prev), updatedAt: new Date().toISOString() }) : prev));
  }, []);

  const replaceProject = useCallback((p: PHOProject) => {
    setProject(recomputeProject(p));
    setSelectedId(p.segments[0]?.id ?? null);
  }, []);

  if (!project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#0f172a] text-white">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="text-sm font-semibold tracking-wide">Memuat data proyek lokal…</p>
      </div>
    );
  }

  const go = (v: ViewId) => { setView(v); window.scrollTo({ top: 0 }); };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="no-print sticky top-0 z-30 bg-[#0f172a] text-white shadow-lg">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2.5 lg:px-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-slate-950">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold tracking-wide">SI-PHO PSDA</div>
            <div className="truncate text-xs font-medium text-slate-300">{project.contractInfo.packageName || 'Paket pekerjaan belum diisi'}</div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className={cx('flex items-center gap-1 rounded px-2 py-1', online ? 'bg-emerald-700' : 'bg-red-700')}>
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{online ? 'DARING' : 'LURING'}</span>
            </span>
            <span className="hidden items-center gap-1 rounded bg-slate-700 px-2 py-1 sm:flex" title="Penyimpanan otomatis di perangkat">
              <HardDrive className="h-3.5 w-3.5" />
              {saveState ? `TERSIMPAN ${saveState.at}${saveState.mode === 'indexedDB' ? ' (IDB)' : ''}` : 'MENYIMPAN…'}
            </span>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-[1600px] gap-1 px-6 pb-2 lg:flex">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)}
              className={cx('flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold', view === n.id ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-slate-800')}>
              <n.icon className="h-5 w-5" />{n.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1600px] px-3 pb-28 pt-3 lg:px-6 lg:pb-10">
        {view === 'proyek' && <ProjectView project={project} update={update} replaceProject={replaceProject} notify={notify} />}
        {view === 'segmen' && <SegmentsView project={project} update={update} selectedId={selectedId} setSelectedId={setSelectedId} notify={notify} openCamera={() => go('kamera')} />}
        {view === 'kamera' && <CameraView project={project} update={update} selectedId={selectedId} setSelectedId={setSelectedId} notify={notify} online={online} />}
        {view === 'laporan' && <ReportView project={project} notify={notify} />}
      </main>

      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t-2 border-slate-800 bg-[#0f172a] lg:hidden">
        <div className="grid grid-cols-4">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)}
              className={cx('flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-bold', view === n.id ? 'bg-white text-slate-900' : 'text-slate-300')}>
              <n.icon className="h-6 w-6" />{n.label}
            </button>
          ))}
        </div>
      </nav>

      {toast && (
        <div className={cx('no-print fixed inset-x-3 bottom-20 z-50 mx-auto max-w-lg rounded-lg px-4 py-3 text-sm font-bold text-white shadow-xl lg:bottom-6', toast.tone === 'ok' ? 'bg-slate-900' : 'bg-red-700')}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
