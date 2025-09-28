// Simple, domain-agnostic helpers
export function canonicalTag(tag: string): string {
  // snake_case canonicalization
  return (tag || '')
    .toLowerCase()
    .trim()
    .replace(/[-\s]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

export function humanizeTag(tag: string): string {
  const t = (tag || '').toString().replace(/[-_]+/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function alignToAnchors(items: string[], anchors: string[]): string[] {
  const A = new Set(anchors.map(canonicalTag))
  return (items || []).filter((i) => A.has(canonicalTag(i)))
}
