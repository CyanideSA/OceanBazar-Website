import React from "react";
import { logger } from "../utils/logger";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card error" style={{ margin: 24, padding: 24 }}>
          <h2>Something went wrong</h2>
          <p style={{ color: "#666", marginTop: 8 }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            className="btn"
            style={{ marginTop: 16 }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
