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
    // #region agent log
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'edit-map-crash',hypothesisId:'H-boundary',location:'ErrorBoundary.jsx:componentDidCatch',message:String(error?.message||error),data:{name:error?.name,stack:String(error?.stack||'').slice(0,1200),componentStack:String(errorInfo?.componentStack||'').slice(0,1200)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
