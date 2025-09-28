import { NextRequest, NextResponse } from 'next/server';

/*
  /api/insights
  Deterministic heuristic layer over extracted interview theme matrix.
  Input (POST JSON): {
    problem?: { text?: string; tags?: string[] },
    matrix: Array<[string, Record<string, number>]>, // from /api/themes or profiles equivalently
    display?: Array<{ id: string; top_cores?: { core:string; weight_label:string }[]; why?: string[] }>,
    clusters?: { id: number|string; size: number; centroid: Record<string, number>; top_dims: string[]; representatives: string[] }[]
  }
  Output: { insights, metrics }

  We DO NOT mutate the extraction model here; purely interpretive.
*/

type ThemeMatrixRow = [string, Record<string, number>];

interface InsightsInput {
  problem?: { text?: string; tags?: string[] };
  matrix?: ThemeMatrixRow[];
  display?: any[];
  clusters?: { id: number|string; size: number; centroid: Record<string, number>; top_dims: string[]; representatives: string[] }[];
}

interface CoverageEntry { core: string; pct: number; count: number; label: 'Strong'|'Emerging'|'Weak'; }
interface LeakageEntry { core: string; pct: number; recommendation: string; }

interface InsightsPayload {
  summary: string;
  focusNow: string[];
  twoExperiments: string[];
  tightenData: string[];
  whyThisMakesSense: string;
}

interface InsightsResponse {
  insights: InsightsPayload;
  metrics: {
    problem_cores: string[];
    coverage: CoverageEntry[];
    leakage: LeakageEntry[];
    missing: string[];
    convergence: { all_ps_cores_pct: number; full_set_interview_pct: number; intersection_size: number };
    imbalance?: { spread: number; dominant?: string };
    clusters_summary?: Array<{ id: string; emphasis: string[]; representatives: string[]; size: number }>;
    notes: string[];
  };
  warning?: string;
}

function classifyCoverage(pct: number): CoverageEntry['label'] {
  if (pct >= 0.7) return 'Strong';
  if (pct >= 0.4) return 'Emerging';
  return 'Weak';
}

function percent(n: number, d: number): number { return d === 0 ? 0 : +(n / d).toFixed(4); }

function summarizeClusters(clusters: InsightsInput['clusters'], psCores: string[]): Array<{ id: string; emphasis: string[]; representatives: string[]; size: number }> {
  if (!clusters || !clusters.length) return [];
  return clusters.map(c => {
    // emphasis: sort ps cores present in centroid by descending weight
    const emphasis = Object.entries(c.centroid)
      .filter(([k,v]) => psCores.includes(k) && v>0)
      .sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]))
      .slice(0,3)
      .map(([k])=>k);
    return { id: String(c.id), emphasis, representatives: c.representatives?.slice(0,2)||[], size: c.size };
  });
}

