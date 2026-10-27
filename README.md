# SI-PHO PSDA

Sistem Inspeksi Lapangan Serah Terima Pertama Pekerjaan Bangunan Air — Bidang PSDA.
PWA *mobile-first* dan *offline-first* untuk opname dimensi MC-100 vs realisasi lapangan, pemeriksaan visual, kamera inspeksi ber-watermark, dan penerbitan Berita Acara PHO.

## Teknologi
React 18 · TypeScript · Vite 5 · Tailwind CSS 3 · Lucide React · `@google/genai` (`gemini-2.5-flash`, dimuat dinamis).

## Menjalankan
```bash
npm install
npm run dev        # pengembangan (http://localhost:5173)
npm run build      # build produksi ke dist/ (tsc --noEmit + vite build)
npm run preview    # uji build produksi + service worker
```
Kamera (`getUserMedia`) dan GPS memerlukan HTTPS atau `localhost`. Folder `dist/` dapat di-host statis (base relatif `./`).

## Kunci API Gemini
Kunci **tidak dibundel** ke dalam build. Sumber kunci:
1. `process.env.API_KEY` bila disuntikkan runtime Google AI Studio; atau
2. Menu **Proyek → Kesimpulan BA & Analisis AI** (disimpan di `localStorage` perangkat, tidak ikut berkas JSON).

Tanpa kunci / tanpa sinyal / galat API → otomatis memakai Pustaka Preset Cacat Mutu PSDA lokal.

## Struktur
| Berkas | Isi |
| --- | --- |
| `src/types.ts` | Skema data `PHOProject`, `InspectionSegment`, `MeasurementSample`, `DefectItem` |
| `src/lib/templates.ts` | 4 kategori × 6 sub-tipe: variabel, rumus A & V, daftar simak KP/SNI, preset cacat mutu |
| `src/lib/calc.ts` | Rerata sampel terpilih, deteksi Δp < −τ, status evaluasi, rekap proyek, kesimpulan BA |
| `src/lib/csv.ts` | Template & impor CSV MC-100 (gabung), ekspor CSV opname UTF-8 BOM (`;`, desimal koma) |
| `src/lib/imaging.ts` | Kompresi JPEG 0,82 ≤1280 px, filter Sobel retak/rongga, burn-in watermark |
| `src/lib/gemini.ts` | Pemanggilan `ai.models.generateContent` + `responseSchema` JSON |
| `src/lib/storage.ts` | Simpan otomatis `localStorage`, alih otomatis ke IndexedDB saat kuota penuh, impor/ekspor JSON |
| `src/lib/demo.ts` | Proyek contoh D.I. Lakbok Utara (4 STA, 4 kategori, multi-sampel, foto sintetis ber-watermark) |
| `src/components/*` | Proyek, Opname STA, Kamera, Laporan (BA + Lampiran I & II, `@media print` A4) |

## Catatan teknis
- Kurang dimensi: `aktual − MC-100 < −τ` (τ default 0,01 m); parameter kemiringan `m` tidak diuji; parameter jumlah (`n`, `N`) diuji dengan τ = 0.
- Dimensi akhir = rerata aritmetik sampel `isSelected === true`; luas & volume dihitung dari dimensi rerata tersebut. Semua sampel tetap dicetak sebagai jejak audit.
- Kolom opsional `mc100_volume` pada CSV menggantikan volume MC-100 hasil hitungan (ditandai † pada Lampiran I).
- Bronjong: `L` = jumlah bentang memanjang. Bangunan Pelengkap: `L` = panjang dinding sayap.

## GitHub & Deploy

- **CI** (`.github/workflows/ci.yml`): typecheck + build di setiap push/PR.
- **GitHub Pages** (`.github/workflows/deploy-pages.yml`): aktifkan di *Settings → Pages → Source: GitHub Actions*. Aplikasi akan tersedia di `https://<username>.github.io/si-pho-psda/` (base path relatif `./` sudah kompatibel).
- Kunci Gemini tidak pernah disimpan di repo. Masukkan lewat menu Proyek di aplikasi.
