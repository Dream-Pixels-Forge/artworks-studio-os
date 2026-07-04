import { type CSSProperties, type ReactElement, type ReactNode } from "react";

/* ── Loading State ── */
export function LoadingState({ message = "Loading..." }: { message?: string }): ReactElement {
  return (
    <div style={centerStyle}>
      <div style={spinnerStyle} />
      <span style={{ marginTop: "8px", fontSize: "13px", color: "var(--text-secondary)" }}>{message}</span>
    </div>
  );
}

/* ── Error State ── */
export function ErrorState({ message, onDismiss }: { message: string; onDismiss?: () => void }): ReactElement {
  return (
    <div style={bannerStyle}>
      <span>{message}</span>
      {onDismiss && (
        <span style={dismissStyle} onClick={onDismiss} role="button" tabIndex={0}>×</span>
      )}
    </div>
  );
}

/* ── Empty State ── */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }): ReactElement {
  return (
    <div style={centerStyle}>
      <div style={{ fontSize: "32px", marginBottom: "8px", opacity: 0.3 }}>∅</div>
      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: action ? "12px" : 0 }}>{message}</div>
      {action}
    </div>
  );
}

/* ── Inline Status ── */
export function InlineLoading(): ReactElement {
  return <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Loading...</span>;
}

/* ── Styles ── */
const centerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "32px 16px",
  color: "var(--text-secondary)",
};

const spinnerStyle: CSSProperties = {
  width: "20px",
  height: "20px",
  border: "2px solid var(--border)",
  borderTopColor: "var(--accent)",
  borderRadius: "50%",
  animation: "spin 0.6s linear infinite",
};

const bannerStyle: CSSProperties = {
  padding: "8px 12px",
  background: "rgba(220,38,38,0.1)",
  border: "1px solid rgba(220,38,38,0.3)",
  borderRadius: "4px",
  color: "#dc2626",
  fontSize: "13px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "8px",
};

const dismissStyle: CSSProperties = {
  cursor: "pointer",
  fontSize: "16px",
  lineHeight: 1,
  marginLeft: "8px",
};
