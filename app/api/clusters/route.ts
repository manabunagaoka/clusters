import { NextRequest, NextResponse } from 'next/server';
import { FACET_BLOCKLIST, CORE_DIMENSIONS } from '@/app/(clusters)/lib/universals';

/* ================= Types ================= */
type MatrixRow = [string, Record<string, number>];
interface ClusterProfileLite { id: string; themes?: { facets?: string[] } }

/* ================= Vector utilities ================= */
function cosineSim(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
const cosineDist = (a: number[], b: number[]) => 1 - cosineSim(a, b);

function normalize(v: number[]) {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map(x => x / n);
}

function buildVectors(matrix: MatrixRow[]) {
  const keySet = new Set<string>();
  matrix.forEach(([, m]) => Object.keys(m || {}).forEach(k => keySet.add(k)));
  const keys = Array.from(keySet).sort();
  const vectors = matrix.map(([id, m]) => {
    const raw = keys.map(k => Number(m?.[k] || 0));
    return { id: String(id), v: normalize(raw) };
  });
  return { keys, vectors };
}

/* ================= Sanitization Helpers ================= */
const LOW = 0.33, MED = 0.67, HIGH = 1.0;
function toWeight(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.min(1, v));
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'low') return LOW;
    if (s === 'med' || s === 'medium') return MED;
    if (s === 'high') return HIGH;
    const num = Number(s);
    if (isFinite(num)) return Math.max(0, Math.min(1, num));
  }
  return 0;
}

function sanitizeMatrix(matrix: [string, Record<string, any>][]) {
  const cores = CORE_DIMENSIONS as string[];
  const out: [string, Record<string, number>][] = [];
  for (const row of Array.isArray(matrix) ? matrix : []) {
    const id = String(row?.[0] ?? '');
    const m = (row?.[1] ?? {}) as Record<string, any>;
    const w: Record<string, number> = {};
    let sum = 0;
    for (const c of cores) {
      const val = toWeight(m[c]);
      if (val > 0) { w[c] = val; sum += val; }
    }
    if (id && sum > 0) out.push([id, w]);
  }
  return out;
}

/* ================= k-means (cosine) ================= */
interface KMRes { centroids: number[][]; assignments: number[] }
function kmeansCosine(vectors: { id: string; v: number[] }[], k: number, maxIter = 20): KMRes {
  if (!vectors.length) return { centroids: [], assignments: [] };
  const dim = vectors[0].v.length;
  // deterministic init: first k vectors (or wrap) copied
  const centroids = Array.from({ length: k }, (_, i) => vectors[i % vectors.length].v.slice()).map(normalize);
  const assignments = new Array(vectors.length).fill(-1);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < vectors.length; i++) {
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = cosineDist(vectors[i].v, centroids[c]);
        if (d < bestDist) { bestDist = d; best = c; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    // recompute centroids
    const sums = centroids.map(() => new Array(dim).fill(0));
    const counts = centroids.map(() => 0);
    for (let i = 0; i < vectors.length; i++) {
      const cid = assignments[i];
      const v = vectors[i].v;
      for (let j = 0; j < dim; j++) sums[cid][j] += v[j];
      counts[cid]++;
    }
    let reseeded = false;
    for (let c = 0; c < centroids.length; c++) {
      if (counts[c] === 0) {
        // reseed from a spread index to avoid duplicating another centroid
        const seedIdx = (c + iter) % vectors.length;
        centroids[c] = vectors[seedIdx].v.slice();
        reseeded = true;
      } else {
        centroids[c] = normalize(sums[c]);
      }
    }
    if (reseeded) changed = true; // force another iteration so reseeded centroid can acquire members
    if (!changed) break;
  }
  return { centroids, assignments };
}

