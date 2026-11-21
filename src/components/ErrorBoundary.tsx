import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode | ((reset: () => void) => React.ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void | Promise<void>;
  screenName?: string;
  compact?: boolean;
  title?: string;
  description?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
  resetKey: number;
}

function isDevOrPreviewEnv(): boolean {
  try {
    if (import.meta.env?.DEV) return true;
  } catch {
    // Ignore env check failure
  }
  if (typeof window !== 'undefined') {
    const host = window.location?.hostname || '';
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.includes('ais-dev-') ||
      host.includes('ais-pre-')
    ) {
      return true;
    }
  }
  return false;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: '',
      resetKey: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const scope = this.props.screenName ? ` (${this.props.screenName})` : '';
    console.error(`[ErrorBoundary${scope}]`, error, errorInfo);
    this.setState({ componentStack: errorInfo?.componentStack || '' });
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      componentStack: '',
      resetKey: prev.resetKey + 1,
    }));
    if (this.props.onReset) {
      Promise.resolve(this.props.onReset()).catch((err) => {
        console.error('[ErrorBoundary onReset]', err);
      });
    }
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
    }

    if (typeof this.props.fallback === 'function') {
      return this.props.fallback(this.handleReset);
    }

    if (this.props.fallback !== undefined) {
      return this.props.fallback;
    }

    const showDetailedError = isDevOrPreviewEnv();
    const rawMsg = this.state.error?.message?.trim() || '';
    const shortErrorMsg = rawMsg.length > 180 ? `${rawMsg.slice(0, 177)}...` : rawMsg;
    const firstStackLine = this.state.componentStack
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('at '));

    return (
      <div
        className={`flex flex-col items-center justify-center bg-surface px-4 text-center text-ink ${
          this.props.compact ? 'min-h-[320px] rounded-2xl py-10' : 'min-h-screen'
        }`}
      >
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="font-display text-lg font-extrabold text-ink">
            {this.props.title || 'Não foi possível exibir esta tela'}
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            {this.props.description ||
              'Ocorreu uma falha temporária durante o carregamento. Tente novamente ou recarregue a página.'}
          </p>
          {(showDetailedError || this.props.screenName || shortErrorMsg) && (
            <div className="mt-3 rounded-xl border border-border bg-surface px-3 py-2 text-left text-[11px] text-ink-muted">
              {this.props.screenName && (
                <p className="font-semibold text-ink">
                  Tela: {this.props.screenName}
                </p>
              )}
              {shortErrorMsg && (
                <p className="mt-0.5 break-words font-mono text-[11px] text-ink-muted">
                  {shortErrorMsg}
                </p>
              )}
              {showDetailedError && firstStackLine && (
                <p className="mt-0.5 truncate font-mono text-[10px] text-ink-muted">
                  {firstStackLine}
                </p>
              )}
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-ink hover:bg-surface"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  window.localStorage?.removeItem('rodaleve_visual_builder_v1');
                } catch {
                  // Ignore storage restrictions
                }
                window.location.reload();
              }}
              className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand hover:bg-brand-hover"
            >
              Recarregar página
            </button>
          </div>
        </div>
      </div>
    );
  }
}
