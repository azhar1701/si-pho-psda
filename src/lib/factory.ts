import type {
  GeometrySubType,
  InspectionSegment,
  MeasurementSample,
  PHOProject,
  PositionSide,
  VisualChecklistItem,
  DimensionSet,
  StructureCategory,
  ProgressPeriod,
  NCRItem,
  MaintenanceRecord,
  Milestone,
} from '../types';
import { CURRENT_SCHEMA_VERSION } from '../types';
import { CATEGORIES, SUBTYPES } from './templates';
import { todayISO, uid } from './format';
import { recomputeSegment } from './calc';

export const buildChecklist = (cat: StructureCategory): VisualChecklistItem[] =>
  CATEGORIES[cat].checklist.map((c) => ({
    id: uid('chk'),
    parameterName: c.parameterName,
    standardRef: c.standardRef,
    status: 'BELUM_DIPERIKSA',
    remarks: '',
  }));

export const sampleLabelFor = (index: number, offset: number) => {
  const pos = index === 0 ? 'Pangkal STA' : 'Titik Uji';
  return `Sampel ${index + 1} - ${pos} (+${offset.toLocaleString('id-ID')}m)`;
};

export const newSample = (index: number, offset = 0, dims: DimensionSet = {}): MeasurementSample => ({
  id: uid('smp'),
  sampleLabel: sampleLabelFor(index, offset),
  offsetMeter: offset,
  dimensions: { ...dims },
  isSelected: true,
  sampleNote: '',
  recordedAt: new Date().toISOString(),
});

export const defaultDims = (subType: GeometrySubType): DimensionSet => {
  const d: DimensionSet = {};
  if (SUBTYPES[subType].fields.some((f) => f.key === 'wallSides')) d.wallSides = 2;
  if (SUBTYPES[subType].fields.some((f) => f.key === 'unitCount')) d.unitCount = 1;
  return d;
};

export const newSegment = (opts: {
  staCode: string;
  structureName: string;
  subType: GeometrySubType;
  positionSide?: PositionSide;
  length?: number;
  mc100?: DimensionSet;
  dataSource?: InspectionSegment['dataSource'];
  mc100VolumeContractM3?: number | null;
  tol: number;
}): InspectionSegment => {
  const st = SUBTYPES[opts.subType];
  const seg: InspectionSegment = {
    id: uid('sta'),
    staCode: opts.staCode,
    structureName: opts.structureName,
    category: st.category,
    subType: opts.subType,
    positionSide: opts.positionSide ?? 'KIRI_KANAN',
    segmentLengthMeter: opts.length ?? 0,
    dataSource: opts.dataSource ?? 'INPUT_LAPANGAN',
    mc100Dimensions: { ...defaultDims(opts.subType), ...(opts.mc100 ?? {}) },
    mc100VolumeContractM3: opts.mc100VolumeContractM3 ?? null,
    mc100CrossSectionAreaM2: 0,
    mc100VolumeM3: 0,
    samples: [newSample(0, 0, defaultDims(opts.subType))],
    averagedActualDimensions: {},
    actualCrossSectionAreaM2: 0,
    actualVolumeM3: 0,
    volumeDeviationM3: 0,
    volumeAchievementPercent: 0,
    hasDimensionDeficit: false,
    deficitParams: [],
    averageDeficitParams: [],
    evaluationStatus: 'BELUM_DIUKUR',
    visualChecklist: buildChecklist(st.category),
    defects: [],
    inspectorNotes: '',
  };
  return recomputeSegment(seg, opts.tol);
};

export const newProgressPeriod = (opts: {
  periodNumber: number;
  periodType?: 'MINGGUAN' | 'BULANAN';
  label?: string;
  startDate?: string;
  endDate?: string;
  plannedPhysicalPercent?: number;
  actualPhysicalPercent?: number;
}): ProgressPeriod => ({
  id: uid('prd'),
  periodNumber: opts.periodNumber,
  periodType: opts.periodType ?? 'MINGGUAN',
  label: opts.label ?? `Minggu ke-${String(opts.periodNumber).padStart(2, '0')}`,
  startDate: opts.startDate ?? todayISO(),
  endDate: opts.endDate ?? todayISO(),
  plannedPhysicalPercent: opts.plannedPhysicalPercent ?? 0,
  actualPhysicalPercent: opts.actualPhysicalPercent ?? 0,
  plannedFinancialPercent: 0,
  actualFinancialPercent: 0,
  weatherSummary: 'Cerah Berawan',
  workerCount: 15,
  notes: '',
  updatedAt: new Date().toISOString(),
});

export const newNCRItem = (opts?: Partial<NCRItem>): NCRItem => ({
  id: uid('ncr'),
  ncrNumber: opts?.ncrNumber ?? `NCR-${Date.now().toString().slice(-4)}`,
  issuedDate: opts?.issuedDate ?? todayISO(),
  issuedBy: opts?.issuedBy ?? '',
  staReference: opts?.staReference ?? '',
  severity: opts?.severity ?? 'MINOR',
  findingDescription: opts?.findingDescription ?? '',
  correctiveAction: opts?.correctiveAction ?? '',
  targetClosureDate: opts?.targetClosureDate ?? todayISO(),
  status: 'OPEN',
  ...opts,
});

export const newMaintenanceRecord = (opts?: Partial<MaintenanceRecord>): MaintenanceRecord => ({
  id: uid('mnt'),
  visitDate: opts?.visitDate ?? todayISO(),
  inspectorName: opts?.inspectorName ?? '',
  actionTaken: opts?.actionTaken ?? '',
  isResolved: false,
  ...opts,
});

export const newMilestone = (label: string, plannedDate: string, targetPercent: number): Milestone => ({
  id: uid('mls'),
  label,
  plannedDate,
  targetPercent,
  isCompleted: false,
});

export const blankProject = (): PHOProject => ({
  id: uid('prj'),
  schemaVersion: CURRENT_SCHEMA_VERSION,
  updatedAt: new Date().toISOString(),
  agencyHeader: { ministryOrProvince: '', departmentName: '', officeAddress: '' },
  contractInfo: {
    packageName: '',
    contractNumber: '',
    contractDate: '',
    mc100Number: '',
    contractValueIdr: 0,
    fiscalYear: String(new Date().getFullYear()),
    irrigationAreaOrRiverName: '',
    locationDistrict: '',
    contractorName: '',
    supervisingConsultantName: '',
    maintenancePeriodDays: 180,
    dimensionToleranceMeter: 0.015,
  },
  inspectionTeam: {
    baNumber: '',
    skNumber: '',
    inspectionDate: todayISO(),
    leadInspectorName: '',
    leadInspectorNip: '',
    technicalDirectorName: '',
    technicalDirectorNip: '',
    contractorRepName: '',
    contractorRepTitle: 'Direktur',
    consultantRepName: '',
    consultantRepTitle: 'Team Leader',
  },
  conclusionMode: 'OTOMATIS',
  segments: [],
  timeline: {
    spmkNumber: '',
    spmkDate: '',
    startDate: '',
    endDate: '',
    totalCalendarDays: 150,
    fhoTargetDate: '',
    milestones: [],
  },
  progressPeriods: [],
  ncrItems: [],
  maintenanceRecords: [],
});
