import type { Severity, StructureCategory } from '../../../types';
import { presetsFor } from '../../templates';

export interface PUPRDefectStandard {
  code: string;
  title: string;
  category: StructureCategory;
  severity: Severity;
  defaultDueDays: number;
  standardRef: string;
  technicalFindingTemplate: string;
  repairInstructionTemplate: string;
  typicalMetricKind: 'area' | 'length' | 'volume' | 'point';
  keywords: string[];
}

export const PUPR_DEFECT_STANDARDS: PUPRDefectStandard[] = [
  // SALURAN IRIGASI (KP-03, SNI 2406)
  {
    code: 'SAL-01',
    title: 'Keretakan / Siaran Pasangan Batu Lepas',
    category: 'SALURAN_IRIGASI',
    severity: 'MAYOR',
    defaultDueDays: 14,
    standardRef: 'KP-03 Bagian 4.2 & SNI 2406',
    technicalFindingTemplate: 'Ditemukan keretakan memanjang dan pelepasan adukan siar pada dinding saluran pasangan batu sedalam ±{depth} cm.',
    repairInstructionTemplate: 'Bongkar adukan siar yang rapuh, bersihkan celah pasangan batu dari kotoran/lumut, dan lakukan siar ulang kedap air campuran 1 PC : 2 PP.',
    typicalMetricKind: 'area',
    keywords: ['siar', 'retak', 'lepas', 'adukan', 'celah', 'batu', 'sambungan'],
  },
  {
    code: 'SAL-02',
    title: 'Amblesan Talud Saluran / Pasangan Roboh',
    category: 'SALURAN_IRIGASI',
    severity: 'KRITIS',
    defaultDueDays: 7,
    standardRef: 'KP-03 Bagian 5.1 & SNI 1724:2015',
    technicalFindingTemplate: 'Terjadi pergeseran dan amblesan dinding pasangan talud saluran akibat desakan tanah lateral dan rembesan air.',
    repairInstructionTemplate: 'Bongkar segmen dinding yang roboh/ambles, pasang cerucuk dolken/bambu penahan tanah bila tanah lunak, dan bangun kembali dinding lining sesuai elevasi desain MC-100.',
    typicalMetricKind: 'volume',
    keywords: ['ambles', 'roboh', 'longsor', 'patah', 'runtuh', 'geser', 'talud'],
  },
  {
    code: 'SAL-03',
    title: 'Sedimentasi / Endapan Lumpur di Saluran',
    category: 'SALURAN_IRIGASI',
    severity: 'MINOR',
    defaultDueDays: 30,
    standardRef: 'KP-03 Bagian 6.3',
    technicalFindingTemplate: 'Endapan lumpur dan pasir setebal ±{sedimentThickness} cm menutupi dasar saluran sehingga mereduksi kapasitas debit basah.',
    repairInstructionTemplate: 'Lakukan pengerukan endapan lumpur secara manual/mekanis hingga mencapai elevasi dasar saluran rencana dan buang sedimen ke luar bantaran.',
    typicalMetricKind: 'volume',
    keywords: ['sedimen', 'lumpur', 'endapan', 'pasir', 'dangkal', 'rumput'],
  },
  {
    code: 'SAL-04',
    title: 'Pipa Sulingan (Weep Hole) Tersumbat / Rusak',
    category: 'SALURAN_IRIGASI',
    severity: 'MAYOR',
    defaultDueDays: 14,
    standardRef: 'KP-03 Bagian 4.5',
    technicalFindingTemplate: 'Pipa sulingan air pori (weep hole) pada dinding saluran tersumbat material tanah/tidak dilengkapi filter ijuk/kerikil.',
    repairInstructionTemplate: 'Kuras dan bersihkan lubang pipa sulingan PVC Ø 2 inci, ganti filter ijuk dan krikil penahan tanah di bagian belakang lubang.',
    typicalMetricKind: 'point',
    keywords: ['sulingan', 'weep', 'hole', 'pipa', 'pori', 'sumbat', 'drainase'],
  },

  // STRUKTUR BETON (KP-02 / KP-04 / SNI 1724:2015)
  {
    code: 'BET-01',
    title: 'Keropos Beton / Honeycomb (Sarang Tawon)',
    category: 'BANGUNAN_PELENGKAP',
    severity: 'KRITIS',
    defaultDueDays: 7,
    standardRef: 'SNI 1724:2015 Tata Cara Perencanaan Beton Bangunan Air',
    technicalFindingTemplate: 'Terlihat agregat kasar tanpa selimut semen (honeycomb) dengan tulangan baja mulai terekspos udara bebas pada elemen struktur.',
    repairInstructionTemplate: 'Chipping permukaan beton yang keropos hingga beton padat, bersihkan tulangan, aplikasikan bonding agent epoksi, dan tambal dengan mortar non-shrink grout mutu setara f\'c 20 MPa.',
    typicalMetricKind: 'area',
    keywords: ['keropos', 'honeycomb', 'sarang tawon', 'agregat', 'berongga', 'tulang beton'],
  },
  {
    code: 'BET-02',
    title: 'Rembesan Air Melalui Cold Joint Beton',
    category: 'BANGUNAN_PELENGKAP',
    severity: 'MAYOR',
    defaultDueDays: 14,
    standardRef: 'KP-02 Bagian 7.4',
    technicalFindingTemplate: 'Terjadi rembesan air aktif dan pembentukan endapan garam kapur (efloresensi) pada garis siar pengecoran (construction joint).',
    repairInstructionTemplate: 'Lakukan grooving sambungan beton selebar 2 cm sedalam 3 cm, pasang waterstop/sealant hidrofobik poliuretan (PU injection) hingga rembesan berhenti tuntas.',
    typicalMetricKind: 'length',
    keywords: ['rembes', 'bocor', 'cold joint', 'efloresensi', 'garam', 'basah', 'tetes'],
  },

  // PINTU AIR & MEKANIKAL (KP-04 Bagian 8)
  {
    code: 'PNT-01',
    title: 'Daun Pintu Air Macet / Poros Ulir Berkarat',
    category: 'BANGUNAN_PELENGKAP',
    severity: 'MAYOR',
    defaultDueDays: 14,
    standardRef: 'KP-04 Standar Pintu Air & Bangunan Bagi',
    technicalFindingTemplate: 'Mekanisme stang ulir pengangkat pintu mengalami korosi dan defleksi sehingga daun pintu macet saat dioperasikan.',
    repairInstructionTemplate: 'Bersihkan stang ulir dari karat, lumasi dengan gemuk (grease) tahan air kelas hidraulis, setel kelurusan stang dan periksa kedap karet perapat.',
    typicalMetricKind: 'point',
    keywords: ['pintu', 'stang', 'ulir', 'macet', 'karat', 'korosi', 'gear', 'engkol'],
  },

  // BRONJONG & PERLINDUNGAN TEBING (KP-02 Bagian 6)
  {
    code: 'BRJ-01',
    title: 'Anyaman Kawat Bronjong Putus / Batu Amblas',
    category: 'SUNGAI_TANGGUL',
    severity: 'KRITIS',
    defaultDueDays: 7,
    standardRef: 'KP-02 Bagian 6.2 & SNI Kawat Bronjong',
    technicalFindingTemplate: 'Kawat galvanis anyaman bronjong terputus akibat gerusan arus air deras dan benturan material hanyutan, menyebabkan batu isian tercecer.',
    repairInstructionTemplate: 'Rangkai kawat bronjong pengikat baru Ø 3 mm standar SNI, isi ulang batu kali ukuran 15–25 cm hingga padat, dan kencangkan penutup bronjong.',
    typicalMetricKind: 'volume',
    keywords: ['bronjong', 'kawat', 'putus', 'anyaman', 'batu guling', 'tebing', 'gerusan'],
  },

  // TANGGUL & TIMBUNAN TANAH (KP-05)
  {
    code: 'TGL-01',
    title: 'Erosi Alur / Rill Erosion pada Lereng Tanggul',
    category: 'SUNGAI_TANGGUL',
    severity: 'MAYOR',
    defaultDueDays: 14,
    standardRef: 'KP-05 Standar Konstruksi Tanggul & Saluran Tanah',
    technicalFindingTemplate: 'Terbentuk alur-alur erosi air limpasan hujan pada kemiringan lereng tanggul luar dengan kedalaman > 15 cm.',
    repairInstructionTemplate: 'Timbun kembali alur erosi dengan tanah lempung berpasir terpilih, padatkan berlapis per 20 cm, dan tanami gebalan rumput lempengan (sodding) penahan erosi.',
    typicalMetricKind: 'area',
    keywords: ['alur', 'gerus', 'hujan', 'lereng', 'tanggul', 'erosi', 'rill'],
  },

  // GALIAN & BANGUNAN UTAMA LAINNYA
  {
    code: 'BGN-01',
    title: 'Gerusan Lokal (Scouring) di Hilir Bangunan Olak',
    category: 'BANGUNAN_PELENGKAP',
    severity: 'KRITIS',
    defaultDueDays: 7,
    standardRef: 'KP-02 Bagian 5.3 Kolam Olak',
    technicalFindingTemplate: 'Terbentuk kubangan gerusan dasar (scouring) di ujung hilir lantai kolam olak membahayakan stabilitas rip-rap pengaman.',
    repairInstructionTemplate: 'Isi kubangan gerusan dengan rip-rap batu bongkah bobot minimal 50 kg/buah dan lindungi kaki lantai dengan matras bronjong berlapis geotextil.',
    typicalMetricKind: 'volume',
    keywords: ['scour', 'gerusan', 'olak', 'hilir', 'kikis', 'pondasi', 'tergantung'],
  },
];

/**
 * Mencari standar PUPR terbaik berdasarkan kategori dan kecocokan kata kunci visual.
 */
export const findBestPUPRStandard = (
  category: StructureCategory,
  visualKeywords: string[]
): PUPRDefectStandard => {
  const byCategory = PUPR_DEFECT_STANDARDS.filter((s) => s.category === category);
  const pool = byCategory.length > 0 ? byCategory : PUPR_DEFECT_STANDARDS;

  let best = pool[0];
  let maxScore = -1;

  for (const std of pool) {
    let score = 0;
    for (const kw of visualKeywords) {
      if (std.keywords.some((k) => kw.toLowerCase().includes(k) || k.includes(kw.toLowerCase()))) {
        score += 2;
      }
    }
    if (std.category === category) {
      score += 1;
    }
    if (score > maxScore) {
      maxScore = score;
      best = std;
    }
  }

  return best;
};

/**
 * Mengambil daftar seluruh preset cacat mutu untuk kategori tertentu.
 */
export const getPUPRPresets = (category: StructureCategory) => {
  return presetsFor(category);
};
