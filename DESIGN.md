---
name: SI-MONEV PSDA Design System
description: Sistem desain berstandar industri teknik sipil keairan untuk operasional monitoring evaluasi, inspeksi lapangan berdaya kontras tinggi, dan dokumen legal MONEV/PHO/FHO.
colors:
  primary: "#0f172a"
  primary-light: "#1e293b"
  accent: "#f59e0b"
  accent-bright: "#fbbf24"
  neutral-bg: "#f1f5f9"
  surface: "#ffffff"
  surface-subtle: "#f8fafc"
  border-subtle: "#e2e8f0"
  border-strong: "#cbd5e1"
  text-primary: "#0f172a"
  text-secondary: "#475569"
  text-muted: "#64748b"
  status-success: "#059669"
  status-success-bg: "#ecfdf5"
  status-warning: "#d97706"
  status-warning-bg: "#fffbeb"
  status-danger: "#dc2626"
  status-danger-bg: "#fef2f2"
  status-info: "#2563eb"
  status-info-bg: "#eff6ff"
typography:
  display:
    fontFamily: "Inter, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Inter, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0em"
  body:
    fontFamily: "Inter, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "Inter, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-primary-active:
    backgroundColor: "{colors.primary-light}"
  button-accent:
    backgroundColor: "{colors.accent-bright}"
    textColor: "{colors.primary}"
    rounded: "{rounded.xl}"
    padding: "10px 20px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "16px 20px"
  input:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "10px 14px"
---

## Overview

Sistem Desain **SI-PHO PSDA** dirancang untuk menjawab tantangan nyata operasional lapangan teknik sipil keairan: paparan sinar matahari terik (*outdoor high-glare*), debu, sarung tangan lapangan, dan kebutuhan pembuktian legal serah terima pekerjaan (*Provisional Hand Over* - PHO).

Filosofi visual yang dianut adalah **Utilitarian Elegance & Engineering Rigor**:
1. **Presisi Tinggi:** Mengutamakan tipografi tabular angka (`tabular-nums`) untuk dimensi, koordinat satelit, dan perhitungan volume.
2. **Kontras & Kejelasan Lapangan:** Menghindari elemen visual kabur atau gradasi ungu-biru sintetis yang sulit terbaca di luar ruangan. Elemen penting menggunakan aksen *Safety Amber* dan *Deep Slate*.
3. **Dualitas Media:** Memisahkan secara tegas antara pengalaman aplikasi digital lapangan (*tactile, responsive, modern dark HUD*) dan lembar keluaran Berita Acara cetak A4 fisik (*formal kedinasan, Times New Roman, kop surat baku*).

---

## Colors

### Skema Primer & Latar
- **Deep Slate / Navy (`#0f172a`):** Warna utama yang mewakili otoritas kedinasan, kekokohan teknis, dan bingkai fokus kamera/header.
- **Safety Amber (`#f59e0b` / `#fbbf24`):** Warna aksen fungsional yang merepresentasikan keselamatan kerja konstruksi sipil, tombol shutter kamera, indikator segmen aktif, dan navigasi utama.
- **Slate Tonal Palette (`#f8fafc`, `#f1f5f9`, `#e2e8f0`):** Gradasi abu-abu sejuk berlapis untuk membedakan kartu, panel formulir, dan kontur latar tanpa menimbulkan kelelahan mata (*eye-strain*).

### Indikator Semantik Teknis (Baku)
- **Status Memenuhi / Sesuai:** Emerald (`#059669` teks / `#ecfdf5` latar) — Dimensi aktual memenuhi toleransi kontrak.
- **Status Perlu Perbaikan:** Amber (`#d97706` teks / `#fffbeb` latar) — Terdapat cacat mutu minor atau STA belum selesai diperiksa.
- **Status Kritis / Kurang Dimensi:** Rose / Crimson (`#dc2626` teks / `#fef2f2` latar) — Terjadi defisit dimensi ($\Delta p < -\tau$) atau cacat mutu berdampak struktural.
- **Status Belum Diukur:** Slate (`#64748b` teks / `#f1f5f9` latar) — Data lapangan belum dimasukkan.

---

## Typography

### Antarmuka Digital Aplikasi (Web & PWA)
- **Font Stack:** `Inter, "Segoe UI", Roboto, Arial, sans-serif`.
- **Angka Numerik & Koordinat:** Seluruh kolom dimensi, volume, persentase capaian, dan lintang/bujur GPS wajib menggunakan kelas `.num` (`font-variant-numeric: tabular-nums`) untuk memastikan digit tersusun sejajar vertikal saat dibandingkan.
- **Hierarki Skala:**
  - `Title`: 15px - 18px / Font-Weight 800 - 900 (Kapitalisasi terkontrol).
  - `Field Label`: 12px - 13px / Font-Weight 700 / Warna `#334155`.
  - `Body / Value`: 14px - 15px / Font-Weight 500 / Warna `#0f172a`.
  - `Micro / Hint`: 10px - 11px / Font-Weight 500 / Warna `#64748b`.

