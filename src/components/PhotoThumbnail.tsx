import { useEffect, useState, type CSSProperties } from 'react';
import { loadPhotoUrl } from '../lib/storage';
import { ImageOff, Loader2 } from 'lucide-react';

interface PhotoThumbnailProps {
  photoId?: string;
  fallbackDataUrl?: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  disableLink?: boolean;
}

export function PhotoThumbnail({ photoId, fallbackDataUrl, alt, className, style, disableLink = false }: PhotoThumbnailProps) {
  const [src, setSrc] = useState<string | null>(fallbackDataUrl || null);
  const [loading, setLoading] = useState<boolean>(!fallbackDataUrl && !!photoId);

  useEffect(() => {
    let active = true;
    if (photoId) {
      loadPhotoUrl(photoId)
        .then((url) => {
          if (active) {
            if (url) setSrc(url);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) setLoading(false);
        });
    } else if (fallbackDataUrl) {
      setSrc(fallbackDataUrl);
      setLoading(false);
    } else {
      setSrc(null);
      setLoading(false);
    }
    return () => {
      active = false;
    };
  }, [photoId, fallbackDataUrl]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className || 'h-24 w-32 rounded'}`} style={style}>
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className || 'h-24 w-32 rounded'}`} style={style}>
        <ImageOff className="h-5 w-5" />
      </div>
    );
  }

  const imgEl = <img src={src} alt={alt} className={className} style={style} />;

  if (disableLink) return imgEl;

  return (
    <a href={src} target="_blank" rel="noreferrer" className="block cursor-pointer">
      {imgEl}
    </a>
  );
}
