export const MAX_PHOTO_WIDTH = 1280;
export const JPEG_QUALITY = 0.82;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // Batas wajar 15 MB untuk foto lapangan

export const validateFileSize = (f: File, maxBytes = MAX_UPLOAD_BYTES): boolean => f.size <= maxBytes;

export const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat citra.'));
    img.src = src;
  });

/** Gambar sumber ke kanvas dengan lebar maksimum 1280 px */
export const sourceToCanvas = (src: CanvasImageSource, w: number, h: number) => {
  const scale = Math.min(1, MAX_PHOTO_WIDTH / w);
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c;
};

export const fileToDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });

/** Normalisasi berkas unggahan menjadi JPEG terkompresi (≤1280 px, kualitas 0,82) */
export const normalizeUpload = async (f: File) => {
  if (!validateFileSize(f)) {
    throw new Error(`Ukuran berkas (${(f.size / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimum 15 MB.`);
  }
  const img = await loadImage(await fileToDataUrl(f));
  return sourceToCanvas(img, img.naturalWidth, img.naturalHeight).toDataURL('image/jpeg', JPEG_QUALITY);
};

/**
 * Filter Kontras Retak & Rongga: operator Sobel pada kanal luminans dengan peregangan kontras.
 * Latar digelapkan (grayscale), tepi kuat diwarnai kuning, tepi sangat kuat (retak/rongga) diwarnai merah.
 */
export const applyCrackFilter = (src: ImageData, sensitivity = 0.5): ImageData => {
  const { width: w, height: h, data } = src;
  const g = new Float32Array(w * h);
  let min = 255, max = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    g[p] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = Math.max(1, max - min);
  for (let p = 0; p < g.length; p++) g[p] = ((g[p] - min) / range) * 255;
  const out = new ImageData(w, h);
  const o = out.data;
  const thrLow = 140 - sensitivity * 110; // 30..140
  const thrHigh = thrLow * 2.1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p * 4;
      let mag = 0;
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        const tl = g[p - w - 1], t = g[p - w], tr = g[p - w + 1];
        const l = g[p - 1], r = g[p + 1];
        const bl = g[p + w - 1], b = g[p + w], br = g[p + w + 1];
        const gx = -tl - 2 * l - bl + tr + 2 * r + br;
        const gy = -tl - 2 * t - tr + bl + 2 * b + br;
        mag = Math.sqrt(gx * gx + gy * gy);
      }
      const base = g[p] * 0.35;
      if (mag > thrHigh) { o[i] = 255; o[i + 1] = 30; o[i + 2] = 30; }
      else if (mag > thrLow) { o[i] = 255; o[i + 1] = 214; o[i + 2] = 0; }
      else { o[i] = base; o[i + 1] = base; o[i + 2] = base; }
      o[i + 3] = 255;
    }
  }
  return out;
};

export const filterDataUrl = async (dataUrl: string, sensitivity: number) => {
  const img = await loadImage(dataUrl);
  const c = document.createElement('canvas');
  const scale = Math.min(1, 900 / img.naturalWidth);
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  ctx.putImageData(applyCrackFilter(ctx.getImageData(0, 0, c.width, c.height), sensitivity), 0, 0);
  return c.toDataURL('image/jpeg', 0.85);
};

export interface WatermarkInfo {
  line1: string; // Paket & No. Kontrak
  line2: string; // STA & Posisi
  line3: string; // GPS & Waktu
  line4: string; // Dimensi rerata vs MC-100
  status: string; // Status pemeriksaan
  statusColor: string;
}

const wrap = (ctx: CanvasRenderingContext2D, text: string, maxW: number) => {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
};

/** Pembakaran stempel informasi teknis permanen pada bagian bawah citra */
export const burnWatermark = async (dataUrl: string, info: WatermarkInfo): Promise<string> => {
  const img = await loadImage(dataUrl);
  const c = sourceToCanvas(img, img.naturalWidth, img.naturalHeight);
  const ctx = c.getContext('2d')!;
  const W = c.width;
  const fs = Math.max(13, Math.round(W / 58));
  const pad = Math.round(fs * 0.8);
  const lh = Math.round(fs * 1.32);
  const maxW = W - pad * 2;
  ctx.textBaseline = 'top';
  const font = (bold: boolean, size = fs) => `${bold ? '700' : '500'} ${size}px "Arial Narrow", Arial, Helvetica, sans-serif`;

  ctx.font = font(true, Math.round(fs * 1.05));
  const l1 = wrap(ctx, info.line1.toUpperCase(), maxW);
  ctx.font = font(false);
  const l2 = wrap(ctx, info.line2, maxW);
  const l3 = wrap(ctx, info.line3, maxW);
  const l4 = wrap(ctx, info.line4, maxW);
  ctx.font = font(true);
  const l5 = wrap(ctx, info.status, maxW - fs);
  const total = (l1.length + l2.length + l3.length + l4.length + l5.length) * lh + pad * 2 + Math.round(fs * 0.5);
  const y0 = c.height - total;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
  ctx.fillRect(0, y0, W, total);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(0, y0, W, Math.max(3, Math.round(fs / 5)));

  let y = y0 + pad;
  const draw = (lines: string[], f: string, color: string) => {
    ctx.font = f;
    ctx.fillStyle = color;
    for (const l of lines) { ctx.fillText(l, pad, y); y += lh; }
  };
  draw(l1, font(true, Math.round(fs * 1.05)), '#ffffff');
  draw(l2, font(false), '#e2e8f0');
  draw(l3, font(false), '#e2e8f0');
  draw(l4, font(false), '#bae6fd');
  y += Math.round(fs * 0.25);
  ctx.fillStyle = info.statusColor;
  ctx.fillRect(pad, y + Math.round(fs * 0.15), Math.round(fs * 0.7), Math.round(fs * 0.7));
  ctx.font = font(true);
  ctx.fillStyle = '#ffffff';
  for (const l of l5) { ctx.fillText(l, pad + fs, y); y += lh; }
  return c.toDataURL('image/jpeg', JPEG_QUALITY);
};