function buildNarrative(params: {
  psCores: string[];
  coverage: CoverageEntry[];
  leakage: LeakageEntry[];
  missing: string[];
  imbalance?: { spread: number; dominant?: string };
  clusters: Array<{ id: string; emphasis: string[]; representatives: string[]; size: number }>;
  total: number;
  convergencePct: number;
}): InsightsPayload {
  const { psCores, coverage, leakage, missing, imbalance, clusters, total, convergencePct } = params;
  const strong = coverage.filter(c=>c.label==='Strong');
  const emerging = coverage.filter(c=>c.label==='Emerging');
  const weak = coverage.filter(c=>c.label==='Weak');
  const leakageMentions = leakage.map(l=>l.core).join(', ');
  const dominant = imbalance?.dominant;

  const summaryParts: string[] = [];
  if (strong.length === psCores.length) {
    summaryParts.push('All problem statement themes show strong evidence across interviews.');
  } else {
    if (strong.length) summaryParts.push(`Strong: ${strong.map(s=>s.core).join(', ')}`);
    if (emerging.length) summaryParts.push(`Emerging: ${emerging.map(s=>s.core).join(', ')}`);
    if (weak.length) summaryParts.push(`Weak: ${weak.map(s=>s.core).join(', ')}`);
  }
  if (leakage.length) summaryParts.push(`Leakage cores detected: ${leakageMentions}.`);
  if (missing.length) summaryParts.push(`Missing evidence for: ${missing.join(', ')}.`);
  summaryParts.push(`Convergence: ${(convergencePct*100).toFixed(0)}% of interviews express all PS themes.`);

  const focusNow: string[] = [];
  if (missing.length) focusNow.push('Refine probing questions for missing themes');
  if (leakage.length) focusNow.push('Decide whether to expand scope or tighten wording');
  if (!missing.length && !leakage.length) focusNow.push('Move to synthesis / segmentation');
  if (dominant) focusNow.push(`Check if '${dominant}' overweight is sampling bias`);

  const twoExperiments: string[] = [];
  if (weak.length) twoExperiments.push(`Run 3 follow-up interviews focused on ${weak.map(w=>w.core).join(', ')} cues`);
  if (leakage.length) twoExperiments.push(`Add disambiguation question to confirm if ${leakageMentions} is real vs lexical artifact`);
  if (!twoExperiments.length) twoExperiments.push('Pilot a lightweight solution concept to test outcome sensitivity');
  if (twoExperiments.length === 1) twoExperiments.push('Create a scoring rubric for interview note quality (consistency, specificity)');

  const tightenData: string[] = [];
  if (leakage.length) tightenData.push('Normalize phrasing that accidentally triggers non-PS cores');
  if (weak.length) tightenData.push('Ensure every interview includes at least one concrete pain + outcome sentence');
  if (!tightenData.length) tightenData.push('Dataset is balanced; maintain note quality in future rounds');

  const clusterPhrase = clusters.length ? `Sub-flavors present (${clusters.map(c=>c.emphasis.join('/')||'n/a').join('; ')}) but all reinforce PS themes.` : 'No meaningful sub-clusters identified.';
  const whyThisMakesSense = [
    clusterPhrase,
    leakage.length ? 'Leakage appears mild and likely lexical.' : 'No significant leakage detected.',
    imbalance ? 'One theme dominates; verify it is not interviewer bias.' : 'Theme distribution appears balanced.'
  ].join(' ');

  return { summary: summaryParts.join(' '), focusNow, twoExperiments, tightenData, whyThisMakesSense }; 
}

