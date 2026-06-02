import { Component, ErrorInfo, ReactNode } from 'react';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches React render errors and displays a fallback UI.
 * Prevents the entire app from crashing if a component throws.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    toast.error('Renderer error', {
      description: error.message,
      duration: 10000,
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center bg-app-bg p-8">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="mb-2 text-xl font-bold text-app-accent">
              Something went wrong
            </h2>
            <p className="mb-4 text-sm text-app-text-muted">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-app-accent bg-app-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-app-accent-hover"
              onClick={this.handleReset}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
