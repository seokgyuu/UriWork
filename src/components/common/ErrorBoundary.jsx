import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // eslint-disable-next-line no-console
    try {
      const payload = {
        tag: 'ErrorBoundary.getDerivedStateFromError',
        timestamp: new Date().toISOString(),
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        url: typeof location !== 'undefined' ? location.href : undefined,
      };
      console.error('⚡️  [error] -', JSON.stringify(payload));
    } catch (_) {}
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    try {
      const payload = {
        tag: 'ErrorBoundary.componentDidCatch',
        timestamp: new Date().toISOString(),
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        url: typeof location !== 'undefined' ? location.href : undefined,
      };
      // eslint-disable-next-line no-console
      console.error('⚡️  [error] -', JSON.stringify(payload));
    } catch (_) {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center max-w-xl">
            <h2 className="text-xl font-semibold mb-2">문제가 발생했습니다</h2>
            <p className="text-gray-600 mb-4">화면을 다시 시도하거나 앱을 재시작해주세요.</p>
            {this.state.error?.message && (
              <pre className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-3 text-left whitespace-pre-wrap break-words">
                {this.state.error.message}
              </pre>
            )}
            <button onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })} className="px-4 py-2 bg-blue-600 text-white rounded">
              다시 시도
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;


