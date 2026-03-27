import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-4">Oops! Something went wrong.</h1>
          <p className="text-slate-600 mb-6">We're working to fix it. Please try refreshing the page.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-brand text-white px-6 py-3 rounded-xl font-bold"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
