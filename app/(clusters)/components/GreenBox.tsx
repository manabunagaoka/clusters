export function GreenBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      border: '1px solid #D1FAE5',
      background: '#ECFDF5',
      color: '#065F46',
      borderRadius: 8,
      padding: 12,
    }}>
      {children}
    </div>
  )
}
