import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertOctagon, RotateCcw, RefreshCw } from 'lucide-react';
import { Btn } from './ui';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="my-8 mx-auto max-w-2xl rounded-2xl border-2 border-red-200 bg-red-50/70 p-6 text-slate-800 shadow-md">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black tracking-tight text-red-950">
                {this.props.fallbackTitle || 'Terjadi Kendala pada Komponen Ini'}
              </h3>
              <p className="mt-1 text-sm text-red-800">
                Aplikasi mendeteksi error tak terduga. Data Anda di memori tersimpan aman, Anda dapat mencoba memuat ulang tampilan.
              </p>
              {this.state.error && (
                <div className="mt-3 rounded-lg border border-red-200 bg-white/90 p-3 text-xs font-mono text-red-700 overflow-x-auto max-h-36">
                  {this.state.error.name}: {this.state.error.message}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Btn
                  type="button"
                  variant="primary"
                  className="bg-red-700 hover:bg-red-800 text-white min-h-[40px] text-sm py-2 px-3"
                  onClick={this.handleReset}
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Coba Muat Ulang Komponen
                </Btn>
                <Btn
                  type="button"
                  variant="secondary"
                  className="min-h-[40px] text-sm py-2 px-3"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Refresh Halaman
                </Btn>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
