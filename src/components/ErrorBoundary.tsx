import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 降级 UI，若不提供则使用默认样式 */
  fallback?: ReactNode;
  /** 错误恢复后的回调 */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] 捕获到渲染错误:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
          <div className="mx-4 max-w-lg rounded-2xl border border-red-500/20 bg-gray-900 p-8 text-center shadow-2xl">
            <div className="mb-4 text-5xl">⚠️</div>
            <h2 className="mb-2 text-xl font-semibold text-red-300">
              页面出现异常
            </h2>
            <p className="mb-4 text-sm text-gray-400">
              {this.state.error.message || "未知渲染错误"}
            </p>
            <div className="space-x-3">
              <button
                onClick={this.handleReset}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
              >
                重试
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl border border-white/20 bg-white/[0.04] px-5 py-2 text-sm text-gray-200 transition-colors hover:bg-white/[0.08]"
              >
                刷新页面
              </button>
            </div>
            {this.state.errorInfo && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-xs text-gray-500">
                  查看详情
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-gray-950 p-3 text-[11px] text-gray-400">
                  {this.state.error.stack}
                  {"\n\n"}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
