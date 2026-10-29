import type { DefectItem, InspectionSegment, MonevProject } from '../types';
import { blankProject, newSample, newSegment } from './factory';
import { recomputeProject, recomputeSegment } from './calc';
import { uid } from './format';
import { burnWatermark } from './imaging';
import { buildWatermarkInfo } from './inspection';
import { DEFECT_PRESETS } from './templates';
import { savePhoto } from './storage';

const TOL = 0.01;

/** Citra sintetis bidang struktur untuk proyek contoh (tanpa aset eksternal) */
const syntheticPhoto = (kind: 'pasangan' | 'pintu' | 'bronjong' | 'galian', seed: number) => {
  if (typeof document === 'undefined') {
    throw new Error('Canvas API tidak tersedia di lingkungan SSR.');
  }
  const c = document.createElement('canvas');
  c.width = 1280;
  c.height = 960;
  const ctx = c.getContext('2d')!;
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const sky = ctx.createLinearGradient(0, 0, 0, 380);
  sky.addColorStop(0, '#9cc3e6');
  sky.addColorStop(1, '#dbe9f4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1280, 960);
  ctx.fillStyle = '#5f7f3a';
  ctx.fillRect(0, 300, 1280, 120);
  if (kind === 'pasangan') {
    ctx.fillStyle = '#8b8378';
    ctx.beginPath();
    ctx.moveTo(0, 380);
    ctx.lineTo(1280, 380);
    ctx.lineTo(1280, 960);
    ctx.lineTo(0, 960);
    ctx.fill();
    for (let y = 380; y < 960; y += 56)
      for (let x = -40; x < 1300; x += 90) {
        ctx.fillStyle = `hsl(30, ${8 + rnd() * 10}%, ${38 + rnd() * 20}%)`;
        ctx.beginPath();
        ctx.ellipse(x + rnd() * 30, y + 26, 40 + rnd() * 10, 22 + rnd() * 6, rnd(), 0, Math.PI * 2);
        ctx.fill();
      }
    ctx.strokeStyle = '#2b2622';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(420, 420);
    for (let i = 0; i < 14; i++) ctx.lineTo(420 + i * 32 + rnd() * 20, 420 + i * 34 + rnd() * 18);
    ctx.stroke();
    ctx.fillStyle = '#1c1a18';
    ctx.beginPath();
    ctx.ellipse(860, 700, 70, 40, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'pintu') {
    ctx.fillStyle = '#a3a39a';
    ctx.fillRect(0, 380, 1280, 580);
    ctx.fillStyle = '#3a6ea5';
    ctx.fillRect(480, 300, 320, 520);
    ctx.fillStyle = '#5b5b5b';
    ctx.fillRect(620, 120, 40, 200);
    ctx.fillRect(560, 120, 160, 30);
    ctx.fillStyle = '#7a4a22';
    for (let i = 0; i < 40; i++) ctx.fillRect(490 + rnd() * 300, 320 + rnd() * 480, 14 + rnd() * 30, 6 + rnd() * 12);
    ctx.fillStyle = 'rgba(80,140,200,0.7)';
    ctx.fillRect(470, 820, 340, 40);
    ctx.strokeStyle = 'rgba(180,220,255,0.9)';
    ctx.lineWidth = 5;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(500 + i * 55, 815);
      ctx.lineTo(505 + i * 55, 900);
      ctx.stroke();
    }
  } else if (kind === 'bronjong') {
    ctx.fillStyle = '#6d6a63';
    ctx.fillRect(0, 380, 1280, 580);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `hsl(25, 6%, ${35 + rnd() * 30}%)`;
      ctx.beginPath();
      ctx.ellipse(rnd() * 1280, 380 + rnd() * 580, 26 + rnd() * 26, 18 + rnd() * 16, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#26231f';
    ctx.beginPath();
    ctx.ellipse(700, 640, 120, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c8ccd0';
    ctx.lineWidth = 3;
    for (let x = -60; x < 1340; x += 80)
      for (let y = 380; y < 960; y += 70) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 40, y + 35);
        ctx.lineTo(x, y + 70);
        ctx.lineTo(x - 40, y + 35);
        ctx.closePath();
        ctx.stroke();
      }
  } else {
    ctx.fillStyle = '#5c4b37';
    ctx.fillRect(0, 380, 1280, 580);
    ctx.fillStyle = '#423526';
    ctx.beginPath();
    ctx.moveTo(0, 540);
    ctx.lineTo(400, 720);
    ctx.lineTo(880, 720);
    ctx.lineTo(1280, 540);
    ctx.lineTo(1280, 960);
    ctx.lineTo(0, 960);
    ctx.fill();
    ctx.fillStyle = '#2b2117';
    ctx.beginPath();
    ctx.ellipse(640, 720, 180, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = `rgba(20, 15, 10, ${0.15 + rnd() * 0.25})`;
      ctx.fillRect(rnd() * 1280, 380 + rnd() * 580, 2 + rnd() * 6, 2 + rnd() * 6);
    }
  }
  return c.toDataURL('image/jpeg', 0.85);
};

const mkDefect = async (
  p: MonevProject,
  seg: InspectionSegment,
  code: string,
  kind: Parameters<typeof syntheticPhoto>[0],
  seed: number,
  overrides: Partial<DefectItem> = {}
) => {
  const pr = DEFECT_PRESETS.find((x) => x.code === code)!;
  const capturedAt = new Date(`${p.inspectionTeam.inspectionDate}T09:${String(10 + seed).padStart(2, '0')}:00`).toISOString();
  const itemId = uid('dft');
  const photoId = `img_${itemId}`;
  const d: DefectItem = {
    id: itemId,
    staId: seg.id,
    staCode: seg.staCode,
    entryType: code === 'DOK-00' ? 'DOKUMENTASI' : 'CACAT_MUTU',
    defectCode: pr.code,
    defectTitle: pr.title,
    severity: pr.severity,
    technicalFinding: pr.finding,
    repairInstruction: pr.repair,
    affectedVolumeOrArea: pr.affected,
    dueDays: pr.dueDays,
    analysisSource: 'MANUAL_PRESET',
    positionSide: seg.positionSide,
    gpsCoordinates: { latitude: -7.4561 - seed * 0.0011, longitude: 108.5712 + seed * 0.0009, accuracyMeter: 4 + seed },
    watermarkedPhotoId: photoId,
    capturedAt,
    ...overrides,
  };
  const watermarkedDataUrl = await burnWatermark(syntheticPhoto(kind, seed * 977 + 13), buildWatermarkInfo(p, seg, d));
  try {
    await savePhoto(photoId, watermarkedDataUrl);
  } catch {
    d.watermarkedPhotoDataUrl = watermarkedDataUrl;
  }
  return d;
};

export const buildDemoProject = async (): Promise<MonevProject> => {
  const p = blankProject();
  p.agencyHeader = {
    ministryOrProvince: 'PEMERINTAH KABUPATEN CIAMIS',
    departmentName: 'DINAS PEKERJAAN UMUM DAN PENATAAN RUANG — BIDANG PENGELOLAAN SUMBER DAYA AIR',
    officeAddress: 'Jl. Jenderal Sudirman No. 220, Ciamis, Jawa Barat 46211',
  };
  p.contractInfo = {
    packageName: 'Rehabilitasi Jaringan Irigasi D.I. Lakbok Utara - Kabupaten Ciamis',
    contractNumber: '602.1/045/SPK/PSDA-DPUPR/2026',
    contractDate: '2026-05-04',
    mc0Number: '602.1/045.MC0/PSDA/V/2026',
    mc0Date: '2026-05-24',
    mc100Number: '602.1/045.MC100/PSDA/X/2026',
    mc100Date: '2026-10-06',
    contractValueIdr: 2846750000,
    fiscalYear: '2026',
    irrigationAreaOrRiverName: 'D.I. Lakbok Utara',
    locationDistrict: 'Kecamatan Lakbok & Purwadadi, Kabupaten Ciamis',
    contractorName: 'CV. Galuh Tirta Mandiri',
    supervisingConsultantName: 'PT. Citra Pratama Konsultan',
    maintenancePeriodDays: 180,
    dimensionToleranceMeter: TOL,
  };
  p.inspectionTeam = {
    baNumber: '602.1/045.BA-PHO/PSDA/X/2026',
    skNumber: '602.1/Kep.112/PSDA/2026',
    inspectionDate: '2026-10-27',
    leadInspectorName: 'Ir. Asep Saepudin, M.T.',
    leadInspectorNip: '19760812 200312 1 004',
    technicalDirectorName: 'Dede Kurniawan, S.T.',
    technicalDirectorNip: '19850317 201001 1 012',
    contractorRepName: 'H. Ujang Suryana',
    contractorRepTitle: 'Direktur',
    consultantRepName: 'Rina Marlina, S.T.',
    consultantRepTitle: 'Site Engineer',
  };

  // Timeline Kontrak Lengkap
  p.timeline = {
    spmkNumber: '602.1/045.SPMK/PSDA-DPUPR/2026',
    spmkDate: '2026-05-11',
    startDate: '2026-05-11',
    endDate: '2026-10-07',
    totalCalendarDays: 150,
    fhoTargetDate: '2027-04-05',
    milestones: [
      { id: 'mls-1', label: 'Mutual Check Awal (MC-0)', plannedDate: '2026-05-25', actualDate: '2026-05-24', targetPercent: 5, isCompleted: true },
      { id: 'mls-2', label: 'MC-50 (Saluran Sekunder Utama)', plannedDate: '2026-07-20', actualDate: '2026-07-22', targetPercent: 50, isCompleted: true },
      { id: 'mls-3', label: 'Uji Pengaliran Air & Pintu', plannedDate: '2026-09-15', actualDate: '2026-09-15', targetPercent: 85, isCompleted: true },
      { id: 'mls-4', label: 'Opname Akhir MC-100', plannedDate: '2026-10-05', actualDate: '2026-10-06', targetPercent: 100, isCompleted: true },
      { id: 'mls-5', label: 'Serah Terima Pertama (PHO)', plannedDate: '2026-10-27', actualDate: '2026-10-27', targetPercent: 100, isCompleted: true },
      { id: 'mls-6', label: 'Serah Terima Akhir (FHO)', plannedDate: '2027-04-05', targetPercent: 100, isCompleted: false },
    ],
  };

  // Progres Periodik (Kurva-S Pelaksanaan)
  p.progressPeriods = [
    {
      id: 'prd-01',
      periodNumber: 1,
      periodType: 'MINGGUAN',
      label: 'Minggu ke-01',
      startDate: '2026-05-11',
      endDate: '2026-05-17',
      plannedPhysicalPercent: 3.2,
      actualPhysicalPercent: 3.5,
      plannedFinancialPercent: 0,
      actualFinancialPercent: 0,
      weatherSummary: 'Cerah',
      workerCount: 16,
      notes: 'Mobilisasi alat & tenaga kerja, pematokan awal elevasi.',
    },
    {
      id: 'prd-02',
      periodNumber: 2,
      periodType: 'MINGGUAN',
      label: 'Minggu ke-02',
      startDate: '2026-05-18',
      endDate: '2026-05-24',
      plannedPhysicalPercent: 8.5,
      actualPhysicalPercent: 8.8,
      plannedFinancialPercent: 0,
      actualFinancialPercent: 0,
      weatherSummary: 'Cerah',
      workerCount: 22,
      notes: 'Penyelesaian MC-0 dan persiapan bahan batu belah & pasir pasang.',
    },
    {
      id: 'prd-03',
      periodNumber: 3,
      periodType: 'MINGGUAN',
      label: 'Minggu ke-03',
      startDate: '2026-05-25',
      endDate: '2026-05-31',
      plannedPhysicalPercent: 16.4,
      actualPhysicalPercent: 15.8,
      plannedFinancialPercent: 0,
      actualFinancialPercent: 0,
      weatherSummary: 'Hujan Sore',
      workerCount: 24,
      notes: 'Pekerjaan pasangan batu dinding saluran hulu dimulai.',
    },
    {
      id: 'prd-04',
      periodNumber: 4,
      periodType: 'MINGGUAN',
      label: 'Minggu ke-04',
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      plannedPhysicalPercent: 27.0,
      actualPhysicalPercent: 25.4,
      plannedFinancialPercent: 20.0,
      actualFinancialPercent: 20.0,
      weatherSummary: 'Cerah Berawan',
      workerCount: 28,
      notes: 'Galian alur pembuang Cikaso berjalan paralel dengan pasangan saluran.',
    },
    {
      id: 'prd-05',
      periodNumber: 5,
      periodType: 'MINGGUAN',
      label: 'Minggu ke-05',
      startDate: '2026-06-08',
      endDate: '2026-06-14',
      plannedPhysicalPercent: 42.5,
      actualPhysicalPercent: 40.2,
      plannedFinancialPercent: 20.0,
      actualFinancialPercent: 20.0,
      weatherSummary: 'Cerah',
      workerCount: 30,
      notes: 'Pemasangan kawat bronjong tebing sungai Cijolang.',
    },
    {
      id: 'prd-06',
      periodNumber: 6,
      periodType: 'MINGGUAN',
      label: 'Minggu ke-06',
      startDate: '2026-06-15',
      endDate: '2026-06-21',
      plannedPhysicalPercent: 61.0,
      actualPhysicalPercent: 59.5,
      plannedFinancialPercent: 50.0,
      actualFinancialPercent: 50.0,
      weatherSummary: 'Cerah Berawan',
      workerCount: 32,
      notes: 'Rehabilitasi pintu bagi sadap BLU.2 dan pengecoran ambang.',
    },
    {
      id: 'prd-07',
      periodNumber: 7,
      periodType: 'MINGGUAN',
      label: 'Minggu ke-07',
      startDate: '2026-06-22',
      endDate: '2026-06-28',
      plannedPhysicalPercent: 78.0,
      actualPhysicalPercent: 76.8,
      plannedFinancialPercent: 50.0,
      actualFinancialPercent: 50.0,
      weatherSummary: 'Cerah',
      workerCount: 30,
      notes: 'Penyelesaian siaran dan plesteran ban-banan saluran sekunder.',
    },
    {
      id: 'prd-08',
      periodNumber: 8,
      periodType: 'MINGGUAN',
      label: 'Minggu ke-08',
      startDate: '2026-06-29',
      endDate: '2026-07-05',
      plannedPhysicalPercent: 89.0,
      actualPhysicalPercent: 88.0,
      plannedFinancialPercent: 75.0,
      actualFinancialPercent: 75.0,
      weatherSummary: 'Hujan Deras',
      workerCount: 22,
      notes: 'Uji pengaliran air pertama; evaluasi rembesan pintu dan sedimen alur.',
    },
    {
      id: 'prd-09',
      periodNumber: 9,
      periodType: 'MINGGUAN',
      label: 'Minggu ke-09',
      startDate: '2026-07-06',
      endDate: '2026-07-12',
      plannedPhysicalPercent: 97.5,
      actualPhysicalPercent: 96.5,
      plannedFinancialPercent: 75.0,
      actualFinancialPercent: 75.0,
      weatherSummary: 'Cerah',
      workerCount: 16,
      notes: 'Pengecatan pintu air dan plat nama bangunan.',
    },
    {
      id: 'prd-10',
      periodNumber: 10,
      periodType: 'MINGGUAN',
      label: 'Minggu ke-10 (MC-100)',
      startDate: '2026-07-13',
      endDate: '2026-07-19',
      plannedPhysicalPercent: 100.0,
      actualPhysicalPercent: 100.0,
      plannedFinancialPercent: 100.0,
      actualFinancialPercent: 95.0,
      weatherSummary: 'Cerah',
      workerCount: 12,
      notes: 'Pekerjaan fisik selesai 100%, persiapan uji petik PHO bersama Direksi Teknis & PPHP.',
    },
  ];

  // NCR Pengendalian Mutu
  p.ncrItems = [
    {
      id: 'ncr-01',
      ncrNumber: 'NCR-01/PSDA/VII/2026',
      issuedDate: '2026-07-02',
      issuedBy: 'Rina Marlina, S.T. (Konsultan Pengawas)',
      staReference: 'STA 3+050 (Saluran Cikaso)',
      severity: 'MINOR',
      findingDescription: 'Ditemukan sisa gundukan sedimen galian setinggi 4-6 cm pada tengah alur yang belum dibersihkan.',
      rootCause: 'Hujan deras malam sebelumnya membawa material erosi tanah dari tebing kanan.',
      correctiveAction: 'Penggalian dan pembuangan ulang sedimen ke luar bantaran alur.',
      targetClosureDate: '2026-07-09',
      actualClosureDate: '2026-07-06',
      status: 'CLOSED',
      closureNotes: 'Elevasi alur telah dicek kembali dengan waterpass dan memenuhi profil rencana.',
      verifiedBy: 'Dede Kurniawan, S.T.',
    },
    {
      id: 'ncr-02',
      ncrNumber: 'NCR-02/PSDA/X/2026',
      issuedDate: '2026-10-27',
      issuedBy: 'Ir. Asep Saepudin, M.T. (Ketua PPHP)',
      staReference: 'STA 0+010 s.d. 0+014 Dinding Kiri',
      severity: 'MAYOR',
      findingDescription: 'Siaran mortar retak dan terlepas sepanjang 4,0 m serta 2 titik sulingan tersumbat mortar.',
      rootCause: 'Pengerjaan siaran pada kondisi panas terik tanpa curing/penyiraman yang memadai.',
      correctiveAction: 'Kupas siar lama sedalam 2 cm, bersihkan dan siar ulang mortar 1:2 serta buka sumbatan pipa sulingan.',
      targetClosureDate: '2026-11-03',
      status: 'OPEN',
      closureNotes: 'Dalam penanganan masa pemeliharaan pasca-PHO.',
    },
  ];

  // Catatan Masa Pemeliharaan (Menuju FHO)
  p.maintenanceRecords = [
    {
      id: 'mnt-01',
      visitDate: '2026-10-28',
      inspectorName: 'Dede Kurniawan, S.T. (Direksi Teknis)',
      staReference: 'STA 0+010 - 0+050',
      actionTaken: 'Kontraktor telah memobilisasi 3 pekerja dan bahan pasir pasang untuk perbaikan siaran retak dan pembukaan sumbatan pipa sulingan.',
      isResolved: false,
      notes: 'Pekerjaan ditargetkan tuntas dalam 3 hari ke depan.',
    },
  ];

  // Data Administrasi FHO
  p.fhoInfo = {
    baFhoNumber: '602.1/045.BA-FHO/PSDA/IV/2027',
    baFhoDate: '2027-04-05',
    inspectionDate: '2027-04-04',
    leadInspectorName: 'Ir. Asep Saepudin, M.T.',
    leadInspectorNip: '19760812 200312 1 004',
    contractorRepName: 'H. Ujang Suryana',
    contractorRepTitle: 'Direktur',
    consultantRepName: 'Rina Marlina, S.T.',
    consultantRepTitle: 'Site Engineer',
    warrantyStatus: 'DALAM_PEMELIHARAAN',
    closureNotes: 'Masa pemeliharaan sedang berjalan (180 hari kalender). Pemantauan perbaikan defect list PHO aktif dipantau.',
  };

  // 1. Saluran Irigasi — trapesium pasangan batu (uji petik aktif)
  // Menampilkan variasi CCO: MC-0 (b=1.40, B=2.60) direkayasa ulang menjadi MC-100 (b=1.50, B=2.70)
  const s1 = newSegment({
    staCode: 'STA 0+000 - 0+050',
    structureName: 'Saluran Sekunder Lakbok Utara (BLU.1 - BLU.2)',
    subType: 'TRAPESIUM_PASANGAN_BATU',
    positionSide: 'KIRI_KANAN',
    length: 50,
    dataSource: 'IMPORT_MC_TERPADU',
    tol: TOL,
    mc0: { b: 1.4, B: 2.6, H: 1.2, m: 0.5, ta: 0.3, tb: 0.4, td: 0.2, wallSides: 2 },
    mc100: { b: 1.5, B: 2.7, H: 1.2, m: 0.5, ta: 0.3, tb: 0.4, td: 0.2, wallSides: 2 },
  });
  s1.samples = [
    { ...newSample(0, 0, { b: 1.5, B: 2.7, H: 1.2, m: 0.5, ta: 0.3, tb: 0.37, td: 0.2, wallSides: 2 }), sampleNote: 'Tebal dasar dinding kiri kurang 3 cm' },
    { ...newSample(1, 12.5, { b: 1.51, B: 2.71, H: 1.21, m: 0.5, ta: 0.3, tb: 0.4, td: 0.2, wallSides: 2 }), sampleLabel: 'Sampel 2 - Perempat Bentang (+12,5m)' },
    { ...newSample(2, 25, { b: 1.5, B: 2.7, H: 1.2, m: 0.5, ta: 0.31, tb: 0.41, td: 0.21, wallSides: 2 }), sampleLabel: 'Sampel 3 - Tengah Bentang (+25m)' },
    {
      ...newSample(3, 37.5, { b: 1.46, B: 2.62, H: 1.16, m: 0.5, ta: 0.28, tb: 0.36, td: 0.18, wallSides: 2 }),
      sampleLabel: 'Sampel 4 - Titik Uji (+37,5m)',
      isSelected: false,
      sampleNote: 'Diabaikan: titik ukur pada lubang bekas bongkaran sementara, disepakati Konsultan & Kontraktor',
    },
    { ...newSample(4, 50, { b: 1.5, B: 2.7, H: 1.2, m: 0.5, ta: 0.3, tb: 0.4, td: 0.2, wallSides: 2 }), sampleLabel: 'Sampel 5 - Ujung STA (+50m)' },
  ];
  s1.visualChecklist = s1.visualChecklist.map((c, i) => ({
    ...c,
    status: i === 0 || i === 3 ? 'TIDAK_SESUAI' : 'SESUAI',
    remarks: i === 0 ? 'Siaran retak pada dinding kiri ± 1,5 m²' : i === 3 ? '2 titik sulingan tersumbat mortar' : '',
  }));

  // 2. Bangunan Pelengkap — bangunan bagi
  const s2 = newSegment({
    staCode: 'BG. BLU.2 (STA 1+250)',
    structureName: 'Bangunan Bagi BLU.2 — Pintu Sorong Baja 2 Unit',
    subType: 'BANGUNAN_BAGI_SADAP_PINTU',
    positionSide: 'AS_TENGAH',
    length: 4,
    dataSource: 'IMPORT_MC_TERPADU',
    tol: TOL,
    mc0: { b: 0.8, H: 1.0, ta: 0.3, tb: 1.5, B: 3.0, td: 0.25 },
    mc100: { b: 0.8, H: 1.0, ta: 0.3, tb: 1.5, B: 3.0, td: 0.25 },
  });
  s2.samples = [
    { ...newSample(0, 0, { b: 0.8, H: 1.0, ta: 0.3, tb: 1.5, B: 3.0, td: 0.25 }), sampleLabel: 'Sampel 1 - Dinding Sayap Hulu (+0m)' },
    { ...newSample(1, 4, { b: 0.81, H: 1.0, ta: 0.31, tb: 1.52, B: 3.02, td: 0.25 }), sampleLabel: 'Sampel 2 - Dinding Sayap Hilir (+4m)' },
  ];
  s2.visualChecklist = s2.visualChecklist.map((c, i) => ({
    ...c,
    status: i === 1 ? 'TIDAK_SESUAI' : 'SESUAI',
    remarks: i === 1 ? 'Rembesan pada ambang bawah pintu kanan' : '',
  }));

  // 3. Sungai & Tanggul — bronjong kawat
  const s3 = newSegment({
    staCode: 'STA 2+100 - 2+120',
    structureName: 'Perkuatan Tebing Sungai Cijolang Hilir Bendung',
    subType: 'BRONJONG_KAWAT',
    positionSide: 'KANAN',
    length: 10,
    dataSource: 'INPUT_LAPANGAN',
    tol: TOL,
    mc0: { b: 2.0, B: 1.0, H: 0.5, unitCount: 3 },
    mc100: { b: 2.0, B: 1.0, H: 0.5, unitCount: 3 },
  });
  s3.samples = [
    { ...newSample(0, 0, { b: 2.0, B: 1.0, H: 0.5, unitCount: 3 }) },
    { ...newSample(1, 10, { b: 2.0, B: 1.01, H: 0.5, unitCount: 3 }), sampleLabel: 'Sampel 2 - Tengah Bentang (+10m)' },
  ];
  s3.visualChecklist = s3.visualChecklist.map((c, i) => ({
    ...c,
    status: i === 0 ? 'TIDAK_SESUAI' : i === 3 ? 'TIDAK_RELEVAN' : 'SESUAI',
    remarks: i === 0 ? 'Rongga isian pada 2 unit lapis atas' : '',
  }));

  // 4. Normalisasi — galian alur
  // Menampilkan CCO: MC-0 (td=1.40 m) direvisi menjadi MC-100 (td=1.50 m) karena pendalaman dasar alur
  const s4 = newSegment({
    staCode: 'STA 3+000 - 3+100',
    structureName: 'Normalisasi Saluran Pembuang Cikaso',
    subType: 'GALIAN_ALUR_TRAPESIUM',
    positionSide: 'AS_TENGAH',
    length: 100,
    dataSource: 'IMPORT_MC_TERPADU',
    tol: TOL,
    mc0: { b: 3.0, B: 6.0, td: 1.4, m: 1.0 },
    mc100: { b: 3.0, B: 6.0, td: 1.5, m: 1.0 },
  });
  s4.samples = [
    { ...newSample(0, 0, { b: 3.0, B: 6.0, td: 1.48, m: 1.0 }) },
    { ...newSample(1, 25, { b: 2.98, B: 5.96, td: 1.45, m: 1.0 }), sampleLabel: 'Sampel 2 - Perempat Bentang (+25m)' },
    { ...newSample(2, 50, { b: 3.0, B: 6.0, td: 1.44, m: 1.0 }), sampleLabel: 'Sampel 3 - Tengah Bentang (+50m)', sampleNote: 'Sisa gundukan sedimen di dasar alur' },
    { ...newSample(3, 100, { b: 3.01, B: 6.02, td: 1.47, m: 1.0 }), sampleLabel: 'Sampel 4 - Ujung STA (+100m)' },
  ];
  s4.visualChecklist = s4.visualChecklist.map((c, i) => ({
    ...c,
    status: i === 0 ? 'TIDAK_SESUAI' : 'SESUAI',
    remarks: i === 0 ? 'Gundukan sedimen ± 12 m di tengah bentang' : '',
  }));

  p.segments = [s1, s2, s3, s4].map((s) => recomputeSegment(s, TOL));
  const [a, b, c, d] = p.segments;
  a.defects = [
    await mkDefect(p, a, 'SAL-01', 'pasangan', 1, {
      affectedVolumeOrArea: 'Luas ± 1,50 m²',
      technicalFinding: 'Siaran mortar pada dinding kiri STA 0+010 s.d. 0+014 retak dan terlepas dari celah antar-batu sepanjang ± 4,0 m.',
    }),
    await mkDefect(p, a, 'SAL-02', 'pasangan', 2, {
      affectedVolumeOrArea: '2 Titik Sulingan',
      technicalFinding: 'Pipa sulingan Ø 50 mm pada STA 0+020 dan 0+030 dinding kiri tersumbat mortar; tidak ada aliran rembesan dari timbunan belakang.',
    }),
  ];
  b.defects = [
    await mkDefect(p, b, 'PNT-01', 'pintu', 3, {
      affectedVolumeOrArea: '1 Unit Pintu (Kanan)',
      technicalFinding: 'Rembesan pada ambang bawah daun pintu sorong kanan dalam posisi tertutup penuh; karet perapat tidak menempel rata pada ambang.',
    }),
  ];
  c.defects = [
    await mkDefect(p, c, 'BRJ-01', 'bronjong', 4, {
      affectedVolumeOrArea: '2 Unit Bronjong',
      technicalFinding: 'Isian batu pada 2 unit bronjong lapis atas tidak padat; rongga ± 0,10 m² per unit dan sebagian batu lebih kecil dari mata anyaman.',
    }),
  ];
  d.defects = [
    await mkDefect(p, d, 'GAL-01', 'galian', 5, {
      affectedVolumeOrArea: 'Volume ± 9,00 m³',
      technicalFinding: 'Gundukan sedimen sepanjang ± 12 m pada tengah bentang, elevasi dasar 4–6 cm di atas dasar rencana.',
    }),
  ];
  return recomputeProject(p);
};
