import type { DimKey, GeometrySubType, InspectionSegment, PHOProject, PositionSide, StructureCategory } from '../types';
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

export const MC100_HEADERS = [
  'sta_code', 'structure_name', 'structure_category', 'sub_type', 'position_side', 'length_m',
  'mc100_b', 'mc100_B', 'mc100_H', 'mc100_m', 'mc100_ta', 'mc100_tb', 'mc100_td', 'mc100_wallSides', 'mc100_unitCount', 'mc100_volume',
];

export const buildMc100Template = () => {
  const lines = [
    row(MC100_HEADERS),
    row(['STA 0+000 - 0+050', 'Saluran Sekunder ...', 'SALURAN_IRIGASI', 'TRAPESIUM_PASANGAN_BATU', 'KIRI_KANAN', '50', '1,50', '2,70', '1,20', '0,5', '0,30', '0,40', '0,20', '2', '', '']),
    row(['STA 0+050 - 0+100', 'Saluran Sekunder ...', 'SALURAN_IRIGASI', 'PERSEGI_BETON_FLUME', 'KIRI_KANAN', '50', '1,00', '', '1,00', '', '0,15', '', '0,15', '', '', '']),
    row(['BG. BLU.1', 'Bangunan Bagi ...', 'BANGUNAN_PELENGKAP', 'BANGUNAN_BAGI_SADAP_PINTU', 'AS_TENGAH', '4', '0,80', '3,00', '1,00', '', '0,30', '1,50', '0,25', '', '', '']),
    row(['STA 2+000 - 2+020', 'Perkuatan Tebing ...', 'SUNGAI_TANGGUL', 'BRONJONG_KAWAT', 'KANAN', '10', '2,00', '1,00', '0,50', '', '', '', '', '', '3', '']),
    row(['STA 2+100 - 2+200', 'Tanggul ...', 'SUNGAI_TANGGUL', 'TANGGUL_REVETMENT', 'KIRI', '100', '6,00', '3,00', '2,00', '', '0,50', '', '1,00', '', '', '']),
    row(['STA 3+000 - 3+100', 'Normalisasi ...', 'NORMALISASI_GALIAN', 'GALIAN_ALUR_TRAPESIUM', 'AS_TENGAH', '100', '3,00', '6,00', '', '1,0', '', '', '1,50', '', '', '']),
  ];
  const notes = [
    '',
    '# PETUNJUK PENGISIAN (baris berawalan # diabaikan saat impor)',
    '# structure_category: SALURAN_IRIGASI | BANGUNAN_PELENGKAP | SUNGAI_TANGGUL | NORMALISASI_GALIAN',
    '# sub_type: TRAPESIUM_PASANGAN_BATU | PERSEGI_BETON_FLUME | BANGUNAN_BAGI_SADAP_PINTU | BRONJONG_KAWAT | TANGGUL_REVETMENT | GALIAN_ALUR_TRAPESIUM',
    '# position_side: KIRI | KANAN | KIRI_KANAN | AS_TENGAH',
    '# length_m: panjang segmen (m); Bangunan Pelengkap = panjang dinding sayap (m); Bronjong = jumlah bentang memanjang',
    '# Bangunan Pelengkap: b=lebar bukaan; H=tinggi bukaan; ta=tebal dinding sayap; tb=tinggi dinding sayap; B=panjang lantai kolam olak; td=tebal lantai',
    '# Bronjong: b=panjang kotak; B=lebar kotak; H=tinggi kotak; unitCount=jumlah susunan kotak melintang',
    '# Tanggul/Revetment: B=lebar mercu; b=lebar dasar kaki; H=tinggi; td=kedalaman koperan; ta=tebal koperan',
    '# Galian: b=lebar dasar; B=lebar atas; td=kedalaman galian; m=kemiringan tebing',
    '# mc100_volume: opsional (volume kontrak MC-100 dari dokumen); bila kosong dihitung dari dimensi',
    '# Pemisah kolom titik koma (;), desimal koma (,) atau titik (.)',
  ];
  return BOM + [...lines, ...notes].join('\r\n');
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
}

const SUBTYPE_IDS = Object.keys(SUBTYPES) as GeometrySubType[];
const SIDES: PositionSide[] = ['KIRI', 'KANAN', 'KIRI_KANAN', 'AS_TENGAH'];

