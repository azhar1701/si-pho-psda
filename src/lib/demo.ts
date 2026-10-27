import type { DefectItem, InspectionSegment, PHOProject } from '../types';
import { blankProject, newSample, newSegment } from './factory';
import { recomputeProject, recomputeSegment } from './calc';
import { uid } from './format';
import { burnWatermark } from './imaging';
import { buildWatermarkInfo } from './inspection';
import { DEFECT_PRESETS } from './templates';

const TOL = 0.01;

/** Citra sintetis bidang struktur untuk proyek contoh (tanpa aset eksternal) */
const syntheticPhoto = (kind: 'pasangan' | 'pintu' | 'bronjong' | 'galian', seed: number) => {
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
    ctx.beginPath(); ctx.moveTo(0, 380); ctx.lineTo(1280, 380); ctx.lineTo(1280, 960); ctx.lineTo(0, 960); ctx.fill();
    for (let y = 380; y < 960; y += 56) for (let x = -40; x < 1300; x += 90) {
      ctx.fillStyle = `hsl(30, ${8 + rnd() * 10}%, ${38 + rnd() * 20}%)`;
      ctx.beginPath(); ctx.ellipse(x + rnd() * 30, y + 26, 40 + rnd() * 10, 22 + rnd() * 6, rnd(), 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#2b2622'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(420, 420); for (let i = 0; i < 14; i++) ctx.lineTo(420 + i * 32 + rnd() * 20, 420 + i * 34 + rnd() * 18); ctx.stroke();
    ctx.fillStyle = '#1c1a18'; ctx.beginPath(); ctx.ellipse(860, 700, 70, 40, 0.2, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'pintu') {
    ctx.fillStyle = '#a3a39a'; ctx.fillRect(0, 380, 1280, 580);
    ctx.fillStyle = '#3a6ea5'; ctx.fillRect(480, 300, 320, 520);
    ctx.fillStyle = '#5b5b5b'; ctx.fillRect(620, 120, 40, 200); ctx.fillRect(560, 120, 160, 30);
    ctx.fillStyle = '#7a4a22'; for (let i = 0; i < 40; i++) ctx.fillRect(490 + rnd() * 300, 320 + rnd() * 480, 14 + rnd() * 30, 6 + rnd() * 12);
    ctx.fillStyle = 'rgba(80,140,200,0.7)'; ctx.fillRect(470, 820, 340, 40);
    ctx.strokeStyle = 'rgba(180,220,255,0.9)'; ctx.lineWidth = 5; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(500 + i * 55, 815); ctx.lineTo(505 + i * 55, 900); ctx.stroke(); }
  } else if (kind === 'bronjong') {
    ctx.fillStyle = '#6d6a63'; ctx.fillRect(0, 380, 1280, 580);
    for (let i = 0; i < 260; i++) { ctx.fillStyle = `hsl(25, 6%, ${35 + rnd() * 30}%)`; ctx.beginPath(); ctx.ellipse(rnd() * 1280, 380 + rnd() * 580, 26 + rnd() * 26, 18 + rnd() * 16, rnd() * 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#26231f'; ctx.beginPath(); ctx.ellipse(700, 640, 120, 70, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c8ccd0'; ctx.lineWidth = 3;
    for (let x = -60; x < 1340; x += 80) for (let y = 380; y < 960; y += 70) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 40, y + 35); ctx.lineTo(x, y + 70); ctx.lineTo(x - 40, y + 35); ctx.closePath(); ctx.stroke(); }
  } else {
    ctx.fillStyle = '#7b5a3a'; ctx.beginPath(); ctx.moveTo(0, 380); ctx.lineTo(1280, 380); ctx.lineTo(1280, 960); ctx.lineTo(0, 960); ctx.fill();
    ctx.fillStyle = '#5a7fa0'; ctx.beginPath(); ctx.moveTo(380, 960); ctx.lineTo(520, 520); ctx.lineTo(760, 520); ctx.lineTo(900, 960); ctx.fill();
    ctx.fillStyle = '#8f6b45'; ctx.beginPath(); ctx.ellipse(640, 760, 130, 50, 0, 0, Math.PI * 2); ctx.fill();
  }
  // rambu ukur
  ctx.fillStyle = '#ffffff'; ctx.fillRect(1100, 340, 36, 560);
  for (let i = 0; i < 28; i++) { ctx.fillStyle = i % 2 ? '#dc2626' : '#111827'; ctx.fillRect(1100, 340 + i * 20, 18, 10); }
  return c.toDataURL('image/jpeg', 0.82);
};

const mkDefect = async (p: PHOProject, seg: InspectionSegment, code: string, kind: Parameters<typeof syntheticPhoto>[0], seed: number, overrides: Partial<DefectItem> = {}) => {
  const pr = DEFECT_PRESETS.find((x) => x.code === code)!;
  const capturedAt = new Date(`${p.inspectionTeam.inspectionDate}T09:${String(10 + seed).padStart(2, '0')}:00`).toISOString();
  const d: DefectItem = {
    id: uid('dft'),
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
    watermarkedPhotoDataUrl: '',
    capturedAt,
    ...overrides,
  };
  d.watermarkedPhotoDataUrl = await burnWatermark(syntheticPhoto(kind, seed * 977 + 13), buildWatermarkInfo(p, seg, d));
  return d;
};

export const buildDemoProject = async (): Promise<PHOProject> => {
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
    mc100Number: '602.1/045.MC100/PSDA/X/2026',
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

  // 1. Saluran Irigasi — trapesium pasangan batu (uji petik aktif)
  const s1 = newSegment({
    staCode: 'STA 0+000 - 0+050', structureName: 'Saluran Sekunder Lakbok Utara (BLU.1 - BLU.2)', subType: 'TRAPESIUM_PASANGAN_BATU',
    positionSide: 'KIRI_KANAN', length: 50, dataSource: 'IMPORT_MC100', tol: TOL,
    mc100: { b: 1.5, B: 2.7, H: 1.2, m: 0.5, ta: 0.3, tb: 0.4, td: 0.2, wallSides: 2 },
  });
  s1.samples = [
    { ...newSample(0, 0, { b: 1.5, B: 2.7, H: 1.2, m: 0.5, ta: 0.3, tb: 0.37, td: 0.2, wallSides: 2 }), sampleNote: 'Tebal dasar dinding kiri kurang 3 cm' },
    { ...newSample(1, 12.5, { b: 1.51, B: 2.71, H: 1.21, m: 0.5, ta: 0.3, tb: 0.4, td: 0.2, wallSides: 2 }), sampleLabel: 'Sampel 2 - Perempat Bentang (+12,5m)' },
    { ...newSample(2, 25, { b: 1.5, B: 2.7, H: 1.2, m: 0.5, ta: 0.31, tb: 0.41, td: 0.21, wallSides: 2 }), sampleLabel: 'Sampel 3 - Tengah Bentang (+25m)' },
    { ...newSample(3, 37.5, { b: 1.46, B: 2.62, H: 1.16, m: 0.5, ta: 0.28, tb: 0.36, td: 0.18, wallSides: 2 }), sampleLabel: 'Sampel 4 - Titik Uji (+37,5m)', isSelected: false, sampleNote: 'Diabaikan: titik ukur pada lubang bekas bongkaran sementara, disepakati Konsultan & Kontraktor' },
    { ...newSample(4, 50, { b: 1.5, B: 2.7, H: 1.2, m: 0.5, ta: 0.3, tb: 0.4, td: 0.2, wallSides: 2 }), sampleLabel: 'Sampel 5 - Ujung STA (+50m)' },
  ];
  s1.visualChecklist = s1.visualChecklist.map((c, i) => ({ ...c, status: i === 0 || i === 3 ? 'TIDAK_SESUAI' : 'SESUAI', remarks: i === 0 ? 'Siaran retak pada dinding kiri ± 1,5 m²' : i === 3 ? '2 titik sulingan tersumbat mortar' : '' }));

  // 2. Bangunan Pelengkap — bangunan bagi
  const s2 = newSegment({
    staCode: 'BG. BLU.2 (STA 1+250)', structureName: 'Bangunan Bagi BLU.2 — Pintu Sorong Baja 2 Unit', subType: 'BANGUNAN_BAGI_SADAP_PINTU',
    positionSide: 'AS_TENGAH', length: 4, dataSource: 'IMPORT_MC100', tol: TOL,
    mc100: { b: 0.8, H: 1.0, ta: 0.3, tb: 1.5, B: 3.0, td: 0.25 },
  });
  s2.samples = [
    { ...newSample(0, 0, { b: 0.8, H: 1.0, ta: 0.3, tb: 1.5, B: 3.0, td: 0.25 }), sampleLabel: 'Sampel 1 - Dinding Sayap Hulu (+0m)' },
    { ...newSample(1, 4, { b: 0.81, H: 1.0, ta: 0.31, tb: 1.52, B: 3.02, td: 0.25 }), sampleLabel: 'Sampel 2 - Dinding Sayap Hilir (+4m)' },
  ];
  s2.visualChecklist = s2.visualChecklist.map((c, i) => ({ ...c, status: i === 1 ? 'TIDAK_SESUAI' : 'SESUAI', remarks: i === 1 ? 'Rembesan pada ambang bawah pintu kanan' : '' }));

  // 3. Sungai & Tanggul — bronjong kawat
  const s3 = newSegment({
    staCode: 'STA 2+100 - 2+120', structureName: 'Perkuatan Tebing Sungai Cijolang Hilir Bendung', subType: 'BRONJONG_KAWAT',
    positionSide: 'KANAN', length: 10, dataSource: 'INPUT_LAPANGAN', tol: TOL,
    mc100: { b: 2.0, B: 1.0, H: 0.5, unitCount: 3 },
  });
  s3.samples = [
    { ...newSample(0, 0, { b: 2.0, B: 1.0, H: 0.5, unitCount: 3 }) },
    { ...newSample(1, 10, { b: 2.0, B: 1.01, H: 0.5, unitCount: 3 }), sampleLabel: 'Sampel 2 - Tengah Bentang (+10m)' },
  ];
  s3.visualChecklist = s3.visualChecklist.map((c, i) => ({ ...c, status: i === 0 ? 'TIDAK_SESUAI' : i === 3 ? 'TIDAK_RELEVAN' : 'SESUAI', remarks: i === 0 ? 'Rongga isian pada 2 unit lapis atas' : '' }));

  // 4. Normalisasi — galian alur
  const s4 = newSegment({
    staCode: 'STA 3+000 - 3+100', structureName: 'Normalisasi Saluran Pembuang Cikaso', subType: 'GALIAN_ALUR_TRAPESIUM',
    positionSide: 'AS_TENGAH', length: 100, dataSource: 'IMPORT_MC100', tol: TOL,
    mc100: { b: 3.0, B: 6.0, td: 1.5, m: 1.0 },
  });
  s4.samples = [
    { ...newSample(0, 0, { b: 3.0, B: 6.0, td: 1.48, m: 1.0 }) },
    { ...newSample(1, 25, { b: 2.98, B: 5.96, td: 1.45, m: 1.0 }), sampleLabel: 'Sampel 2 - Perempat Bentang (+25m)' },
    { ...newSample(2, 50, { b: 3.0, B: 6.0, td: 1.44, m: 1.0 }), sampleLabel: 'Sampel 3 - Tengah Bentang (+50m)', sampleNote: 'Sisa gundukan sedimen di dasar alur' },
    { ...newSample(3, 100, { b: 3.01, B: 6.02, td: 1.47, m: 1.0 }), sampleLabel: 'Sampel 4 - Ujung STA (+100m)' },
  ];
  s4.visualChecklist = s4.visualChecklist.map((c, i) => ({ ...c, status: i === 0 ? 'TIDAK_SESUAI' : 'SESUAI', remarks: i === 0 ? 'Gundukan sedimen ± 12 m di tengah bentang' : '' }));

  p.segments = [s1, s2, s3, s4].map((s) => recomputeSegment(s, TOL));
  const [a, b, c, d] = p.segments;
  a.defects = [
    await mkDefect(p, a, 'SAL-01', 'pasangan', 1, { affectedVolumeOrArea: 'Luas ± 1,50 m²', technicalFinding: 'Siaran mortar pada dinding kiri STA 0+010 s.d. 0+014 retak dan terlepas dari celah antar-batu sepanjang ± 4,0 m.' }),
    await mkDefect(p, a, 'SAL-02', 'pasangan', 2, { affectedVolumeOrArea: '2 Titik Sulingan', technicalFinding: 'Pipa sulingan Ø 50 mm pada STA 0+020 dan 0+030 dinding kiri tersumbat mortar; tidak ada aliran rembesan dari timbunan belakang.' }),
  ];
  b.defects = [await mkDefect(p, b, 'PNT-01', 'pintu', 3, { affectedVolumeOrArea: '1 Unit Pintu (Kanan)', technicalFinding: 'Rembesan pada ambang bawah daun pintu sorong kanan dalam posisi tertutup penuh; karet perapat tidak menempel rata pada ambang.' })];
  c.defects = [await mkDefect(p, c, 'BRJ-01', 'bronjong', 4, { affectedVolumeOrArea: '2 Unit Bronjong', technicalFinding: 'Isian batu pada 2 unit bronjong lapis atas tidak padat; rongga ± 0,10 m² per unit dan sebagian batu lebih kecil dari mata anyaman.' })];
  d.defects = [await mkDefect(p, d, 'GAL-01', 'galian', 5, { affectedVolumeOrArea: 'Volume ± 9,00 m³', technicalFinding: 'Gundukan sedimen sepanjang ± 12 m pada tengah bentang, elevasi dasar 4–6 cm di atas dasar rencana.' })];
  return recomputeProject(p);
};
