import { z } from 'zod';
import type { PHOProject } from '../types';

export const DimensionSetSchema = z
  .object({
    b: z.number().optional(),
    B: z.number().optional(),
    H: z.number().optional(),
    m: z.number().optional(),
    ta: z.number().optional(),
    tb: z.number().optional(),
    td: z.number().optional(),
    wallSides: z.number().optional(),
    unitCount: z.number().optional(),
  })
  .passthrough();

export const MeasurementSampleSchema = z.object({
  id: z.string().min(1),
  sampleLabel: z.string(),
  offsetMeter: z.number(),
  dimensions: DimensionSetSchema.default({}),
  isSelected: z.boolean().default(true),
  sampleNote: z.string().optional(),
  recordedAt: z.string(),
});

export const VisualChecklistItemSchema = z.object({
  id: z.string().min(1),
  parameterName: z.string(),
  standardRef: z.string(),
  status: z.enum(['BELUM_DIPERIKSA', 'SESUAI', 'TIDAK_SESUAI', 'TIDAK_RELEVAN']).default('BELUM_DIPERIKSA'),
  remarks: z.string().optional(),
});

export const DefectItemSchema = z.object({
  id: z.string().min(1),
  staId: z.string(),
  staCode: z.string(),
  entryType: z.enum(['CACAT_MUTU', 'DOKUMENTASI']).default('CACAT_MUTU'),
  defectCode: z.string(),
  defectTitle: z.string(),
  severity: z.enum(['MINOR', 'MAYOR', 'KRITIS']).default('MINOR'),
  technicalFinding: z.string().default(''),
  repairInstruction: z.string().default(''),
  affectedVolumeOrArea: z.string().default(''),
  dueDays: z.number().default(7),
  analysisSource: z.enum(['GEMINI_VISION', 'MANUAL_PRESET']).default('MANUAL_PRESET'),
  positionSide: z.enum(['KIRI', 'KANAN', 'KIRI_KANAN', 'AS_TENGAH']).default('AS_TENGAH'),
  gpsCoordinates: z
    .object({
      latitude: z.number().nullable().default(null),
      longitude: z.number().nullable().default(null),
      accuracyMeter: z.number().nullable().default(null),
    })
    .default({ latitude: null, longitude: null, accuracyMeter: null }),
  watermarkedPhotoId: z.string().default(''),
  watermarkedPhotoDataUrl: z.string().optional(),
  capturedAt: z.string(),
});

export const InspectionSegmentSchema = z.object({
  id: z.string().min(1),
  staCode: z.string().min(1),
  structureName: z.string().default(''),
  category: z.enum(['SALURAN_IRIGASI', 'BANGUNAN_PELENGKAP', 'SUNGAI_TANGGUL', 'NORMALISASI_GALIAN']).default('SALURAN_IRIGASI'),
  subType: z
    .enum([
      'TRAPESIUM_PASANGAN_BATU',
      'PERSEGI_BETON_FLUME',
      'BANGUNAN_BAGI_SADAP_PINTU',
      'BRONJONG_KAWAT',
      'TANGGUL_REVETMENT',
      'GALIAN_ALUR_TRAPESIUM',
    ])
    .default('TRAPESIUM_PASANGAN_BATU'),
  positionSide: z.enum(['KIRI', 'KANAN', 'KIRI_KANAN', 'AS_TENGAH']).default('AS_TENGAH'),
  segmentLengthMeter: z.number().default(0),
  dataSource: z.enum(['IMPORT_MC100', 'INPUT_LAPANGAN']).default('INPUT_LAPANGAN'),
  mc100Dimensions: DimensionSetSchema.default({}),
  mc100VolumeContractM3: z.number().nullable().optional(),
  mc100CrossSectionAreaM2: z.number().default(0),
  mc100VolumeM3: z.number().default(0),
  samples: z.array(MeasurementSampleSchema).default([]),
  averagedActualDimensions: DimensionSetSchema.default({}),
  actualCrossSectionAreaM2: z.number().default(0),
  actualVolumeM3: z.number().default(0),
  volumeDeviationM3: z.number().default(0),
  volumeAchievementPercent: z.number().default(100),
  hasDimensionDeficit: z.boolean().default(false),
  deficitParams: z.array(z.string()).default([]),
  averageDeficitParams: z.array(z.string()).default([]),
  evaluationStatus: z.enum(['BELUM_DIUKUR', 'MEMENUHI', 'KURANG_DIMENSI_TERTOLERANSI', 'PERLU_PERBAIKAN']).default('BELUM_DIUKUR'),
  visualChecklist: z.array(VisualChecklistItemSchema).default([]),
  defects: z.array(DefectItemSchema).default([]),
  inspectorNotes: z.string().optional(),
});

export const AgencyHeaderSchema = z.object({
  ministryOrProvince: z.string().default(''),
  departmentName: z.string().default(''),
  officeAddress: z.string().default(''),
  logoDataUrl: z.string().optional(),
});

