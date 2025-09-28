export async function fetchJsonSafe<T = unknown>(path: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string }>{
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE || ''
    const url = base && path.startsWith('/') ? `${base}${path}` : path
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      ...init,
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const data = (await res.json()) as T
    return { ok: true, data }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'network-error'
    return { ok: false, error: msg }
  }
}
