export const uid = (p = 'id') => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${p}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

export const fmt = (v: number | undefined | null, d = 2): string => {
  if (v === undefined || v === null || !Number.isFinite(v)) return '-';
  return v.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
};

export const fmtDim = (v: number | undefined | null, kind: 'dim' | 'count' | 'ratio' = 'dim') => {
  if (v === undefined || v === null || !Number.isFinite(v)) return '-';
  if (kind === 'count') return Number.isInteger(v) ? String(v) : fmt(v, 2);
  if (kind === 'ratio') return fmt(v, 2);
  return fmt(v, 3);
};

export const fmtIdr = (v: number) => 'Rp ' + (Number.isFinite(v) ? v : 0).toLocaleString('id-ID', { maximumFractionDigits: 0 }) + ',-';

/** Parse angka masukan lapangan: menerima koma atau titik sebagai pemisah desimal */
export const parseNum = (s: string): number | undefined => {
  const t = s.trim().replace(/\s/g, '');
  if (t === '') return undefined;
  let norm = t;
  if (t.includes(',') && t.includes('.')) norm = t.replace(/\./g, '').replace(',', '.');
  else norm = t.replace(',', '.');
  const v = Number(norm);
  return Number.isFinite(v) ? v : undefined;
};

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
export const terbilang = (x: number): string => {
  if (x < 0) return `minus ${terbilang(-x)}`;
  const v = Math.floor(Math.abs(x));
  if (v < 12) return SATUAN[v] || (v === 0 ? 'nol' : '');
  if (v < 20) return `${terbilang(v - 10)} belas`;
  if (v < 100) return `${terbilang(Math.floor(v / 10))} puluh ${v % 10 ? terbilang(v % 10) : ''}`.trim();
  if (v < 200) return `seratus ${v - 100 ? terbilang(v - 100) : ''}`.trim();
  if (v < 1000) return `${terbilang(Math.floor(v / 100))} ratus ${v % 100 ? terbilang(v % 100) : ''}`.trim();
  if (v < 2000) return `seribu ${v - 1000 ? terbilang(v - 1000) : ''}`.trim();
  if (v < 1e6) return `${terbilang(Math.floor(v / 1000))} ribu ${v % 1000 ? terbilang(v % 1000) : ''}`.trim();
  if (v < 1e9) return `${terbilang(Math.floor(v / 1e6))} juta ${v % 1e6 ? terbilang(v % 1e6) : ''}`.trim();
  return `${terbilang(Math.floor(v / 1e9))} miliar ${v % 1e9 ? terbilang(v % 1e9) : ''}`.trim();
};

const parseISODate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
};

export const tanggalPanjang = (iso: string) => {
  if (!iso) return '-';
  const d = parseISODate(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};

export const kalimatTanggal = (iso: string) => {
  const d = parseISODate(iso);
  const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    hari: HARI[d.getDay()],
    tanggal: cap(terbilang(d.getDate())),
    bulan: BULAN[d.getMonth()],
    tahun: cap(terbilang(d.getFullYear())),
    angka: `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`,
  };
};

export const addDays = (iso: string, days: number) => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const zonaWaktu = (date = new Date()) => {
  const off = -date.getTimezoneOffset() / 60;
  if (off === 7) return 'WIB';
  if (off === 8) return 'WITA';
  if (off === 9) return 'WIT';
  return `UTC${off >= 0 ? '+' : ''}${off}`;
};

export const stempelWaktu = (iso: string) => {
  const d = new Date(iso);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${zonaWaktu(d)}`;
};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
