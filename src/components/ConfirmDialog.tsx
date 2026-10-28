import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Btn } from './ui';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title = 'Konfirmasi Tindakan',
  message,
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  isDestructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      cancelBtnRef.current?.focus();
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
              isDestructive ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
            }`}
          >
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 id="confirm-dialog-title" className="text-lg font-bold text-slate-900">
              {title}
            </h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <Btn
            ref={cancelBtnRef}
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={onCancel}
          >
            {cancelLabel}
          </Btn>
          <Btn
            type="button"
            variant={isDestructive ? 'danger' : 'primary'}
            className="w-full sm:w-auto"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
          >
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}