export async function POST(req: NextRequest) {
  let payload: any = {};
  try { payload = await req.json(); } catch {}

  // Backward compatibility: existing UI sends { state } instead of the explicit contract.
  if (payload.state && (!payload.matrix || !payload.problem)) {
    const st = payload.state;
    const psTags = Array.isArray(st.psTags) ? st.psTags : [];
    const psCoresDerived = psTags.map((t: any)=> typeof t === 'string' ? t : t?.tag).filter(Boolean);
    // Prefer profilesMatrix (already used after themes extraction), fall back to interviewMatrix if present.
    const matrixSource: Array<[string, Record<string, number>]> = Array.isArray(st.profilesMatrix) ? st.profilesMatrix : Array.isArray(st.interviewMatrix) ? st.interviewMatrix : [];
    // clustersRes shape: { clusters: [{ id, size, centroid: { core: weight }, top_dims, representatives }] }
    let clustersFromState: any[] = [];
    if (st.clustersRes && Array.isArray(st.clustersRes.clusters)) {
      clustersFromState = st.clustersRes.clusters.map((c: any) => ({
        id: c.id,
        size: c.size,
        centroid: c.centroid || {},
        top_dims: c.top_dims || c.topDims || [],
        representatives: c.representatives || []
      }));
    }
    // Populate explicit fields if not provided
    payload.problem = payload.problem || { text: st.psText, tags: payload.problem?.tags || psCoresDerived };
    payload.matrix = payload.matrix || matrixSource;
    payload.display = payload.display || st.themesDisplay || undefined;
    payload.clusters = payload.clusters || clustersFromState;
  }

  const matrix = (payload.matrix || []) as ThemeMatrixRow[];
  const psCores = (payload.problem?.tags || []).filter((c: string)=> !!c);
  if (!matrix.length || !psCores.length) {
    return NextResponse.json({ warning: 'Missing matrix or problem statement cores.', insights: null }, { status: 400 });
  }
  const total = matrix.length;

  // Coverage counts
  const coverageCounts: Record<string, number> = {};
  matrix.forEach(([_, weights]) => {
    psCores.forEach((core: string) => { if ((weights as Record<string, number>)[core] && (weights as Record<string, number>)[core] > 0) coverageCounts[core] = (coverageCounts[core]||0)+1; });
  });
  const coverage: CoverageEntry[] = psCores.map((core: string) => {
    const count = coverageCounts[core]||0;
    const pct = percent(count, total);
    return { core, pct, count, label: classifyCoverage(pct) };
  });

  // Leakage: any non-PS core with coverage >= 20%
  const nonPsCounts: Record<string, number> = {};
  matrix.forEach(([_, w]) => {
    Object.entries(w).forEach(([core, weight]) => {
      if (!psCores.includes(core) && weight>0) {
        nonPsCounts[core] = (nonPsCounts[core]||0)+1;
      }
    });
  });
  const leakage: LeakageEntry[] = Object.entries(nonPsCounts)
    .filter(([_,cnt]) => cnt/total >= 0.2)
    .sort((a,b)=> b[1]-a[1])
    .map(([core,cnt]) => ({ core, pct: percent(cnt,total), recommendation: `Decide: incorporate '${core}' or adjust phrasing to reduce accidental triggers.` }));

  // Missing PS cores (<30% coverage)
  const missing = coverage.filter(c=> c.pct < 0.3).map(c=>c.core);

  // Convergence: fraction of interviews containing all PS cores
  let fullSetCount = 0;
  matrix.forEach(([_, w]) => {
  if (psCores.every((c: string) => (w as Record<string, number>)[c] && (w as Record<string, number>)[c] > 0)) fullSetCount += 1;
  });
  const convergence = {
    all_ps_cores_pct: percent(fullSetCount, total),
    full_set_interview_pct: percent(fullSetCount, total), // alias for clarity
    intersection_size: fullSetCount
  };

  // Imbalance: measure spread between max & min PS coverage pct
  const covPcts = coverage.map(c=>c.pct);
  let imbalance: { spread: number; dominant?: string }|undefined;
  if (covPcts.length >= 2) {
    const sorted = [...coverage].sort((a,b)=> a.pct-b.pct);
    const spread = +(sorted[sorted.length-1].pct - sorted[0].pct).toFixed(4);
    if (spread >= 0.4) imbalance = { spread, dominant: sorted[sorted.length-1].core };
  }

  // Cluster summarization (optional)
  const clusters = summarizeClusters(payload.clusters, psCores);

  // Narrative assembly
  const insights = buildNarrative({
    psCores,
    coverage,
    leakage,
    missing,
    imbalance,
    clusters,
    total,
    convergencePct: convergence.all_ps_cores_pct,
  });

  const notes: string[] = [];
  if (!leakage.length && !missing.length) notes.push('High confidence in PS focus based on current data size.');
  if (missing.length) notes.push('Consider targeted follow-ups to confirm absence vs poor questioning.');
  if (leakage.length) notes.push('Leakage may indicate adjacent unmet needs or wording artifacts.');

  const response: InsightsResponse = {
    insights,
    metrics: {
      problem_cores: psCores,
      coverage,
      leakage,
      missing,
      convergence,
      imbalance,
      clusters_summary: clusters,
      notes
    }
  };
  return NextResponse.json(response);
}

export const dynamic = 'force-dynamic';