export const importMc100 = (text: string, tol: number): ImportResult => {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length < 2) return { segments: [], errors: ['Berkas CSV tidak memuat baris data.'] };
  const head = rows[0].map((h) => h.trim());
  const idx = (k: string) => head.indexOf(k);
  if (idx('sta_code') < 0 || idx('sub_type') < 0) return { segments: [], errors: ['Kolom wajib "sta_code" dan "sub_type" tidak ditemukan. Gunakan Template CSV MC-100.'] };
  const segments: InspectionSegment[] = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (k: string) => (idx(k) >= 0 ? (r[idx(k)] ?? '').trim() : '');
    const sta = get('sta_code');
    const subType = get('sub_type').toUpperCase() as GeometrySubType;
    if (!sta) { errors.push(`Baris ${line}: sta_code kosong, dilewati.`); return; }
    if (!SUBTYPE_IDS.includes(subType)) { errors.push(`Baris ${line} (${sta}): sub_type "${get('sub_type')}" tidak dikenal, dilewati.`); return; }
    const catIn = get('structure_category').toUpperCase() as StructureCategory;
    if (catIn && CATEGORIES[catIn] && catIn !== SUBTYPES[subType].category)
      errors.push(`Baris ${line} (${sta}): structure_category disesuaikan menjadi ${SUBTYPES[subType].category} mengikuti sub_type.`);
    const sideIn = get('position_side').toUpperCase() as PositionSide;
    const mc: Record<string, number> = {};
    for (const k of DIM_KEYS) {
      const v = parseNum(get(`mc100_${k}`));
      if (v !== undefined) mc[k] = v;
    }
    const vol = parseNum(get('mc100_volume'));
    segments.push(newSegment({
      staCode: sta,
      structureName: get('structure_name'),
      subType,
      positionSide: SIDES.includes(sideIn) ? sideIn : 'KIRI_KANAN',
      length: parseNum(get('length_m')) ?? 0,
      mc100: mc,
      dataSource: 'IMPORT_MC100',
      mc100VolumeContractM3: vol ?? null,
      tol,
    }));
  });
  return { segments, errors };
};

export const buildOpnameCsv = (p: PHOProject) => {
  const head = [
    'jenis_baris', 'no', 'sta_code', 'nama_bangunan', 'kategori', 'sub_tipe', 'acuan', 'posisi', 'sumber_data', 'L',
    ...DIM_KEYS.map((k) => `mc100_${k}`),
    'label_sampel', 'status_sampel', 'offset_m', ...DIM_KEYS.map((k) => `aktual_${k}`), 'catatan_sampel',
    'A_mc100_m2', 'A_aktual_m2', 'V_mc100_m3', 'V_aktual_m3', 'deviasi_V_m3', 'capaian_persen', 'parameter_kurang_dimensi', 'status_evaluasi',
    'checklist_sesuai', 'checklist_tidak_sesuai', 'jumlah_cacat_mutu', 'kode_cacat_mutu',
  ];
  const lines = [row(head)];
  const dims = (d: Partial<Record<DimKey, number>>, keys: DimKey[]) => DIM_KEYS.map((k) => (keys.includes(k) ? num(d[k], 3) : ''));
  p.segments.forEach((s, i) => {
    const st = SUBTYPES[s.subType];
    const keys = st.fields.map((f) => f.key);
    const defects = s.defects.filter((d) => d.entryType === 'CACAT_MUTU');
    const base = [i + 1, s.staCode, s.structureName, CATEGORIES[s.category].label, st.label, CATEGORIES[s.category].reference, POSITION_LABEL[s.positionSide],
      s.dataSource === 'IMPORT_MC100' ? 'Impor MC-100' : 'Input Lapangan', num(s.segmentLengthMeter, 2)];
    lines.push(row([
      'STA_RERATA', ...base, ...dims(s.mc100Dimensions, keys),
      'Rerata Terpilih', `${s.samples.filter((x) => x.isSelected).length} dari ${s.samples.length} sampel`, '', ...dims(s.averagedActualDimensions, keys), s.inspectorNotes ?? '',
      num(s.mc100CrossSectionAreaM2), num(s.actualCrossSectionAreaM2), num(s.mc100VolumeM3), num(s.actualVolumeM3), num(s.volumeDeviationM3), num(s.volumeAchievementPercent, 2),
      s.averageDeficitParams.join(', '), STATUS_SHORT[s.evaluationStatus],
      s.visualChecklist.filter((c) => c.status === 'SESUAI').length, s.visualChecklist.filter((c) => c.status === 'TIDAK_SESUAI').length,
      defects.length, defects.map((d) => d.defectCode).join(', '),
    ]));
    s.samples.forEach((smp) => {
      lines.push(row([
        'SAMPEL', ...base, ...DIM_KEYS.map(() => ''),
        smp.sampleLabel, smp.isSelected ? '[✓] Direrata' : '[x] Diabaikan', num(smp.offsetMeter, 2), ...dims(smp.dimensions, keys), smp.sampleNote ?? '',
        '', num(sampleArea(s, smp)), '', '', '', '', '', '', '', '', '', '',
      ]));
    });
  });
  return BOM + lines.join('\r\n');
};
