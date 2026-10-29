# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

1. **Tim Teknis Pengawas & Pemeriksa / PPHP:** Insinyur sipil dan pejabat teknis dinas/balai PSDA yang melakukan uji petik fisik langsung di lapangan (sepanjang tanggul, saluran, dan bendung) dalam rangka Monitoring Evaluasi berkala serta Serah Terima Pekerjaan (PHO & FHO).
2. **Pejabat Pembuat Komitmen (PPK) & Direksi Teknis:** Pengambil keputusan penerimaan hasil pekerjaan kontraktual berbasis pemenuhan volume rekayasa MC-0 vs MC-100 dan mutu fisik terpasang.
3. **Konsultan Pengawas (Supervisi):** Bertanggung jawab atas pencocokan data ukur aktual lapangan, verifikasi toleransi dimensi teknis, penerbitan lembar NCR, dan rekomendasi daftar cacat mutu (*Defect List*).
4. **Penyedia Jasa (Kontraktor Pelaksana):** Mengetahui deviasi jadwal Kurva-S, titik-titik STA yang mengalami defisit dimensi atau cacat mutu untuk segera diperbaiki selama pelaksanaan dan masa pemeliharaan (*warranty period*).

## Product Purpose

SI-MONEV PSDA adalah instrumen monitoring evaluasi (*monev*) dan inspeksi lapangan *mobile-first* serta *offline-first* terpadu untuk digitalisasi seluruh siklus hidup kontrak konstruksi keairan — mulai dari rekayasa lapangan MC-0, pengendalian jadwal Kurva-S, pencatatan progres fisik/keuangan berkala, pengendalian mutu & Non-Conformance Report (NCR), inspeksi uji petik Serah Terima Pertama (PHO), hingga masa pemeliharaan dan Serah Terima Akhir (FHO). Aplikasi ini mengotomatisasi pemantauan deviasi jadwal, pencocokan dimensi 3-pilar (MC-0 vs MC-100 vs Aktual di lapangan), mendokumentasikan temuan dengan foto ber-watermark metadata autentik (GPS & stempel waktu), dan menerbitkan Laporan Monev Berkala, Berita Acara PHO resmi, serta Berita Acara FHO format standar dinas teknis (A4 fisik).

## Positioning

Satu-satunya sistem monitoring evaluasi dan inspeksi sipil keairan mandiri (*standalone PWA*) yang menggabungkan kontrol jadwal Kurva-S, komparator 3-pilar kuantitas (MC-0 vs MC-100 vs Aktual), manajemen NCR/cacat mutu, dan kalkulasi hidraulis/geometris berstandar KP PU/SNI secara luring 100% tanpa ketergantungan koneksi internet, dilengkapi audit trail deviasi multi-sampel dan analisis cacat mutu AI (Gemini 2.5 Flash) dengan fallback pustaka lokal.

## Operating Context

- **Lingkungan Kerja:** Lokasi terpencil di sepanjang saluran irigasi, tanggul sungai, dan bendung dengan paparan sinar matahari terik (*high-glare*), debu, air, serta ketiadaan sinyal seluler (*zero-connectivity*).
- **Perangkat Operasional:** Smartphone Android/iOS petugas lapangan, tablet inspektur, dan laptop/desktop di kantor dinas untuk pencetakan dokumen.
- **Ritual & Format Dokumen:** Laporan Monev Periodik, Berita Acara Pemeriksaan Fisik PHO, dan Berita Acara FHO format fisik A4 (Potret & Lanskap) bertanda tangan basah para pihak (PPK/Direksi Teknis, Tim PPHP, Konsultan Pengawas, Kontraktor).

## Capabilities and Constraints

