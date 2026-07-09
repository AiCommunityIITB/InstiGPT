"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
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

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-[100dvh] flex-col items-center justify-center bg-background px-4">
          <div className="w-full max-w-sm text-center">
            <h1 className="text-2xl font-bold text-foreground">
              Insti<span className="text-[#3ecf8e]">GPT</span>
            </h1>
            <p className="mt-4 text-sm text-foreground-muted">
              Something went wrong.
            </p>
            {this.state.error && (
              <p className="mt-2 text-2xs text-foreground-subtle break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="rounded-lg border border-[#3ecf8e] bg-[#3ecf8e]/10 px-4 py-2 text-xs font-medium text-[#3ecf8e] transition-colors hover:bg-[#3ecf8e]/20"
              >
                Try again
              </button>
              <button
                onClick={this.handleReload}
                className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground-muted transition-colors hover:border-border-hover hover:text-foreground"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
