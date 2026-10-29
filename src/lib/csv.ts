import type { DimKey, GeometrySubType, InspectionSegment, MonevProject, PositionSide, StructureCategory } from '../types';
import { DIM_KEYS } from '../types';
import { CATEGORIES, POSITION_LABEL, SUBTYPES } from './templates';
import { STATUS_SHORT, sampleArea } from './calc';
import { parseNum } from './format';
import { newSegment } from './factory';

const SEP = ';';
const BOM = '\uFEFF';

const esc = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** Angka format Excel Indonesia (koma desimal) */
const num = (v: number | undefined | null, d = 3) =>
  v === undefined || v === null || !Number.isFinite(v) ? '' : v.toFixed(d).replace('.', ',');

const row = (cells: unknown[]) => cells.map(esc).join(SEP);

export const BASE_HEADERS = ['sta_code', 'structure_name', 'structure_category', 'sub_type', 'position_side', 'length_m'];

export const MC0_HEADERS = [
  ...BASE_HEADERS,
  'mc0_b', 'mc0_B', 'mc0_H', 'mc0_m', 'mc0_ta', 'mc0_tb', 'mc0_td', 'mc0_wallSides', 'mc0_unitCount', 'mc0_volume',
];

export const MC100_HEADERS = [
  ...BASE_HEADERS,
  'mc100_b', 'mc100_B', 'mc100_H', 'mc100_m', 'mc100_ta', 'mc100_tb', 'mc100_td', 'mc100_wallSides', 'mc100_unitCount', 'mc100_volume',
];

export const MC_TERPADU_HEADERS = [
  ...BASE_HEADERS,
  'mc0_b', 'mc0_B', 'mc0_H', 'mc0_m', 'mc0_ta', 'mc0_tb', 'mc0_td', 'mc0_wallSides', 'mc0_unitCount', 'mc0_volume',
  'mc100_b', 'mc100_B', 'mc100_H', 'mc100_m', 'mc100_ta', 'mc100_tb', 'mc100_td', 'mc100_wallSides', 'mc100_unitCount', 'mc100_volume',
];

const CSV_GUIDE_NOTES = [
  '',
  '# PETUNJUK PENGISIAN (baris berawalan # diabaikan saat impor)',
  '# structure_category: SALURAN_IRIGASI | BANGUNAN_PELENGKAP | SUNGAI_TANGGUL | NORMALISASI_GALIAN',
  '# sub_type: TRAPESIUM_PASANGAN_BATU | PERSEGI_BETON_FLUME | BANGUNAN_BAGI_SADAP_PINTU | BRONJONG_KAWAT | TANGGUL_REVETMENT | GALIAN_ALUR_TRAPESIUM',
  '# position_side: KIRI | KANAN | KIRI_KANAN | AS_TENGAH',
  '# length_m: panjang segmen (m); Bangunan Pelengkap = panjang sayap (m); Bronjong = bentang memanjang',
  '# mc0_volume & mc100_volume: opsional (volume kontrak dari dokumen); bila kosong dihitung dari dimensi',
  '# Pemisah kolom titik koma (;), pemisah desimal koma (,) atau titik (.)',
];

export const buildMc0Template = () => {
  const lines = [
    row(MC0_HEADERS),
    row(['STA 0+000 - 0+050', 'Saluran Sekunder ...', 'SALURAN_IRIGASI', 'TRAPESIUM_PASANGAN_BATU', 'KIRI_KANAN', '50', '1,50', '2,70', '1,20', '0,5', '0,30', '0,40', '0,20', '2', '', '']),
    row(['STA 0+050 - 0+100', 'Saluran Sekunder ...', 'SALURAN_IRIGASI', 'PERSEGI_BETON_FLUME', 'KIRI_KANAN', '50', '1,00', '', '1,00', '', '0,15', '', '0,15', '', '', '']),
    row(['BG. BLU.1', 'Bangunan Bagi ...', 'BANGUNAN_PELENGKAP', 'BANGUNAN_BAGI_SADAP_PINTU', 'AS_TENGAH', '4', '0,80', '3,00', '1,00', '', '0,30', '1,50', '0,25', '', '', '']),
  ];
  return BOM + [...lines, ...CSV_GUIDE_NOTES].join('\r\n');
};

export const buildMc100Template = () => {
  const lines = [
    row(MC100_HEADERS),
    row(['STA 0+000 - 0+050', 'Saluran Sekunder ...', 'SALURAN_IRIGASI', 'TRAPESIUM_PASANGAN_BATU', 'KIRI_KANAN', '50', '1,50', '2,70', '1,20', '0,5', '0,30', '0,40', '0,20', '2', '', '']),
    row(['STA 0+050 - 0+100', 'Saluran Sekunder ...', 'SALURAN_IRIGASI', 'PERSEGI_BETON_FLUME', 'KIRI_KANAN', '50', '1,00', '', '1,00', '', '0,15', '', '0,15', '', '', '']),
    row(['BG. BLU.1', 'Bangunan Bagi ...', 'BANGUNAN_PELENGKAP', 'BANGUNAN_BAGI_SADAP_PINTU', 'AS_TENGAH', '4', '0,80', '3,00', '1,00', '', '0,30', '1,50', '0,25', '', '', '']),
  ];
  return BOM + [...lines, ...CSV_GUIDE_NOTES].join('\r\n');
};