export const ContractInfoSchema = z.object({
  packageName: z.string().default(''),
  contractNumber: z.string().default(''),
  contractDate: z.string().default(''),
  mc100Number: z.string().default(''),
  contractValueIdr: z.number().default(0),
  fiscalYear: z.string().default(''),
  irrigationAreaOrRiverName: z.string().default(''),
  locationDistrict: z.string().default(''),
  contractorName: z.string().default(''),
  supervisingConsultantName: z.string().default(''),
  maintenancePeriodDays: z.number().default(180),
  dimensionToleranceMeter: z.number().default(0.015),
});

export const InspectionTeamSchema = z.object({
  baNumber: z.string().default(''),
  skNumber: z.string().default(''),
  inspectionDate: z.string().default(''),
  leadInspectorName: z.string().default(''),
  leadInspectorNip: z.string().default(''),
  technicalDirectorName: z.string().default(''),
  technicalDirectorNip: z.string().default(''),
  contractorRepName: z.string().default(''),
  contractorRepTitle: z.string().default(''),
  consultantRepName: z.string().default(''),
  consultantRepTitle: z.string().default(''),
});

export const MilestoneSchema = z.object({
  id: z.string().min(1),
  label: z.string().default(''),
  plannedDate: z.string().default(''),
  actualDate: z.string().optional(),
  targetPercent: z.number().default(0),
  isCompleted: z.boolean().default(false),
});

export const ContractTimelineSchema = z.object({
  spmkNumber: z.string().optional(),
  spmkDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  totalCalendarDays: z.number().optional(),
  fhoTargetDate: z.string().optional(),
  milestones: z.array(MilestoneSchema).optional().default([]),
});

export const ProgressPeriodSchema = z.object({
  id: z.string().min(1),
  periodNumber: z.number().default(1),
  periodType: z.enum(['MINGGUAN', 'BULANAN']).default('MINGGUAN'),
  label: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  plannedPhysicalPercent: z.number().default(0),
  actualPhysicalPercent: z.number().default(0),
  plannedFinancialPercent: z.number().optional(),
  actualFinancialPercent: z.number().optional(),
  weatherSummary: z.string().optional(),
  workerCount: z.number().optional(),
  notes: z.string().optional(),
  recordedBy: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const NCRItemSchema = z.object({
  id: z.string().min(1),
  ncrNumber: z.string().default(''),
  issuedDate: z.string().default(''),
  issuedBy: z.string().default(''),
  staReference: z.string().optional(),
  linkedSegmentId: z.string().optional(),
  linkedDefectId: z.string().optional(),
  severity: z.enum(['MINOR', 'MAYOR', 'KRITIS']).default('MINOR'),
  findingDescription: z.string().default(''),
  rootCause: z.string().optional(),
  correctiveAction: z.string().default(''),
  targetClosureDate: z.string().default(''),
  actualClosureDate: z.string().optional(),
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'CLOSED']).default('OPEN'),
  closureNotes: z.string().optional(),
  verifiedBy: z.string().optional(),
  photoId: z.string().optional(),
});

export const MaintenanceRecordSchema = z.object({
  id: z.string().min(1),
  visitDate: z.string().default(''),
  inspectorName: z.string().default(''),
  staReference: z.string().optional(),
  defectReference: z.string().optional(),
  actionTaken: z.string().default(''),
  isResolved: z.boolean().default(false),
  notes: z.string().optional(),
  photoId: z.string().optional(),
});

export const PHOProjectSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.number().default(3),
  updatedAt: z.string(),
  agencyHeader: AgencyHeaderSchema.default({
    ministryOrProvince: '',
    departmentName: '',
    officeAddress: '',
  }),
  contractInfo: ContractInfoSchema.default({
    packageName: '',
    contractNumber: '',
    contractDate: '',
    mc100Number: '',
    contractValueIdr: 0,
    fiscalYear: '',
    irrigationAreaOrRiverName: '',
    locationDistrict: '',
    contractorName: '',
    supervisingConsultantName: '',
    maintenancePeriodDays: 180,
    dimensionToleranceMeter: 0.015,
  }),
  inspectionTeam: InspectionTeamSchema.default({
    baNumber: '',
    skNumber: '',
    inspectionDate: '',
    leadInspectorName: '',
    leadInspectorNip: '',
    technicalDirectorName: '',
    technicalDirectorNip: '',
    contractorRepName: '',
    contractorRepTitle: '',
    consultantRepName: '',
    consultantRepTitle: '',
  }),
  conclusionMode: z.enum(['OTOMATIS', 'DAPAT_DITERIMA', 'DITERIMA_DENGAN_CATATAN', 'BELUM_DAPAT_DITERIMA']).default('OTOMATIS'),
  segments: z.array(InspectionSegmentSchema),
  timeline: ContractTimelineSchema.optional().default({ milestones: [] }),
  progressPeriods: z.array(ProgressPeriodSchema).optional().default([]),
  ncrItems: z.array(NCRItemSchema).optional().default([]),
  maintenanceRecords: z.array(MaintenanceRecordSchema).optional().default([]),
});

export function validateProjectSchema(raw: unknown): PHOProject {
  const parsed = PHOProjectSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Validasi skema proyek gagal: ${issues}`);
  }
  return parsed.data as unknown as PHOProject;
}
