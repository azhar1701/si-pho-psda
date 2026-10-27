import type { DimKey, DimensionSet, GeometrySubType, Severity, StructureCategory } from '../types';

export interface FieldDef {
  key: DimKey;
  symbol: string;
  label: string;
  unit: string;
  /** dim = dimensi (diuji deviasi), count = jumlah (diuji deviasi), ratio = kemiringan (tidak diuji kurang dimensi) */
  kind: 'dim' | 'count' | 'ratio';
  step?: number;
}

export interface SubTypeDef {
  id: GeometrySubType;
  category: StructureCategory;
  label: string;
  shortLabel: string;
  lengthLabel: string;
  lengthUnit: string;
  fields: FieldDef[];
  formulaText: string[];
  area: (d: DimensionSet) => number;
  volume: (d: DimensionSet, L: number) => number;
  /** Luas penampang basah/hidraulis (hanya saluran trapesium) */
  wetArea?: (d: DimensionSet) => number;
}

export interface CategoryDef {
  id: StructureCategory;
  label: string;
  code: string;
  reference: string;
  subTypes: GeometrySubType[];
  checklist: { parameterName: string; standardRef: string }[];
}

const n = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export const SUBTYPES: Record<GeometrySubType, SubTypeDef> = {
  TRAPESIUM_PASANGAN_BATU: {
    id: 'TRAPESIUM_PASANGAN_BATU',
    category: 'SALURAN_IRIGASI',
    label: 'Saluran Trapesium Pasangan Batu Kali / Lining',
    shortLabel: 'Trapesium Pas. Batu',
    lengthLabel: 'Panjang segmen antar-STA (L)',
    lengthUnit: 'm',
    fields: [
      { key: 'b', symbol: 'b', label: 'Lebar dasar bersih saluran', unit: 'm', kind: 'dim' },
      { key: 'B', symbol: 'B', label: 'Lebar bukaan atas saluran', unit: 'm', kind: 'dim' },
      { key: 'H', symbol: 'H', label: 'Tinggi vertikal saluran (termasuk tinggi jagaan)', unit: 'm', kind: 'dim' },
      { key: 'm', symbol: 'm', label: 'Kemiringan talud (1 : m)', unit: '-', kind: 'ratio' },
      { key: 'ta', symbol: 'ta', label: 'Tebal puncak dinding / koperan atas', unit: 'm', kind: 'dim' },
      { key: 'tb', symbol: 'tb', label: 'Tebal dasar dinding pasangan', unit: 'm', kind: 'dim' },
      { key: 'td', symbol: 'td', label: 'Tebal lantai dasar (0 bila tanpa lantai)', unit: 'm', kind: 'dim' },
      { key: 'wallSides', symbol: 'n', label: 'Jumlah sisi dinding terpasang (1 / 2)', unit: 'sisi', kind: 'count', step: 1 },
    ],
    formulaText: [
      'S = H × √(1 + m²)',
      'A dinding = n × ((ta + tb) / 2) × S',
      'A lantai = b × td',
      'A struktur = A dinding + A lantai',
      'A hidraulis = ((b + B) / 2) × H',
      'V = A struktur × L',
    ],
    area: (d) => {
      const S = n(d.H) * Math.sqrt(1 + n(d.m) * n(d.m));
      const wall = n(d.wallSides) * ((n(d.ta) + n(d.tb)) / 2) * S;
      const floor = n(d.b) * n(d.td);
      return wall + floor;
    },
    volume: (d, L) => SUBTYPES.TRAPESIUM_PASANGAN_BATU.area(d) * n(L),
    wetArea: (d) => ((n(d.b) + n(d.B)) / 2) * n(d.H),
  },
  PERSEGI_BETON_FLUME: {
    id: 'PERSEGI_BETON_FLUME',
    category: 'SALURAN_IRIGASI',
    label: 'Saluran Persegi Beton Bertulang / Flume / U-Ditch',
    shortLabel: 'Persegi Beton / Flume',
    lengthLabel: 'Panjang segmen antar-STA (L)',
    lengthUnit: 'm',
    fields: [
      { key: 'b', symbol: 'b', label: 'Lebar bersih dalam', unit: 'm', kind: 'dim' },
      { key: 'H', symbol: 'H', label: 'Tinggi bersih dalam', unit: 'm', kind: 'dim' },
      { key: 'ta', symbol: 'tw', label: 'Tebal dinding samping', unit: 'm', kind: 'dim' },
      { key: 'td', symbol: 'tf', label: 'Tebal pelat lantai', unit: 'm', kind: 'dim' },
    ],
    formulaText: ['A struktur = (2 × H × tw) + ((b + 2 × tw) × tf)', 'V = A struktur × L'],
    area: (d) => 2 * n(d.H) * n(d.ta) + (n(d.b) + 2 * n(d.ta)) * n(d.td),
    volume: (d, L) => SUBTYPES.PERSEGI_BETON_FLUME.area(d) * n(L),
  },
  BANGUNAN_BAGI_SADAP_PINTU: {
    id: 'BANGUNAN_BAGI_SADAP_PINTU',
    category: 'BANGUNAN_PELENGKAP',
    label: 'Bangunan Bagi/Sadap, Pintu Air, Gorong-gorong, Talang, Terjunan, Kolam Olak',
    shortLabel: 'Bangunan Bagi/Sadap/Pintu',
    lengthLabel: 'Panjang dinding sayap (L)',
    lengthUnit: 'm',
    fields: [
      { key: 'b', symbol: 'b', label: 'Lebar bersih bukaan / pintu', unit: 'm', kind: 'dim' },
      { key: 'H', symbol: 'H', label: 'Tinggi bukaan / daun pintu', unit: 'm', kind: 'dim' },
      { key: 'ta', symbol: 'ta', label: 'Tebal dinding sayap', unit: 'm', kind: 'dim' },
      { key: 'tb', symbol: 'tb', label: 'Tinggi dinding sayap', unit: 'm', kind: 'dim' },
      { key: 'B', symbol: 'B', label: 'Panjang lantai kolam olak / lantai muka', unit: 'm', kind: 'dim' },
      { key: 'td', symbol: 'td', label: 'Tebal lantai', unit: 'm', kind: 'dim' },
    ],
    formulaText: ['A = (2 × ta × tb) + (b × td)', 'V = (2 × ta × tb × L) + (b × B × td)'],
    area: (d) => 2 * n(d.ta) * n(d.tb) + n(d.b) * n(d.td),
    volume: (d, L) => 2 * n(d.ta) * n(d.tb) * n(L) + n(d.b) * n(d.B) * n(d.td),
  },
  BRONJONG_KAWAT: {
    id: 'BRONJONG_KAWAT',
    category: 'SUNGAI_TANGGUL',
    label: 'Struktur Bronjong Kawat (Gabion)',
    shortLabel: 'Bronjong Kawat',
    lengthLabel: 'Jumlah bentang memanjang (L)',
    lengthUnit: 'bentang',
    fields: [
      { key: 'b', symbol: 'b', label: 'Panjang kotak bronjong', unit: 'm', kind: 'dim' },
      { key: 'B', symbol: 'B', label: 'Lebar kotak bronjong', unit: 'm', kind: 'dim' },
      { key: 'H', symbol: 'H', label: 'Tinggi kotak bronjong', unit: 'm', kind: 'dim' },
      { key: 'unitCount', symbol: 'N', label: 'Jumlah susunan kotak melintang', unit: 'unit', kind: 'count', step: 1 },
    ],
    formulaText: ['A = B × H × N', 'V = b × B × H × N × L'],
    area: (d) => n(d.B) * n(d.H) * n(d.unitCount),
    volume: (d, L) => n(d.b) * n(d.B) * n(d.H) * n(d.unitCount) * n(L),
  },
  TANGGUL_REVETMENT: {
    id: 'TANGGUL_REVETMENT',
    category: 'SUNGAI_TANGGUL',
    label: 'Tanggul Banjir / Perkuatan Tebing (Revetment)',
    shortLabel: 'Tanggul / Revetment',
    lengthLabel: 'Panjang segmen (L)',
    lengthUnit: 'm',
    fields: [
      { key: 'B', symbol: 'B', label: 'Lebar mercu tanggul', unit: 'm', kind: 'dim' },
      { key: 'b', symbol: 'b', label: 'Lebar dasar kaki', unit: 'm', kind: 'dim' },
      { key: 'H', symbol: 'H', label: 'Tinggi tanggul', unit: 'm', kind: 'dim' },
      { key: 'td', symbol: 'td', label: 'Kedalaman koperan kaki', unit: 'm', kind: 'dim' },
      { key: 'ta', symbol: 'ta', label: 'Tebal koperan', unit: 'm', kind: 'dim' },
    ],
    formulaText: ['A = (((B + b) / 2) × H) + (td × ta)', 'V = A × L'],
    area: (d) => ((n(d.B) + n(d.b)) / 2) * n(d.H) + n(d.td) * n(d.ta),
    volume: (d, L) => SUBTYPES.TANGGUL_REVETMENT.area(d) * n(L),
  },
  GALIAN_ALUR_TRAPESIUM: {
    id: 'GALIAN_ALUR_TRAPESIUM',
    category: 'NORMALISASI_GALIAN',
    label: 'Galian Alur Penampang Trapesium',
    shortLabel: 'Galian Alur Trapesium',
    lengthLabel: 'Panjang segmen normalisasi (L)',
    lengthUnit: 'm',
    fields: [
      { key: 'b', symbol: 'b', label: 'Lebar dasar alur galian', unit: 'm', kind: 'dim' },
      { key: 'B', symbol: 'B', label: 'Lebar atas alur galian', unit: 'm', kind: 'dim' },
      { key: 'td', symbol: 'd', label: 'Kedalaman galian aktual dari dasar eksisting', unit: 'm', kind: 'dim' },
      { key: 'm', symbol: 'm', label: 'Kemiringan tebing galian (1 : m)', unit: '-', kind: 'ratio' },
    ],
    formulaText: ['A galian = ((b + B) / 2) × d', 'V = A galian × L'],
    area: (d) => ((n(d.b) + n(d.B)) / 2) * n(d.td),
    volume: (d, L) => SUBTYPES.GALIAN_ALUR_TRAPESIUM.area(d) * n(L),
  },
};