export const buildMcTerpaduTemplate = () => {
  const lines = [
    row(MC_TERPADU_HEADERS),
    row([
      'STA 0+000 - 0+050', 'Saluran Sekunder ...', 'SALURAN_IRIGASI', 'TRAPESIUM_PASANGAN_BATU', 'KIRI_KANAN', '50',
      // MC-0 (Rekayasa Awal)
      '1,40', '2,60', '1,20', '0,5', '0,30', '0,40', '0,20', '2', '', '',
      // MC-100 (Kaji Ulang Akhir)
      '1,50', '2,70', '1,20', '0,5', '0,30', '0,40', '0,20', '2', '', '',
    ]),
  ];
  return BOM + [...lines, ...CSV_GUIDE_NOTES].join('\r\n');
};

/** Parser CSV sederhana dengan dukungan tanda kutip; deteksi otomatis pemisah ; , atau tab */
export const parseCsv = (text: string): string[][] => {
  const t = text.replace(/^\uFEFF/, '');
  const firstLine = t.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#')) ?? '';
  const counts = [';', ',', '\t'].map((s) => ({ s, c: firstLine.split(s).length }));
  const sep = counts.sort((a, b) => b.c - a.c)[0].s;
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { cur.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      cur.push(cell); rows.push(cur); cur = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || cur.length) { cur.push(cell); rows.push(cur); }
  return rows.filter((r) => r.some((c) => c.trim() !== '') && !r[0]?.trim().startsWith('#'));
};

export interface ImportResult {
  segments: InspectionSegment[];
  errors: string[];
  mode: 'MC0' | 'MC100' | 'TERPADU';
}

const SUBTYPE_IDS = Object.keys(SUBTYPES) as GeometrySubType[];
const SIDES: PositionSide[] = ['KIRI', 'KANAN', 'KIRI_KANAN', 'AS_TENGAH'];

/** Impor Cerdas CSV: otomatis mendeteksi kolom MC-0, MC-100, atau Terpadu */
export const importCsv = (text: string, tol: number): ImportResult => {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length < 2) return { segments: [], errors: ['Berkas CSV tidak memuat baris data.'], mode: 'MC100' };

  const head = rows[0].map((h) => h.trim());
  const idx = (k: string) => head.indexOf(k);

  if (idx('sta_code') < 0 || idx('sub_type') < 0) {
    return { segments: [], errors: ['Kolom wajib "sta_code" dan "sub_type" tidak ditemukan pada berkas CSV.'], mode: 'MC100' };
  }

  const hasMc0 = head.some((h) => h.startsWith('mc0_'));
  const hasMc100 = head.some((h) => h.startsWith('mc100_'));
  const mode: 'MC0' | 'MC100' | 'TERPADU' = hasMc0 && hasMc100 ? 'TERPADU' : hasMc0 ? 'MC0' : 'MC100';

  const segments: InspectionSegment[] = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (k: string) => (idx(k) >= 0 ? (r[idx(k)] ?? '').trim() : '');
    const sta = get('sta_code');
    const subType = get('sub_type').toUpperCase() as GeometrySubType;
    if (!sta) { errors.push(`Baris ${line}: sta_code kosong, dilewati.`); return; }
    if (!SUBTYPE_IDS.includes(subType)) { errors.push(`Baris ${line} (${sta}): sub_type "${get('sub_type')}" tidak dikenal, dilewati.`); return; }

    const catIn = get('structure_category').toUpperCase() as StructureCategory;
    if (catIn && CATEGORIES[catIn] && catIn !== SUBTYPES[subType].category) {
      errors.push(`Baris ${line} (${sta}): structure_category disesuaikan menjadi ${SUBTYPES[subType].category} mengikuti sub_type.`);
    }

    const sideIn = get('position_side').toUpperCase() as PositionSide;

    const mc0: Record<string, number> = {};
    const mc100: Record<string, number> = {};

    for (const k of DIM_KEYS) {
      const v0 = parseNum(get(`mc0_${k}`));
      if (v0 !== undefined) mc0[k] = v0;
      const v100 = parseNum(get(`mc100_${k}`));
      if (v100 !== undefined) mc100[k] = v100;
    }

    const vol0 = parseNum(get('mc0_volume'));
    const vol100 = parseNum(get('mc100_volume'));

    const sourceTag = mode === 'TERPADU' ? 'IMPORT_MC_TERPADU' : mode === 'MC0' ? 'IMPORT_MC0' : 'IMPORT_MC100';

    segments.push(newSegment({
      staCode: sta,
      structureName: get('structure_name'),
      subType,
      positionSide: SIDES.includes(sideIn) ? sideIn : 'KIRI_KANAN',
      length: parseNum(get('length_m')) ?? 0,
      mc0: Object.keys(mc0).length ? mc0 : undefined,
      mc0VolumeContractM3: vol0 ?? null,
      mc100: Object.keys(mc100).length ? mc100 : Object.keys(mc0).length ? mc0 : {},
      mc100VolumeContractM3: vol100 ?? null,
      dataSource: sourceTag,
      tol,
    }));
  });

  return { segments, errors, mode };
};

