import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ClipboardList, FileText, FolderCog, HardDrive, Loader2, Ruler, TrendingUp, Wifi, WifiOff } from 'lucide-react';
import type { PHOProject } from './types';
import { recomputeProject } from './lib/calc';
import { loadProject, saveProject, type StorageMode } from './lib/storage';
import { buildDemoProject } from './lib/demo';
import { cx } from './components/ui';
import ProjectView from './components/ProjectView';
import ProgressView from './components/ProgressView';
import SegmentsView from './components/SegmentsView';
import CameraView from './components/CameraView';
import ReportView from './components/ReportView';
import { ErrorBoundary } from './components/ErrorBoundary';

export type ViewId = 'proyek' | 'monev' | 'segmen' | 'kamera' | 'laporan';
export type Updater = (fn: (p: PHOProject) => PHOProject) => void;

const NAV: { id: ViewId; label: string; icon: typeof Camera }[] = [
  { id: 'proyek', label: 'Proyek', icon: FolderCog },
  { id: 'monev', label: 'Monev', icon: TrendingUp },
  { id: 'segmen', label: 'Opname STA', icon: Ruler },
  { id: 'kamera', label: 'Kamera', icon: Camera },
  { id: 'laporan', label: 'Laporan', icon: FileText },
];

export default function App() {
  const [project, setProject] = useState<PHOProject | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('Memeriksa basis data lokal IndexedDB…');
  const [view, setView] = useState<ViewId>('monev');
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
      try {
        setLoadingStep('Memuat data proyek tersimpan…');
        const stored = await loadProject();
        if (stored) {
          setProject(stored);
          setSelectedId(stored.segments[0]?.id ?? null);
        } else {
          setLoadingStep('Menyiapkan proyek contoh D.I. Lakbok Utara…');
          const demo = await buildDemoProject();
          setProject(demo);
          setSelectedId(demo.segments[0]?.id ?? null);
        }
      } catch (err) {
        notify('Gagal inisialisasi basis data: ' + (err as Error).message, 'err');
      }
    })();

    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [notify]);

  // Debounce penyimpanan otomatis ke 1200ms agar efisien saat pengetikan cepat (M-02)
  useEffect(() => {
    if (!project) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        const mode = await saveProject(project);
        setSaveState({
          mode,
          at: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
      } catch (e) {
        notify('Penyimpanan lokal gagal: ' + (e as Error).message, 'err');
      }
    }, 1200);
  }, [project, notify]);

  // Update dengan recomputasi geometris & hidraulis untuk perubahan dimensi (K-04)
  const update: Updater = useCallback((fn) => {
    setProject((prev) => (prev ? recomputeProject({ ...fn(prev), updatedAt: new Date().toISOString() }) : prev));
  }, []);

  // Update khusus metadata teks (tanpa recomputasi segmen berulang pada setiap keystroke) (K-04)
  const updateMeta: Updater = useCallback((fn) => {
    setProject((prev) => (prev ? { ...fn(prev), updatedAt: new Date().toISOString() } : prev));
  }, []);

  const replaceProject = useCallback((p: PHOProject) => {
    setProject(recomputeProject(p));
    setSelectedId(p.segments[0]?.id ?? null);
  }, []);

  if (!project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#0f172a] text-white">
        <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
        <p className="text-sm font-semibold tracking-wide text-slate-200">{loadingStep}</p>
        <span className="text-xs text-slate-400">SI-MONEV &amp; PHO PSDA · Standalone Offline PWA</span>
      </div>
    );
  }

  const go = (v: ViewId) => {
    setView(v);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="no-print sticky top-0 z-30 border-b border-amber-500/20 bg-[#0f172a] text-white shadow-md backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2.5 lg:px-6">
          {project.agencyHeader?.logoDataUrl ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 p-1 ring-1 ring-white/20 backdrop-blur">
              <img
                src={project.agencyHeader.logoDataUrl}
                alt="Logo Instansi"
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-950 shadow-sm font-black">
              <ClipboardList className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-wider text-white">SI-MONEV PSDA</span>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20 hidden sm:inline-block">
                MONITORING &amp; PHO
              </span>
            </div>
            <div className="truncate text-xs text-slate-300 font-medium">
              {project.contractInfo.packageName || 'Paket pekerjaan belum diisi'}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span
              className={cx(
                'flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] shadow-2xs font-semibold',
                online ? 'bg-emerald-600/90 text-white' : 'bg-rose-600/90 text-white',
              )}
            >
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span className="hidden sm:inline">{online ? 'DARING' : 'LURING'}</span>
            </span>
            <span
              className="hidden items-center gap-1.5 rounded-lg bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300 ring-1 ring-slate-700/60 sm:flex"
              title="Penyimpanan otomatis lokal di perangkat"
            >
              <HardDrive className="h-3 w-3 text-amber-400" />
              {saveState ? `${saveState.at}` : 'MENYIMPAN…'}
            </span>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-[1600px] gap-1 px-6 pb-2 lg:flex">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={cx(
                'flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-bold transition-all duration-150',
                view === n.id
                  ? 'bg-amber-400 text-slate-950 shadow-sm ring-1 ring-amber-300'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white',
              )}
            >
              <n.icon className="h-3.5 w-3.5" />
              {n.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1600px] px-3 pb-28 pt-3 lg:px-6 lg:pb-10">
        <ErrorBoundary fallbackTitle="Kendala pada Tampilan Aplikasi">
          <div key={view} className="view-enter">
            {view === 'proyek' && (
              <ProjectView
                project={project}
                update={update}
                updateMeta={updateMeta}
                replaceProject={replaceProject}
                notify={notify}
              />
            )}
            {view === 'monev' && (
              <ProgressView
                project={project}
                update={update}
                notify={notify}
              />
            )}
            {view === 'segmen' && (
              <SegmentsView
                project={project}
                update={update}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                notify={notify}
                openCamera={() => go('kamera')}
              />
            )}
            {view === 'kamera' && (
              <CameraView
                project={project}
                update={update}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                notify={notify}
                online={online}
              />
            )}
            {view === 'laporan' && <ReportView project={project} notify={notify} />}
          </div>
        </ErrorBoundary>
      </main>

      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-lg lg:hidden">
        <div className="grid grid-cols-5 px-1 py-1">
          {NAV.map((n) => {
            const active = view === n.id;
            return (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                className={cx(
                  'flex h-16 flex-col items-center justify-center gap-1 rounded-xl transition-all duration-150 relative',
                  active
                    ? 'text-amber-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200 active:scale-95 font-medium',
                )}
              >
                <n.icon className={cx('h-5 w-5 transition-transform duration-150', active && 'scale-110')} />
                <span className="text-[10px] tracking-tight">{n.label}</span>
                {active && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-amber-400" />}
              </button>
            );
          })}
        </div>
      </nav>

      {toast && (
        <div
          className={cx(
            'no-print fixed inset-x-4 top-4 z-50 mx-auto max-w-sm rounded-xl px-4 py-3 text-xs font-bold text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 border',
            toast.tone === 'ok' ? 'bg-[#0f172a]/95 border-amber-500/30' : 'bg-rose-900/95 border-rose-700/80',
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
