export type StructureCategory =
  | 'SALURAN_IRIGASI' // KP-03 & KP-07
  | 'BANGUNAN_PELENGKAP' // KP-02 & KP-04
  | 'SUNGAI_TANGGUL' // SNI 1724:2015 & SNI 2406
  | 'NORMALISASI_GALIAN'; // KP-03, KP-05 & SE Dirjen SDA

export type GeometrySubType =
  | 'TRAPESIUM_PASANGAN_BATU'
  | 'PERSEGI_BETON_FLUME'
  | 'BANGUNAN_BAGI_SADAP_PINTU'
  | 'BRONJONG_KAWAT'
  | 'TANGGUL_REVETMENT'
  | 'GALIAN_ALUR_TRAPESIUM';

export type DimKey = 'b' | 'B' | 'H' | 'm' | 'ta' | 'tb' | 'td' | 'wallSides' | 'unitCount';
export const DIM_KEYS: DimKey[] = ['b', 'B', 'H', 'm', 'ta', 'tb', 'td', 'wallSides', 'unitCount'];

export interface DimensionSet {
  b?: number;
  B?: number;
  H?: number;
  m?: number;
  ta?: number;
  tb?: number;
  td?: number;
  wallSides?: number;
  unitCount?: number;
}

export interface MeasurementSample {
  id: string;
  sampleLabel: string;
  offsetMeter: number;
  dimensions: DimensionSet;
  isSelected: boolean;
  sampleNote?: string;
  recordedAt: string;
}

export type ChecklistStatus = 'BELUM_DIPERIKSA' | 'SESUAI' | 'TIDAK_SESUAI' | 'TIDAK_RELEVAN';

export interface VisualChecklistItem {
  id: string;
  parameterName: string;
  standardRef: string;
  status: ChecklistStatus;
  remarks?: string;
}

export type Severity = 'MINOR' | 'MAYOR' | 'KRITIS';

export interface DefectItem {
  id: string;
  staId: string;
  staCode: string;
  entryType: 'CACAT_MUTU' | 'DOKUMENTASI';
  defectCode: string;
  defectTitle: string;
  severity: Severity;
  technicalFinding: string;
  repairInstruction: string;
  affectedVolumeOrArea: string;
  dueDays: number;
  analysisSource: 'GEMINI_VISION' | 'MANUAL_PRESET';
  positionSide: PositionSide;
  gpsCoordinates: { latitude: number | null; longitude: number | null; accuracyMeter: number | null };
  watermarkedPhotoId: string;
  watermarkedPhotoDataUrl?: string; // Format legacy v1 / fallback
  capturedAt: string;
}

export type PositionSide = 'KIRI' | 'KANAN' | 'KIRI_KANAN' | 'AS_TENGAH';

export type EvaluationStatus = 'BELUM_DIUKUR' | 'MEMENUHI' | 'KURANG_DIMENSI_TERTOLERANSI' | 'PERLU_PERBAIKAN';

export interface InspectionSegment {
  id: string;
  staCode: string;
  structureName: string;
  category: StructureCategory;
  subType: GeometrySubType;
  positionSide: PositionSide;
  segmentLengthMeter: number;
  dataSource: 'IMPORT_MC100' | 'INPUT_LAPANGAN';
  mc100Dimensions: DimensionSet;
  /** Volume kontrak MC-100 dari dokumen (opsional). Bila diisi, menggantikan volume hitungan. */
  mc100VolumeContractM3?: number | null;
  mc100CrossSectionAreaM2: number;
  mc100VolumeM3: number;
  samples: MeasurementSample[];
  averagedActualDimensions: DimensionSet;
  actualCrossSectionAreaM2: number;
  actualVolumeM3: number;
  volumeDeviationM3: number;
  volumeAchievementPercent: number;
  hasDimensionDeficit: boolean;
  /** Parameter dengan deviasi negatif melampaui toleransi pada titik sampel terpilih */
  deficitParams: DimKey[];
  /** Parameter dengan deviasi negatif melampaui toleransi pada nilai rerata terpilih */
  averageDeficitParams: DimKey[];
  evaluationStatus: EvaluationStatus;
  visualChecklist: VisualChecklistItem[];
  defects: DefectItem[];
  inspectorNotes?: string;
}

export type ConclusionMode = 'OTOMATIS' | 'DAPAT_DITERIMA' | 'DITERIMA_DENGAN_CATATAN' | 'BELUM_DAPAT_DITERIMA';

export const CURRENT_SCHEMA_VERSION = 2;

export interface PHOProject {
  id: string;
  schemaVersion: number;
  updatedAt: string;
  agencyHeader: {
    ministryOrProvince: string;
    departmentName: string;
    officeAddress: string;
    logoDataUrl?: string;
  };
  contractInfo: {
    packageName: string;
    contractNumber: string;
    contractDate: string;
    mc100Number: string;
    contractValueIdr: number;
    fiscalYear: string;
    irrigationAreaOrRiverName: string;
    locationDistrict: string;
    contractorName: string;
    supervisingConsultantName: string;
    maintenancePeriodDays: number;
    dimensionToleranceMeter: number;
  };
  inspectionTeam: {
    baNumber: string;
    skNumber: string;
    inspectionDate: string;
    leadInspectorName: string;
    leadInspectorNip: string;
    technicalDirectorName: string;
    technicalDirectorNip: string;
    contractorRepName: string;
    contractorRepTitle: string;
    consultantRepName: string;
    consultantRepTitle: string;
  };
  conclusionMode: ConclusionMode;
  segments: InspectionSegment[];
}
