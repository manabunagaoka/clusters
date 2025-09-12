export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      background: '#F3F4F6',
      color: '#111827',
      fontSize: 12,
      marginRight: 6,
      marginBottom: 6,
    }}>
      {children}
    </span>
  )
}