/** Alias kompatibilitas mundur untuk importMc100 */
export const importMc100 = (text: string, tol: number): ImportResult => importCsv(text, tol);

/** Ekspor Lembar Audit Terpadu 3-Pilar (MC-0 vs MC-100 vs Aktual) */
export const buildOpnameCsv = (p: MonevProject) => {
  const head = [
    'jenis_baris', 'no', 'sta_code', 'nama_bangunan', 'kategori', 'sub_tipe', 'acuan', 'posisi', 'sumber_data', 'L_meter',
    // MC-0
    ...DIM_KEYS.map((k) => `mc0_${k}`),
    'A_mc0_m2', 'V_mc0_m3',
    // MC-100
    ...DIM_KEYS.map((k) => `mc100_${k}`),
    'A_mc100_m2', 'V_mc100_m3',
    // CCO Variance
    'variasi_cco_m3', 'variasi_cco_persen',
    // Realisasi Aktual
    'label_sampel', 'status_sampel', 'offset_m', ...DIM_KEYS.map((k) => `aktual_${k}`), 'catatan_sampel',
    'A_aktual_m2', 'V_aktual_m3', 'deviasi_V_m3', 'capaian_persen', 'parameter_kurang_dimensi', 'status_evaluasi',
    'checklist_sesuai', 'checklist_tidak_sesuai', 'jumlah_cacat_mutu', 'kode_cacat_mutu',
  ];
  const lines = [row(head)];
  const dims = (d: Partial<Record<DimKey, number>> | undefined, keys: DimKey[]) =>
    DIM_KEYS.map((k) => (d && keys.includes(k) ? num(d[k], 3) : ''));

  p.segments.forEach((s, i) => {
    const st = SUBTYPES[s.subType];
    const keys = st.fields.map((f) => f.key);
    const defects = s.defects.filter((d) => d.entryType === 'CACAT_MUTU');
    const sourceLabel =
      s.dataSource === 'IMPORT_MC_TERPADU'
        ? 'Impor Terpadu (MC-0 & MC-100)'
        : s.dataSource === 'IMPORT_MC0'
          ? 'Impor MC-0'
          : s.dataSource === 'IMPORT_MC100'
            ? 'Impor MC-100'
            : 'Input Lapangan';

    const base = [
      i + 1, s.staCode, s.structureName, CATEGORIES[s.category].label, st.label, CATEGORIES[s.category].reference, POSITION_LABEL[s.positionSide],
      sourceLabel, num(s.segmentLengthMeter, 2),
    ];

    lines.push(row([
      'STA_RERATA', ...base,
      // MC-0
      ...dims(s.mc0Dimensions ?? s.mc100Dimensions, keys),
      num(s.mc0CrossSectionAreaM2), num(s.mc0VolumeM3),
      // MC-100
      ...dims(s.mc100Dimensions, keys),
      num(s.mc100CrossSectionAreaM2), num(s.mc100VolumeM3),
      // CCO
      num(s.volumeCcoVarianceM3), num(s.volumeCcoVariancePercent, 2),
      // Aktual
      'Rerata Terpilih', `${s.samples.filter((x) => x.isSelected).length} dari ${s.samples.length} sampel`, '', ...dims(s.averagedActualDimensions, keys), s.inspectorNotes ?? '',
      num(s.actualCrossSectionAreaM2), num(s.actualVolumeM3), num(s.volumeDeviationM3), num(s.volumeAchievementPercent, 2),
      s.averageDeficitParams.join(', '), STATUS_SHORT[s.evaluationStatus],
      s.visualChecklist.filter((c) => c.status === 'SESUAI').length, s.visualChecklist.filter((c) => c.status === 'TIDAK_SESUAI').length,
      defects.length, defects.map((d) => d.defectCode).join(', '),
    ]));

    s.samples.forEach((smp) => {
      lines.push(row([
        'SAMPEL', ...base,
        // Empty MC0 & MC100 for sample rows
        ...DIM_KEYS.map(() => ''), '', '',
        ...DIM_KEYS.map(() => ''), '', '',
        '', '',
        // Sample Details
        smp.sampleLabel, smp.isSelected ? '[✓] Direrata' : '[x] Diabaikan', num(smp.offsetMeter, 2), ...dims(smp.dimensions, keys), smp.sampleNote ?? '',
        num(sampleArea(s, smp)), '', '', '', '', '', '', '', '', '',
      ]));
    });
  });

  return BOM + lines.join('\r\n');
};