/* ================= Silhouette ================= */
function silhouette(vectors: { v: number[] }[], assignments: number[], centroids: number[][]) {
  if (vectors.length < 2) return 0;
  const k = centroids.length;
  let total = 0, count = 0;
  for (let i = 0; i < vectors.length; i++) {
    const ci = assignments[i];
    // a(i)
    let aSum = 0, aN = 0;
    for (let j = 0; j < vectors.length; j++) if (assignments[j] === ci && j !== i) {
      aSum += cosineDist(vectors[i].v, vectors[j].v); aN++; }
    const a = aN ? aSum / aN : 0;
    // b(i)
    let b = Infinity;
    for (let c = 0; c < k; c++) if (c !== ci) {
      let s = 0, n = 0;
      for (let j = 0; j < vectors.length; j++) if (assignments[j] === c) { s += cosineDist(vectors[i].v, vectors[j].v); n++; }
      if (n > 0) b = Math.min(b, s / n);
    }
    if (b === Infinity) continue;
    const sVal = (b - a) / Math.max(a, b || 1);
    if (isFinite(sVal)) { total += sVal; count++; }
  }
  return count ? total / count : 0;
}

/* ================= Helpers ================= */
function topDims(keys: string[], centroid: number[], limit = 2) {
  return keys
    .map((k, idx) => [k, centroid[idx]] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

/* ================= Handler ================= */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const debugOn = process.env.CLUSTERS_DEBUG === '1';
    const rawMatrix: MatrixRow[] = Array.isArray(body?.matrix) ? body.matrix : [];
    const matrix: MatrixRow[] = sanitizeMatrix(rawMatrix as any);
    // Raw Problem Statement cores (may be empty or mixed case); normalization happens after key extraction
    const psThemesRaw: string[] = Array.isArray(body?.ps_themes) ? body.ps_themes : [];
    if (!matrix.length) {
      return NextResponse.json({ k_selected: 0, validity: { silhouette: 0, alt: [] }, clusters: [], assignments: [], note: 'empty_or_allzero_matrix' }, { status: 200 });
    }
    const profiles: ClusterProfileLite[] = Array.isArray(body?.profiles) ? body.profiles : [];
    const kRange: [number, number] = Array.isArray(body?.k_range) && body.k_range.length === 2
      ? [Number(body.k_range[0]), Number(body.k_range[1])] : [2, 5];

    const { keys, vectors } = buildVectors(matrix);

    // Normalize incoming ps themes to canonical core ids (lowercase, intersection with the 13 fixed cores)
    const psSet = new Set(
      psThemesRaw
        .map((s:string) => String(s||'').toLowerCase())
        .filter((s:string) => (CORE_DIMENSIONS as string[]).includes(s))
    );
    // Build PS vector aligned to 'keys'
    const psVec = keys.map(k => psSet.has(k) ? 1 : 0);
    const psIsZero = psVec.every(v => v === 0);
    const psNorm = psIsZero ? psVec.slice() : normalize(psVec);

    const alt: { k: number; silhouette: number }[] = [];
    let bestK = kRange[0];
    let bestSil = -Infinity;
    let bestRes: KMRes | null = null;

    for (let k = kRange[0]; k <= kRange[1]; k++) {
      if (vectors.length < k + 2) { alt.push({ k, silhouette: -1 }); continue; }
      const km = kmeansCosine(vectors, k);
      const sil = silhouette(vectors, km.assignments, km.centroids);
      const sRounded = Number(sil.toFixed(3));
      alt.push({ k, silhouette: sRounded });
      if (sil > bestSil) { bestSil = sil; bestK = k; bestRes = km; }
    }

  if (!bestRes) {
      // small-N fallback: single group
      const facetCounts: Record<string, number> = {};
      profiles.forEach(p => (p.themes?.facets || []).forEach(f => { if (!FACET_BLOCKLIST.has(f)) facetCounts[f] = (facetCounts[f] || 0) + 1; }));
      const topFacets = Object.entries(facetCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f]) => f);
      return NextResponse.json({
        k_selected: 1,
        validity: { silhouette: 0, alt: alt },
          clusters: [{ id: 0, size: vectors.length, centroid: Object.fromEntries(keys.map((k) => [k, 0])), top_dims: keys.slice(0, 3), top_facets: topFacets, representatives: vectors.slice(0, Math.min(2, vectors.length)).map(v => v.id), ps_match: 0 }],
        assignments: vectors.map(v => ({ id: v.id, cluster: 0 })),
        note: 'Small-N guard: returned one group.'
      }, { status: 200 });
    }

  const { centroids, assignments } = bestRes;
  const silPrimary = Number(bestSil.toFixed(3));

    // Build cluster metadata
    const facetsByCluster: Record<number, Record<string, number>> = {};
    const repsByCluster: Record<number, { id: string; sim: number }[]> = {};
    assignments.forEach((cid, idx) => {
      const pid = vectors[idx].id;
      const profile = profiles.find(p => String(p.id) === pid);
      const facets = (profile?.themes?.facets || []).filter(f => !FACET_BLOCKLIST.has(f));
      facetsByCluster[cid] = facetsByCluster[cid] || {};
      facets.forEach(f => { facetsByCluster[cid][f] = (facetsByCluster[cid][f] || 0) + 1; });
      const sim = cosineSim(vectors[idx].v, centroids[cid]);
      (repsByCluster[cid] = repsByCluster[cid] || []).push({ id: pid, sim });
    });

    let clusters = centroids.map((cen, idx) => {
      const members = assignments.filter(c => c === idx).length;
      const centroidObj = Object.fromEntries(keys.map((k, idx2) => [k, Number((cen[idx2] || 0).toFixed(2))]));
      const td = topDims(keys, cen, 3);
      const facetCounts = facetsByCluster[idx] || {};
      const topFacets = Object.entries(facetCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f]) => f);
      const reps = (repsByCluster[idx] || []).sort((a, b) => b.sim - a.sim).slice(0, 2).map(r => r.id);
      // ps_match: cosine similarity between centroid and normalized PS vector (if PS provided & centroid non-zero)
      const match = (!psIsZero && cen.some(v => v > 0)) ? Number(cosineSim(psNorm, cen).toFixed(3)) : 0;
      return { id: idx, size: members, centroid: centroidObj, top_dims: td, top_facets: topFacets, representatives: reps, ps_match: match };
    });
    // Drop zero-size clusters
    clusters = clusters.filter(c => c.size > 0);
    if (clusters.length === 0) {
      const facetCounts: Record<string, number> = {};
      profiles.forEach(p => (p.themes?.facets || []).forEach(f => { if (!FACET_BLOCKLIST.has(f)) facetCounts[f] = (facetCounts[f] || 0) + 1; }));
      const topFacets = Object.entries(facetCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f]) => f);
      return NextResponse.json({
        k_selected: 1,
        validity: { silhouette: 0, alt },
        clusters: [{ id: 0, size: vectors.length, centroid: Object.fromEntries(keys.map((k) => [k, 0])), top_dims: keys.slice(0, 3), top_facets: topFacets, representatives: vectors.slice(0, Math.min(2, vectors.length)).map(v => v.id), ps_match: 0 }],
        assignments: vectors.map(v => ({ id: v.id, cluster: 0 })),
        note: 'filtered_all_zero_size'
      }, { status: 200 });
    }
    // Optional debug payload (one-run ephemeral; gated by env flag)
    const note = psIsZero ? 'ps_vector_empty' : '';
    const debug = debugOn ? {
      n_rows: matrix.length,
      keys,
      empty_counts: centroids.map((_, c) => assignments.filter(a => a === c).length)
    } : undefined;
    return NextResponse.json({
      k_selected: bestK,
      validity: { silhouette: silPrimary, alt: alt },
      clusters,
      assignments: vectors.map((v, vi) => ({ id: v.id, cluster: assignments[vi] })),
      note: note || '',
      debug
    }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ k_selected: 0, validity: { silhouette: 0, alt: [] }, clusters: [], assignments: [], note: e instanceof Error ? e.message : 'Clustering failed' }, { status: 200 });
  }
}
