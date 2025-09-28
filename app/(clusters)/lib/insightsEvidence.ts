// Internal evidence extraction for Insights (interpretation-first layer)
// This module produces structured, deterministic evidence primitives.
// No user-facing prose here; narrative layer will consume this.

import type { ClustersResult } from './types';

// Core theme universe (mirrors extraction order elsewhere)
const CORES = ['cost','time','effort','quality','reliability','trust','flexibility','choice','information','access','support','risk','value'] as const;
export type CoreTheme = typeof CORES[number];

// Thresholds are deliberately internal; UI will not surface raw numbers.
// Presence refers to proportion of interviews mentioning theme (>0 weight) OR
// proportion of cluster centroid weight for cluster-level reasoning.
const THRESHOLDS = {
  themeStrongPresencePct: 0.30, // 30% of interviews mention it
  themeModeratePresencePct: 0.15, // 15–29% moderate
  themeWeakPresencePct: 0.05, // 5–14% weak signal
  emergentMinPct: 0.30,       // Non-PS core appears in ≥30% interviews
  weakSignalMinPct: 0.10,     // Lower bound for early signal bucket
  weakSignalMaxPct: 0.29,
  dominanceStrongClusterShare: 0.40, // ≥40% sample in one cluster -> focused
  dominanceMinInterviewsForReliability: 8, // Early gate
};

export interface ThemePresenceRecord {
  theme: CoreTheme;
  interviewPct: number; // 0–1
  tier: 'strong' | 'moderate' | 'weak' | 'absent';
  isProblemTheme: boolean;
  isEmergent: boolean; // candidate emergent (non-PS strong or meets emergent threshold)
}

export interface ClusterEvidenceSummary {
  id: number;
  size: number;
  sizePct: number; // 0–1
  topThemes: CoreTheme[]; // top centroid dims truncated
  psOverlap: CoreTheme[]; // intersection with psThemes
  emergentThemes: CoreTheme[]; // non-PS high-weight themes among top dims
}

export type DominancePattern = 'focused' | 'split' | 'fragmented' | 'single' | 'early';

export interface InsightsEvidence {
  interviewsCount: number;
  k: number;
  problemThemes: CoreTheme[];
  themePresence: ThemePresenceRecord[]; // sorted deterministic
  clusters: ClusterEvidenceSummary[]; // letter ordering A,B,C...
  missingProblemThemes: CoreTheme[]; // absent or weak below weak threshold
  weakProblemThemes: CoreTheme[]; // weak tier among PS themes
  emergentThemes: CoreTheme[]; // strong non-PS
  earlySignals: CoreTheme[]; // weak signals (non-PS 10–29%)
  dominancePattern: DominancePattern;
  dominantClusterId?: number;
  timestamp: number;
}

export interface ExtractEvidenceParams {
  clustersRes: ClustersResult | null; // from state
  psThemes: string[];                // lowercased PS core themes
  matrix: Array<[string, Record<string, number>]>; // interview -> weights (snapshot at run)
}

function classifyPresence(pct: number): ThemePresenceRecord['tier'] {
  if (pct >= THRESHOLDS.themeStrongPresencePct) return 'strong';
  if (pct >= THRESHOLDS.themeModeratePresencePct) return 'moderate';
  if (pct >= THRESHOLDS.themeWeakPresencePct) return 'weak';
  return 'absent';
}