export const CATEGORIES: Record<StructureCategory, CategoryDef> = {
  SALURAN_IRIGASI: {
    id: 'SALURAN_IRIGASI',
    label: 'Saluran Irigasi & Drainase',
    code: 'SAL',
    reference: 'KP-03 Saluran & KP-07 Standar Penggambaran',
    subTypes: ['TRAPESIUM_PASANGAN_BATU', 'PERSEGI_BETON_FLUME'],
    checklist: [
      { parameterName: 'Kerapian dan keutuhan siaran mortar (1 PC : 2 PP) bebas retak/terkelupas', standardRef: 'KP-03' },
      { parameterName: 'Kerataan dan ketebalan plesteran bidang puncak/dinding (1 PC : 3 PP)', standardRef: 'KP-03' },
      { parameterName: 'Kepadatan pasangan batu/beton bebas rongga kosong (honeycomb)', standardRef: 'KP-03' },
      { parameterName: 'Keberadaan, jarak, dan kelancaran pipa sulingan (weep hole Ø 50 mm + filter ijuk/geotekstil, tidak tersumbat mortar)', standardRef: 'KP-03' },
      { parameterName: 'Keutuhan celah siar muai (expansion joint / dilatasi) beserta bahan pengisi', standardRef: 'KP-03' },
      { parameterName: 'Kesesuaian kelandaian dasar saluran (bed slope) dan alinyemen horizontal', standardRef: 'KP-03 / KP-07' },
    ],
  },
  BANGUNAN_PELENGKAP: {
    id: 'BANGUNAN_PELENGKAP',
    label: 'Bangunan Pelengkap & Bangunan Utama',
    code: 'BGN',
    reference: 'KP-02 Bangunan Utama & KP-04 Bangunan',
    subTypes: ['BANGUNAN_BAGI_SADAP_PINTU'],
    checklist: [
      { parameterName: 'Uji operasional stang/ulir pengangkat pintu air lancar dari tertutup penuh hingga terbuka penuh', standardRef: 'KP-04' },
      { parameterName: 'Uji kerapatan daun pintu air pada posisi tertutup (bebas bocoran/rembesan)', standardRef: 'KP-04' },
      { parameterName: 'Kondisi pelumasan ulir, cat anti-karat rangka pintu, dan pengaman', standardRef: 'KP-04' },
      { parameterName: 'Keutuhan karet penahan air (waterstop) pada sambungan beton', standardRef: 'KP-02 / KP-04' },
      { parameterName: 'Keterbacaan dan ketepatan elevasi papan duga muka air (peilschaal)', standardRef: 'KP-04' },
      { parameterName: 'Kelengkapan pelat nomenklatur bangunan / prasasti', standardRef: 'KP-04' },
    ],
  },
  SUNGAI_TANGGUL: {
    id: 'SUNGAI_TANGGUL',
    label: 'Sungai & Pengendali Banjir (Tanggul, Revetment, Bronjong)',
    code: 'SNG',
    reference: 'SNI 1724:2015 & SNI 2406 Bronjong Kawat',
    subTypes: ['BRONJONG_KAWAT', 'TANGGUL_REVETMENT'],
    checklist: [
      { parameterName: 'Kepadatan pengisian batu bronjong (ukuran batu > mata anyaman, padat, minim rongga)', standardRef: 'SNI 2406' },
      { parameterName: 'Keutuhan kawat anyaman heksagonal lilitan ganda galvanis/PVC (bebas putus/karat)', standardRef: 'SNI 2406' },
      { parameterName: 'Kekuatan ikatan kawat pengunci antar-unit bronjong dan diafragma internal', standardRef: 'SNI 2406' },
      { parameterName: 'Kerataan mercu tanggul bebas penurunan lokal (settlement) atau retak memanjang', standardRef: 'SNI 1724:2015' },
      { parameterName: 'Keamanan koperan kaki bangunan terhadap indikasi gerusan lokal (local scouring)', standardRef: 'SNI 1724:2015' },
    ],
  },
  NORMALISASI_GALIAN: {
    id: 'NORMALISASI_GALIAN',
    label: 'Normalisasi & Galian Alur Sungai / Saluran Pembuang',
    code: 'GAL',
    reference: 'KP-03, KP-05 & SE Dirjen SDA',
    subTypes: ['GALIAN_ALUR_TRAPESIUM'],
    checklist: [
      { parameterName: 'Kerataan kemiringan dasar galian (bed slope) bebas gundukan sedimen tersisa', standardRef: 'KP-03 / KP-05' },
      { parameterName: 'Stabilitas kemiringan tebing galian bebas kelongsoran (bank sliding)', standardRef: 'KP-05' },
      { parameterName: 'Pembersihan dan penataan tanah hasil galian (spoil bank) pada jarak aman dari bibir tebing', standardRef: 'SE Dirjen SDA' },
    ],
  },
};

