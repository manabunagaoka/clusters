export function LoaderDots({ size = 4 }: { size?: number }) {
  const dot = {
    display: 'inline-block',
    width: size,
    height: size,
    marginLeft: size,
    borderRadius: '50%',
    background: 'currentColor',
    animation: 'pulse 1.2s infinite ease-in-out both',
  } as const
  return (
    <span aria-label="loading" role="status" style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ ...dot, animationDelay: '0s' }} />
      <span style={{ ...dot, animationDelay: '0.2s' }} />
      <span style={{ ...dot, animationDelay: '0.4s' }} />
    </span>
  )
}