export function extractInsightsEvidence({ clustersRes, psThemes, matrix }: ExtractEvidenceParams): InsightsEvidence | null {
  if (!clustersRes || !Array.isArray(clustersRes.clusters) || clustersRes.clusters.length === 0) return null;
  const problemThemes: CoreTheme[] = (psThemes||[]).map(t=> t.toLowerCase()).filter((t): t is CoreTheme => (CORES as readonly string[]).includes(t));
  const interviewsCount = Array.isArray(matrix) ? matrix.length : 0;
  const k = clustersRes.k_selected || clustersRes.clusters.length;

  // Build presence counts (interview-level theme presence)
  const presenceCounts: Record<CoreTheme, number> = CORES.reduce((acc, c)=> { acc[c]=0; return acc; }, {} as Record<CoreTheme, number>);
  for (const [, weights] of matrix) {
    for (const core of CORES) {
      if ((weights?.[core] || 0) > 0) presenceCounts[core] += 1;
    }
  }
  const themePresence: ThemePresenceRecord[] = CORES.map(theme => {
    const pct = interviewsCount > 0 ? presenceCounts[theme] / interviewsCount : 0;
    const tier = classifyPresence(pct);
    const isProblemTheme = problemThemes.includes(theme);
    // Emergent if NOT a problem theme and meets emergentMin threshold
    const isEmergent = !isProblemTheme && pct >= THRESHOLDS.emergentMinPct;
    return { theme, interviewPct: pct, tier, isProblemTheme, isEmergent };
  }).sort((a,b)=> {
    // Stable deterministic ordering: stronger tier first, then pct desc, then alpha
    const tierRank = (t:ThemePresenceRecord['tier']) => ({strong:3, moderate:2, weak:1, absent:0}[t]);
    const d = tierRank(b.tier) - tierRank(a.tier) || b.interviewPct - a.interviewPct || a.theme.localeCompare(b.theme);
    return d;
  });

  // Cluster summaries
  const totalSize = clustersRes.clusters.reduce((s,c)=> s + (c.size||0), 0) || 1;
  const clusterSummaries: ClusterEvidenceSummary[] = clustersRes.clusters.map((c)=> {
    const topThemes = (c.top_dims || []).slice(0,3).filter((t): t is CoreTheme => (CORES as readonly string[]).includes(t));
    const psOverlap = topThemes.filter(t=> problemThemes.includes(t));
    const emergentThemes = topThemes.filter(t=> !problemThemes.includes(t));
    return {
      id: c.id,
      size: c.size,
      sizePct: c.size / totalSize,
      topThemes,
      psOverlap,
      emergentThemes,
    };
  }).sort((a,b)=> b.size - a.size || a.id - b.id);

  // Determine missing / weak problem themes
  const missingProblemThemes: CoreTheme[] = themePresence.filter(tp=> tp.isProblemTheme && (tp.tier==='absent')).map(tp=> tp.theme);
  const weakProblemThemes: CoreTheme[] = themePresence.filter(tp=> tp.isProblemTheme && tp.tier==='weak').map(tp=> tp.theme);

  // Emergent + early signals (non-PS) using presence tiers
  const emergentThemes: CoreTheme[] = themePresence.filter(tp=> !tp.isProblemTheme && tp.interviewPct >= THRESHOLDS.emergentMinPct).map(tp=> tp.theme);
  const earlySignals: CoreTheme[] = themePresence.filter(tp=> !tp.isProblemTheme && tp.interviewPct >= THRESHOLDS.weakSignalMinPct && tp.interviewPct <= THRESHOLDS.weakSignalMaxPct && !emergentThemes.includes(tp.theme)).map(tp=> tp.theme);

  // Dominance pattern
  let dominancePattern: DominancePattern = 'fragmented';
  let dominantClusterId: number | undefined;
  if (k === 1) {
    dominancePattern = 'single';
  } else if (interviewsCount < THRESHOLDS.dominanceMinInterviewsForReliability) {
    dominancePattern = 'early';
  } else {
    const top = clusterSummaries[0];
    const second = clusterSummaries[1];
    if (top && top.sizePct >= THRESHOLDS.dominanceStrongClusterShare) {
      dominancePattern = 'focused';
      dominantClusterId = top.id;
    } else if (top && second && Math.abs(top.sizePct - second.sizePct) < 0.10 && (top.sizePct + second.sizePct) >= 0.55) {
      dominancePattern = 'split';
    }
  }

  const evidence: InsightsEvidence = {
    interviewsCount,
    k,
    problemThemes,
    themePresence,
    clusters: clusterSummaries,
    missingProblemThemes,
    weakProblemThemes,
    emergentThemes,
    earlySignals,
    dominancePattern,
    dominantClusterId,
    timestamp: Date.now(),
  };
  return evidence;
}

// Convenience: quick summary booleans for narrative engine (optional future helpers)
export function hasStrongAlignment(e: InsightsEvidence): boolean {
  const strongPS = e.themePresence.filter(t=> t.isProblemTheme && t.tier==='strong').length;
  return strongPS >= Math.ceil(e.problemThemes.length * 0.5) && e.missingProblemThemes.length === 0;
}

export function isMisaligned(e: InsightsEvidence): boolean {
  const strongPS = e.themePresence.filter(t=> t.isProblemTheme && (t.tier==='strong' || t.tier==='moderate')).length;
  const emergentDominant = e.emergentThemes.length > 0 && strongPS === 0;
  return emergentDominant || (strongPS === 0 && e.problemThemes.length > 0);
}