export const CATEGORY_ORDER: StructureCategory[] = ['SALURAN_IRIGASI', 'BANGUNAN_PELENGKAP', 'SUNGAI_TANGGUL', 'NORMALISASI_GALIAN'];

export const POSITION_LABEL = {
  KIRI: 'Kiri',
  KANAN: 'Kanan',
  KIRI_KANAN: 'Kiri - Kanan',
  AS_TENGAH: 'As / Tengah',
} as const;

export interface DefectPreset {
  code: string;
  title: string;
  categories: StructureCategory[] | 'ALL';
  severity: Severity;
  finding: string;
  repair: string;
  affected: string;
  dueDays: number;
}

/** Pustaka Klasifikasi Cacat Mutu Baku PSDA (luring / offline fallback) */
export const DEFECT_PRESETS: DefectPreset[] = [
  { code: 'SAL-01', title: 'Siaran Pasangan Batu Retak / Terkelupas', categories: ['SALURAN_IRIGASI', 'BANGUNAN_PELENGKAP'], severity: 'MINOR',
    finding: 'Siaran mortar pada bidang pasangan batu retak dan terlepas dari celah antar-batu.',
    repair: 'Bongkar siaran rapuh, bersihkan celah pasangan batu, dan lakukan siar ulang dengan campuran mortar 1 PC : 2 PP.', affected: 'Luas ± 0,00 m²', dueDays: 14 },
  { code: 'SAL-02', title: 'Pipa Sulingan (Weep Hole) Tersumbat / Tidak Terpasang', categories: ['SALURAN_IRIGASI', 'BANGUNAN_PELENGKAP'], severity: 'MAYOR',
    finding: 'Pipa sulingan tersumbat mortar atau tidak terpasang pada jarak sesuai gambar kerja.',
    repair: 'Bor dan bersihkan pipa sulingan Ø 50 mm hingga tembus ke timbunan belakang, pasang filter ijuk/geotekstil pada sisi hulu pipa; pasang pipa baru pada titik yang belum terpasang.', affected: '0 Titik Sulingan', dueDays: 14 },
  { code: 'SAL-03', title: 'Plesteran Retak / Bergelombang / Terkelupas', categories: ['SALURAN_IRIGASI', 'BANGUNAN_PELENGKAP'], severity: 'MINOR',
    finding: 'Plesteran bidang puncak/dinding retak rambut, bergelombang, atau terkelupas dari permukaan pasangan.',
    repair: 'Kupas plesteran yang rusak, kasarkan dan basahi permukaan, plester ulang dengan campuran 1 PC : 3 PP sesuai tebal rencana, lakukan perawatan (curing) minimal 7 hari.', affected: 'Luas ± 0,00 m²', dueDays: 14 },
  { code: 'SAL-04', title: 'Siar Muai (Dilatasi) Tidak Berfungsi / Bahan Pengisi Lepas', categories: ['SALURAN_IRIGASI', 'BANGUNAN_PELENGKAP'], severity: 'MINOR',
    finding: 'Celah siar muai tertutup mortar atau bahan pengisi celah terlepas.',
    repair: 'Bersihkan celah siar muai dari mortar dan kotoran, isi ulang bahan pengisi celah sesuai spesifikasi teknis kontrak.', affected: '0 Titik Dilatasi', dueDays: 14 },
  { code: 'SAL-05', title: 'Pasangan Batu Berongga / Mortar Tidak Penuh', categories: ['SALURAN_IRIGASI', 'BANGUNAN_PELENGKAP'], severity: 'MAYOR',
    finding: 'Terdapat rongga antar-batu pada pasangan; mortar pengisi tidak penuh.',
    repair: 'Bongkar pasangan batu pada area berongga, pasang ulang batu dengan mortar penuh sesuai campuran spesifikasi teknis kontrak, lalu siar ulang 1 PC : 2 PP.', affected: 'Luas ± 0,00 m²', dueDays: 21 },
  { code: 'BET-01', title: 'Beton Keropos (Honeycomb)', categories: ['SALURAN_IRIGASI', 'BANGUNAN_PELENGKAP'], severity: 'MAYOR',
    finding: 'Permukaan beton keropos dengan agregat kasar terekspos akibat pemadatan tidak sempurna.',
    repair: 'Bobok bagian beton keropos hingga mencapai beton padat, bersihkan dan basahi permukaan, tambal dengan mortar non-shrink grout; bila tulangan terekspos lakukan pembersihan karat sebelum penambalan.', affected: 'Luas ± 0,00 m²', dueDays: 21 },
  { code: 'BET-02', title: 'Retak Struktural Beton', categories: ['SALURAN_IRIGASI', 'BANGUNAN_PELENGKAP'], severity: 'KRITIS',
    finding: 'Retak tembus pada elemen beton dengan lebar celah ≥ 0,3 mm.',
    repair: 'Petakan panjang dan lebar retak, lakukan injeksi epoksi bertekanan rendah, evaluasi penyebab retak oleh Direksi Teknis sebelum penutupan.', affected: 'Panjang retak ± 0,00 m', dueDays: 30 },
  { code: 'PNT-01', title: 'Kebocoran Daun Pintu Air pada Posisi Tertutup', categories: ['BANGUNAN_PELENGKAP'], severity: 'MAYOR',
    finding: 'Terjadi rembesan/bocoran pada ambang bawah dan/atau profil samping daun pintu dalam posisi tertutup penuh.',
    repair: 'Setel ulang kedudukan daun pintu terhadap sponeng, ganti karet perapat (rubber seal) yang aus, dan ratakan ambang pintu.', affected: '1 Unit Pintu', dueDays: 14 },
  { code: 'PNT-02', title: 'Mekanisme Stang Ulir Pengangkat Pintu Macet / Berat', categories: ['BANGUNAN_PELENGKAP'], severity: 'MAYOR',
    finding: 'Stang ulir pengangkat tidak bergerak lancar dari posisi tertutup penuh hingga terbuka penuh.',
    repair: 'Bersihkan ulir dari kotoran dan karat, luruskan stang, ganti mur ulir yang aus, lumasi dengan gemuk, lalu uji buka-tutup penuh disaksikan Direksi Teknis.', affected: '1 Unit Pintu', dueDays: 7 },
  { code: 'PNT-03', title: 'Lapisan Cat Anti-Karat Rangka Pintu Rusak / Berkarat', categories: ['BANGUNAN_PELENGKAP'], severity: 'MINOR',
    finding: 'Lapisan cat rangka/daun pintu terkelupas dan terdapat korosi permukaan.',
    repair: 'Bersihkan karat dengan sikat kawat/amplas hingga logam bersih, aplikasikan cat dasar anti-karat dan cat penutup sesuai spesifikasi teknis kontrak.', affected: 'Luas ± 0,00 m²', dueDays: 14 },
  { code: 'PNT-04', title: 'Papan Duga Muka Air (Peilschaal) Tidak Sesuai', categories: ['BANGUNAN_PELENGKAP'], severity: 'MINOR',
    finding: 'Papan duga tidak terpasang, tidak terbaca, atau elevasi nol tidak sesuai elevasi referensi.',
    repair: 'Pasang/setel ulang papan duga terhadap elevasi referensi (BM) hasil pengukuran ulang, pastikan angka skala terbaca jelas.', affected: '1 Unit Peilschaal', dueDays: 7 },
  { code: 'BGN-01', title: 'Karet Penahan Air (Waterstop) Tidak Utuh / Rembesan Sambungan', categories: ['BANGUNAN_PELENGKAP'], severity: 'MAYOR',
    finding: 'Terdapat rembesan air pada sambungan beton yang mengindikasikan waterstop tidak utuh atau tidak terpasang.',
    repair: 'Lakukan injeksi sealant/grouting pada sambungan yang merembes, uji ulang dengan pengaliran air.', affected: '0 Titik Sambungan', dueDays: 21 },
  { code: 'BGN-02', title: 'Pelat Nomenklatur / Prasasti Tidak Terpasang', categories: ['BANGUNAN_PELENGKAP'], severity: 'MINOR',
    finding: 'Pelat nomenklatur bangunan atau prasasti proyek belum terpasang atau tidak terbaca.',
    repair: 'Pasang pelat nomenklatur sesuai standar nomenklatur jaringan irigasi dan gambar kerja.', affected: '1 Unit Pelat', dueDays: 7 },
  { code: 'BRJ-01', title: 'Isian Batu Bronjong Berongga / Ukuran Batu Tidak Memenuhi', categories: ['SUNGAI_TANGGUL'], severity: 'MAYOR',
    finding: 'Isian batu bronjong tidak padat, terdapat rongga besar, dan/atau ukuran batu lebih kecil dari mata anyaman.',
    repair: 'Buka tutup kotak bronjong, tambah dan susun ulang batu keras berukuran lebih besar dari mata anyaman hingga padat, ikat kembali tutup bronjong.', affected: '0 Unit Bronjong', dueDays: 14 },
  { code: 'BRJ-02', title: 'Kawat Anyaman Bronjong Putus / Berkarat', categories: ['SUNGAI_TANGGUL'], severity: 'MAYOR',
    finding: 'Kawat anyaman heksagonal putus atau lapisan galvanis/PVC rusak dan berkarat.',
    repair: 'Ganti panel anyaman yang rusak atau sambung kawat dengan kawat sejenis sesuai SNI 2406, pastikan lapisan pelindung kawat utuh.', affected: '0 Unit Bronjong', dueDays: 14 },
  { code: 'BRJ-03', title: 'Ikatan Kawat Pengunci Antar-Unit Lepas', categories: ['SUNGAI_TANGGUL'], severity: 'MINOR',
    finding: 'Ikatan kawat pengunci antar-unit kotak bronjong dan/atau diafragma internal tidak terpasang atau lepas.',
    repair: 'Ikat ulang sisi-sisi antar-unit dan diafragma internal dengan kawat pengikat sesuai SNI 2406 pada jarak ikatan sesuai spesifikasi.', affected: '0 Titik Ikatan', dueDays: 7 },
  { code: 'TGL-01', title: 'Penurunan Lokal / Retak Memanjang Mercu Tanggul', categories: ['SUNGAI_TANGGUL'], severity: 'KRITIS',
    finding: 'Mercu tanggul mengalami penurunan lokal (settlement) dan/atau retak memanjang.',
    repair: 'Gali area retak/turun, timbun kembali lapis demi lapis dengan material timbunan terpilih dan padatkan sesuai spesifikasi, kembalikan elevasi mercu rencana.', affected: 'Panjang ± 0,00 m', dueDays: 30 },
  { code: 'TGL-02', title: 'Gerusan Lokal (Local Scouring) pada Koperan Kaki', categories: ['SUNGAI_TANGGUL'], severity: 'KRITIS',
    finding: 'Terdapat indikasi gerusan dasar sungai pada kaki bangunan sehingga koperan terekspos.',
    repair: 'Timbun kembali lubang gerusan dan pasang perlindungan kaki (batu kosong/bronjong) sesuai gambar kerja; evaluasi kedalaman koperan oleh Direksi Teknis.', affected: 'Panjang ± 0,00 m', dueDays: 21 },
  { code: 'GAL-01', title: 'Sisa Gundukan Sedimen pada Dasar Galian', categories: ['NORMALISASI_GALIAN'], severity: 'MAYOR',
    finding: 'Dasar alur hasil galian belum rata; terdapat gundukan sedimen di atas elevasi dasar rencana.',
    repair: 'Gali/keruk ulang gundukan sedimen hingga elevasi dan kemiringan dasar rencana, ukur ulang penampang melintang.', affected: 'Volume ± 0,00 m³', dueDays: 14 },
  { code: 'GAL-02', title: 'Kelongsoran Tebing Galian (Bank Sliding)', categories: ['NORMALISASI_GALIAN'], severity: 'MAYOR',
    finding: 'Tebing galian longsor sehingga material masuk kembali ke dalam alur.',
    repair: 'Angkat material longsoran dari alur, bentuk ulang kemiringan tebing sesuai rencana (1 : m), dan padatkan permukaan tebing.', affected: 'Panjang ± 0,00 m', dueDays: 21 },
  { code: 'GAL-03', title: 'Penempatan Tanah Hasil Galian (Spoil Bank) Tidak Sesuai', categories: ['NORMALISASI_GALIAN'], severity: 'MINOR',
    finding: 'Tanah hasil galian ditempatkan terlalu dekat dengan bibir tebing.',
    repair: 'Pindahkan dan tata tanah hasil galian pada jarak aman dari bibir tebing sesuai gambar kerja, ratakan dan padatkan.', affected: 'Panjang ± 0,00 m', dueDays: 7 },
  { code: 'DOK-00', title: 'Dokumentasi Pemeriksaan (Tanpa Temuan Cacat Mutu)', categories: 'ALL', severity: 'MINOR',
    finding: 'Kondisi fisik terpasang sesuai pemeriksaan visual; tidak ditemukan cacat mutu pada bidang yang didokumentasikan.',
    repair: '-', affected: '-', dueDays: 0 },
];

export const presetsFor = (cat: StructureCategory) =>
  DEFECT_PRESETS.filter((p) => p.categories === 'ALL' || p.categories.includes(cat));

export const SEVERITY_LABEL: Record<Severity, string> = { MINOR: 'Minor', MAYOR: 'Mayor', KRITIS: 'Kritis' };
