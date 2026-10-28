import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Kunci API Gemini TIDAK dibundel ke dalam build.
// Kunci dimasukkan pengguna pada menu Proyek > Pengaturan AI dan disimpan lokal di perangkat,
// atau disuntikkan oleh lingkungan runtime Google AI Studio (process.env.API_KEY).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'SI-PHO PSDA — Inspeksi Lapangan Serah Terima Pertama Bangunan Air',
        short_name: 'SI-PHO PSDA',
        description: 'Sistem Inspeksi Lapangan Serah Terima Pertama Pekerjaan Bangunan Air - Bidang PSDA',
        lang: 'id',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      },
    }),
  ],
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
});