- **Kemampuan Utama:**
  - Impor dan sinkronisasi cerdas tabel MC-0, MC-100, maupun Terpadu via CSV titik koma (`;`).
  - Kalkulasi geometris dan hidraulis otomatis untuk 4 kategori (Saluran, Bangunan Pengatur, Bangunan Pelengkap, Pengaman Tebing/Bronjong) dengan 6 sub-tipe penampang.
  - Komparator 3-pilar: Variasi CCO ($V_{\text{MC-100}} - V_{\text{MC-0}}$) dan Deviasi Kepatuhan Fisik ($V_{\text{Aktual}} - V_{\text{MC-100}}$).
  - Toleransi deviasi dimensi terkalibrasi ($\Delta p < -\tau$, default $\tau = 0{,}01\text{ m}$).
  - Kamera inspeksi terintegrasi dengan pembakaran watermark permanen (Nama Ruas, STA, Titik Koordinat GPS lintang/bujur, Timestamp WIB).
  - Penyimpanan persisten ganda: IndexedDB + LocalStorage dengan mekanisme *automatic fallback*.
  - Ekspor/impor berkas cadangan mandiri `.json` dan ekspor data audit 3-pilar `.csv`.
  - Pintu kendali kelayakan FHO (*FHO Readiness Gate*) terintegrasi dengan status penutupan cacat mutu PHO dan lembar NCR.
- **Batasan Teknis:**
  - Wajib berjalan 100% luring (PWA Service Worker aktif).
  - Formula perhitungan geometris dan batasan teknis mengacu pada Standar Perencanaan Irigasi Kementerian PU (Kriteria Perencanaan KP-01 s/d KP-07).
  - Dokumen cetak wajib mematuhi tata letak fisik A4 baku kementerian/dinas (margin 20 mm potret, 12 mm lanskap).

## Brand Commitments

- **Nama Aplikasi:** SI-MONEV PSDA (Sistem Informasi Monitoring Evaluasi & Serah Terima Pekerjaan Konstruksi Pengelolaan Sumber Daya Air).
- **Tone of Voice:** Bahasa Indonesia teknik sipil baku, presisi, objektif, dan formal kedinasan.
- **Identitas Visual:** Skema warna keselamatan kerja konstruksi sipil keairan — Dark Navy (`#0f172a`) yang solid dan terpercaya dipadukan dengan Safety Amber (`#f59e0b` / `#fbbf24`) sebagai aksen operasional lapangan berdaya kontras tinggi.

## Evidence on Hand

- **Dataset Riil:** Proyek Contoh D.I. Lakbok Utara, Kabupaten Ciamis (`src/lib/demo.ts`) dengan 4 STA terpadu MC-0/MC-100, 10 periode Kurva-S, 2 NCR, catatan pemeliharaan, foto inspeksi ber-watermark sintetis, dan data ukur multi-sampel.
- **Template Dokumen:** Format CSV baku MC-0, MC-100, dan Terpadu (`src/lib/csv.ts`), serta susunan Laporan Monev Berkala, Berita Acara PHO, dan Berita Acara FHO format dinas teknis (`src/components/ReportView.tsx`).

## Product Principles

1. **Ketepatan & Presisi Tanpa Kompromi:** Perhitungan geometris dan evaluasi deviasi adalah acuan hukum kontraktual; kalkulasi harus deterministik dan setiap sampel lapangan harus tercatat transparan dalam jejak audit.
2. **Kemandirian Lapangan Ekstrem (Field-First Autonomy):** Seluruh fungsi inti (input, hitung, ambil foto, simpan, pratinjau cetak) harus dapat diselesaikan di tengah sawah/saluran tanpa bergantung pada ketersediaan sinyal seluler atau server jarak jauh.
3. **Keterbacaan Kontras Luar Ruangan (Outdoor Legibility):** Antarmuka lapangan dirancang kontras tinggi, bebas distorsi silau matahari, dan tombol aksi berukuran ramah sentuhan sarung tangan.
4. **Integritas Dokumen Baku:** Hasil cetakan dokumen harus langsung siap dipertanggungjawabkan di hadapan pemeriksa (Inspektorat / BPK) tanpa memerlukan penyesuaian manual lanjutan.

## Accessibility & Inclusion

- **Kontras Tinggi (WCAG AA/AAA):** Memastikan teks status (Sesuai, Perlu Perbaikan, Kurang Dimensi, Belum Diukur) memiliki keterbacaan tinggi di bawah sinar matahari langsung.
- **Target Sentuh Lapangan:** Seluruh tombol navigasi, kontrol kamera, dan toggle sampel memiliki dimensi sentuh minimal $44 \times 44\text{ px}$.
