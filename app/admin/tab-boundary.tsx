"use client";

import { Component, type ReactNode } from "react";

/** Keeps one broken tab from leaving a blank page: shows what went wrong and a way to retry. */
export class TabBoundary extends Component<{ children: ReactNode; name: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`Admin tab "${this.props.name}" crashed`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="adm-error" role="alert">
        <b>This tab hit an error and couldn&apos;t show.</b> {this.state.error.message}{" "}
        <button type="button" className="adm-btn adm-btn--small" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    );
  }
}
