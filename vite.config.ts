import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Kunci API Gemini TIDAK dibundel ke dalam build.
// Kunci dimasukkan pengguna pada menu Proyek > Pengaturan AI dan disimpan lokal di perangkat,
// atau disuntikkan oleh lingkungan runtime Google AI Studio (process.env.API_KEY).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
});
