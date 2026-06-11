"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui" }}>
          <h2 style={{ color: "#ef4444", marginBottom: 12 }}>Une erreur est survenue</h2>
          <p style={{ color: "#888", marginBottom: 20 }}>
            {this.state.error?.message || "Erreur inconnue"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "10px 24px",
              background: "#a855f7",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Réessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
