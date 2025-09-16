export function Chip({ children }: { children: React.ReactNode }) {
  let label: string;
  if (typeof children === 'string') label = children;
  else if (typeof children === 'number') label = String(children);
  else if (typeof children === 'object' && children !== null) {
    const obj = children as unknown;
    if (typeof obj === 'object' && obj !== null && 'tag' in obj) label = String((obj as Record<string, unknown>).tag);
    else label = JSON.stringify(children);
  } else label = String(children ?? '');
  return <span className="chip">{label}</span>;
}
