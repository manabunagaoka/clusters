// LoaderDots (default export) renders three animated dots.
// Styling is handled globally: .loader-dot plus parent context (e.g. .btn-primary overrides color)
export default function LoaderDots({ size = 4, 'aria-label': ariaLabel = 'loading' }: { size?: number; 'aria-label'?: string }) {
  const outer: React.CSSProperties = { display: 'inline-flex', alignItems: 'center' };
  const base: React.CSSProperties = {
    width: size,
    height: size,
    marginLeft: size,
    borderRadius: '50%',
    animation: 'pulse 1.1s infinite ease-in-out both'
  };
  return (
    <span aria-label={ariaLabel} role="status" style={outer}>
      <span className="loader-dot" style={{ ...base, marginLeft: 0, animationDelay: '0s' }} />
      <span className="loader-dot" style={{ ...base, animationDelay: '0.2s' }} />
      <span className="loader-dot" style={{ ...base, animationDelay: '0.4s' }} />
    </span>
  );
}
