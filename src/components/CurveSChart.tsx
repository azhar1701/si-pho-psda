import { useState } from 'react';
import type { ProgressPeriod } from '../types';
import { buildCurvePoints, type CurvePoint } from '../lib/progressCalc';
import { fmt } from '../lib/format';
import { cx } from './ui';

interface Props {
  periods: ProgressPeriod[];
  className?: string;
}

export default function CurveSChart({ periods, className }: Props) {
  const points = buildCurvePoints(periods);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div className={cx('flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-8 text-center bg-slate-50/50', className)}>
        <p className="text-sm font-bold text-slate-700">Kurva-S Memerlukan Minimal 2 Periode Progres</p>
        <p className="mt-1 text-xs text-slate-500">Tambahkan periode mingguan atau bulanan pada tabel di bawah untuk melihat kurva rencana dan realisasi.</p>
      </div>
    );
  }

  // SVG dimensions & padding
  const width = 800;
  const height = 360;
  const padding = { top: 30, right: 35, bottom: 45, left: 55 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Coordinate scales
  const n = points.length;
  const getX = (index: number) => padding.left + (index / (n - 1)) * chartW;
  const getY = (valPercent: number) => padding.top + chartH - (Math.min(100, Math.max(0, valPercent)) / 100) * chartH;

  // Generate Path Strings
  const plannedPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.planned)}`).join(' ');

  // Filter actual points up to the last non-zero actual
  const actualPoints = points.filter((p) => p.hasActual);
  const actualPath = actualPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.actual)}`).join(' ');

  // Area under actual or planned
  const lastActualIdx = Math.max(0, actualPoints.length - 1);

  // Active point for tooltip
  const selectedPoint: CurvePoint | null = activeIdx !== null ? points[activeIdx] : points[lastActualIdx] ?? null;

  return (
    <div className={cx('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <span className="h-2.5 w-6 rounded-full bg-slate-400 border border-slate-500/40" style={{ borderStyle: 'dashed' }} />
            <span>Rencana (Kurva S)</span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-emerald-700">
            <span className="h-2.5 w-6 rounded-full bg-emerald-500 shadow-xs" />
            <span>Realisasi Aktual Lapangan</span>
          </div>
        </div>

        {selectedPoint && (
          <div className="flex items-center gap-3 rounded-lg bg-slate-100 px-3 py-1 text-xs">
            <span className="font-bold text-slate-900">{selectedPoint.label}:</span>
            <span className="num text-slate-600">Rencana: <strong>{fmt(selectedPoint.planned, 2)}%</strong></span>
            <span className="num text-emerald-700">Aktual: <strong>{fmt(selectedPoint.actual, 2)}%</strong></span>
            {selectedPoint.hasActual && (
              <span
                className={cx(
                  'num font-black px-1.5 py-0.5 rounded text-[11px]',
                  selectedPoint.actual - selectedPoint.planned >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800',
                )}
              >
                Dev: {selectedPoint.actual - selectedPoint.planned >= 0 ? '+' : ''}
                {fmt(selectedPoint.actual - selectedPoint.planned, 2)}%
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative overflow-x-auto rounded-xl border border-slate-200/90 bg-white p-2 shadow-xs">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[580px] select-none"
          style={{ maxHeight: '400px' }}
        >
          {/* Background Grid Lines (0%, 20%, 40%, 60%, 80%, 100%) */}
          {[0, 20, 40, 60, 80, 100].map((val) => {
            const y = getY(val);
            return (
              <g key={val}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={val === 0 || val === 100 ? '#cbd5e1' : '#f1f5f9'}
                  strokeWidth={val === 0 || val === 100 ? 1.5 : 1}
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="num text-[11px] font-bold fill-slate-400"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Vertical Grid Lines & Ticks */}
          {points.map((p, i) => {
            const x = getX(i);
            return (
              <g key={p.periodNumber}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={height - padding.bottom}
                  stroke="#f8fafc"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={height - padding.bottom + 18}
                  textAnchor="middle"
                  className={cx(
                    'text-[11px] font-bold fill-slate-500 cursor-pointer transition-colors',
                    activeIdx === i && 'fill-slate-950 font-black',
                  )}
                  onClick={() => setActiveIdx(i)}
                >
                  {p.label.replace('Minggu ke-', 'M')}
                </text>
              </g>
            );
          })}

          {/* Planned Line (Dashed) */}
          <path
            d={plannedPath}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={3}
            strokeDasharray="6 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Actual Line (Solid thick) */}
          {actualPoints.length > 0 && (
            <path
              d={actualPath}
              fill="none"
              stroke="#059669"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points Planned */}
          {points.map((p, i) => {
            const x = getX(i);
            const y = getY(p.planned);
            return (
              <circle
                key={`pln-${i}`}
                cx={x}
                cy={y}
                r={3}
                fill="#ffffff"
                stroke="#64748b"
                strokeWidth={2}
                className="transition-transform hover:scale-125"
              />
            );
          })}

          {/* Data Points Actual */}
          {actualPoints.map((p, i) => {
            const x = getX(i);
            const y = getY(p.actual);
            const isLatest = i === actualPoints.length - 1;
            const isSelected = activeIdx === i;

            return (
              <g key={`act-${i}`} className="cursor-pointer" onClick={() => setActiveIdx(i)}>
                {isLatest && (
                  <circle
                    cx={x}
                    cy={y}
                    r={10}
                    fill="#10b981"
                    opacity={0.25}
                    className="animate-ping"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 6.5 : 5}
                  fill={p.actual >= p.planned ? '#059669' : '#e11d48'}
                  stroke="#ffffff"
                  strokeWidth={2.5}
                  className="shadow-sm transition-all"
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