### Dokumen Cetak Berita Acara A4 Fisik
- **Kop & Teks Narasi Berita Acara:** `Times New Roman, Times, serif` (11 pt, spasi 1.4).
- **Tabel Rekapitulasi Dimensi & Defect List:** `Arial, Helvetica, sans-serif` (7.5 pt - 8.5 pt, padding rapat 1.5pt 2.5pt).

---

## Layout

### Struktur Layar Digital
- **Header Global (Sticky Top):** Mengakomodasi identitas instansi, logo resmi, nama paket pekerjaan, indikator konektivitas (`DARING` / `LURING`), dan status penyimpanan otomatis IndexedDB.
- **Kanal Navigasi Responsif:**
  - *Desktop ($>1024\text{ px}$):* Tab horizontal bertema amber terpasang pada bilah atas.
  - *Seluler ($<1024\text{ px}$):* Bilah navigasi bawah tetap (*fixed bottom HUD*) setinggi 56px - 64px dengan dukungan area aman (*safe area inset bottom*) agar mudah dioperasikan satu tangan di lapangan.
- **Grid Formulir Adaptif:** Menggunakan `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3` dengan `min-width: 0` untuk mencegah luapan horizontal pada ponsel sempit ($360\text{ px} - 390\text{ px}$).

### Penanganan Lembar Cetak A4
- Dokumen fisik berukuran baku A4 Potret ($210 \times 297\text{ mm}$) dan Lanskap ($297 \times 210\text{ mm}$).
- Pada layar seluler, dokumen dibungkus kontrol skala dinamis `.screen-scale` yang menyesuaikan proporsi tampilan tanpa merusak margin cetak fisik aslinya (`@media print`).

---

## Elevation & Depth

1. **Flat Tonal Layering:** Mengutamakan perbedaan lapisan warna latar (`bg-slate-50/50` di atas `bg-white` di atas `bg-slate-100`) daripada tumpukan bayangan pekat.
2. **Elevasi Kartu Mikro:** `shadow-[0_2px_10px_rgba(15,23,42,0.04)]` dengan garis tepi halus `border border-slate-200/90`.
3. **Dark Lens HUD Kamera:** `bg-slate-950/95 backdrop-blur-md` dengan garis pembatas gelap `border-slate-800` untuk memberikan fokus maksimum pada jendela bidik foto.

---

## Shapes

- **Kartu Kontainer Utama (`Card`):** `rounded-2xl` ($16\text{ px}$).
- **Kolom Input & Pilihan (`TextField`, `NumField`, `SelectField`):** `rounded-xl` ($12\text{ px}$).
- **Tombol & Badge Aksi (`Btn`, `Badge`):** `rounded-lg` ($8\text{ px}$) hingga `rounded-xl` ($12\text{ px}$).
- **Indikator Titik Status & Tombol Shutter:** `rounded-full` ($9999\text{ px}$).

---

## Components

### 1. Tombol & Umpan Balik Taktil (`Btn`)
- Efek kompresi mikro: `active:scale-[0.98] transition-all duration-150`.
- Varian: `primary` (Navy solid), `default` (Slate border), `ghost` (Transparan hover), `danger` (Aksen rose).

### 2. Panel Peringatan Defisit Industri
- Kartu peringatan bergaris aksen tebal kiri `border-l-4 border-l-amber-500` dengan latar gradasi lembut `from-amber-500/10 via-amber-50/60 to-rose-50/40` dan ikon tanda seru berdenyut (*pulse*).

### 3. Jendela Bidik Kamera & Shutter
- Lensa gelap dengan overlay garis bantu pembidik (*crosshair*), chip GPS radar pulse saat mencari sinyal satelit, dan tombol rana menyala emas (*amber glow*).

---

## Do's and Don'ts

### Do's
- **Gunakan angka tabular (`tabular-nums`)** di setiap elemen yang menampilkan dimensi, koordinat, luas, atau volume.
- **Pertahankan kontras tinggi** untuk seluruh teks status teknis agar mudah dibaca di bawah sinar matahari lapangan.
- **Sediakan dialog konfirmasi (`ConfirmDialog`)** untuk setiap aksi destruktif (ganti proyek, hapus segmen, timpa data).
- **Pelihara isolasi cetak `@media print`** agar perubahan antarmuka digital tidak pernah merusak dokumen fisik A4 Berita Acara.

### Don'ts
- **Jangan gunakan border putus-putus (`border-dashed`)** untuk tombol aksi operasional utama karena terlihat seperti wireframe mentah.
- **Jangan gunakan gradasi warna ungu/pink dekoratif** yang tidak relevan dengan standar teknik sipil dan kementerian keairan.
- **Jangan membuat target sentuh tombol lebih kecil dari $44\text{ px}$** pada area operasional seluler.
- **Jangan mengubah rumus hidraulis atau kriteria deviasi teknis ($\tau$)** demi estetika tampilan.
