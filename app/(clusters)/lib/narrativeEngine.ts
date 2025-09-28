// Narrative Engine: transforms deterministic InsightsEvidence into user-facing narrative
// No raw numeric thresholds are exposed; outputs concise actionable prose.

import type { Insights } from './types';
import { extractInsightsEvidence, hasStrongAlignment, isMisaligned, type InsightsEvidence } from './insightsEvidence';

export interface NarrativeInsights extends Insights {
  evidence?: InsightsEvidence; // optionally attach (internal use, gated behind disclosure UI)
  status: 'early' | 'validating' | 'pivot_signal' | 'fragmented' | 'focused';
  confidence: 'low' | 'medium' | 'high';
  // Additional structured fields for future UI sections
  validatedThemes: string[]; // PS themes clearly present
  gaps: string[];            // PS themes missing/weak
  emergent: string[];        // strong non-PS themes
  earlySignals: string[];    // weak non-PS signals
}

// Public entry: build narrative from current state slices
export function buildNarrative(params: {
  clustersRes: any; // shape validated inside evidence extractor
  psThemes: string[]; // lowercased PS themes
  matrix: Array<[string, Record<string, number>]>; // interview matrix snapshot
}): NarrativeInsights | null {
  const evidence = extractInsightsEvidence(params);
  if (!evidence) return null;

  const strongAlignment = hasStrongAlignment(evidence);
  const misaligned = isMisaligned(evidence);

  // Derive validated themes (problem themes with at least moderate presence)
  const validatedThemes = evidence.themePresence
    .filter(t => t.isProblemTheme && (t.tier === 'strong' || t.tier === 'moderate'))
    .map(t => t.theme);
  const gaps = [...evidence.missingProblemThemes, ...evidence.weakProblemThemes.filter(t => !evidence.missingProblemThemes.includes(t))];
  const emergent = evidence.emergentThemes;
  const earlySignals = evidence.earlySignals;

  // Status classification
  let status: NarrativeInsights['status'] = 'fragmented';
  if (evidence.dominancePattern === 'early') status = 'early';
  else if (misaligned && emergent.length > 0) status = 'pivot_signal';
  else if (evidence.dominancePattern === 'focused' && strongAlignment) status = 'focused';
  else if (validatedThemes.length > 0) status = 'validating';

  // Confidence heuristic
  let confidence: NarrativeInsights['confidence'] = 'low';
  if (evidence.interviewsCount >= 12 && validatedThemes.length >= Math.ceil(evidence.problemThemes.length * 0.5)) confidence = 'medium';
  if (evidence.interviewsCount >= 16 && gaps.length === 0 && validatedThemes.length === evidence.problemThemes.length) confidence = 'high';
  if (status === 'early') confidence = 'low';

  const summary = buildSummaryParagraph({ evidence, validatedThemes, gaps, emergent, earlySignals, strongAlignment, misaligned, status });
  const focusNow = buildFocusNow({ validatedThemes, gaps, emergent, status });
  const twoExperiments = buildExperiments({ gaps, emergent, earlySignals, status });
  const tightenData = buildTightenData({ evidence, gaps, status });
  const whyThisMakesSense = buildWhy({ status, strongAlignment, misaligned });

  return {
    summary,
    focusNow,
    twoExperiments,
    tightenData,
    whyThisMakesSense,
    evidence, // attached for internal use
    status,
    confidence,
    validatedThemes,
    gaps,
    emergent,
    earlySignals,
  };
}

function humanList(items: string[], opts: { none?: string } = {}): string {
  if (!items.length) return opts.none || '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function buildSummaryParagraph(ctx: { evidence: InsightsEvidence; validatedThemes: string[]; gaps: string[]; emergent: string[]; earlySignals: string[]; strongAlignment: boolean; misaligned: boolean; status: NarrativeInsights['status'] }): string {
  const { evidence, validatedThemes, gaps, emergent, earlySignals, strongAlignment, misaligned, status } = ctx;
  const parts: string[] = [];
  // Opening framing
  if (status === 'early') {
    parts.push(`Too early for a firm read: only ${evidence.interviewsCount} interviews. Treat signals as directional.`);
  } else if (strongAlignment) {
    parts.push('Your interviews largely reinforce the current Problem Statement.');
  } else if (misaligned) {
    parts.push('Interviews are pulling away from your Problem Statement.');
  } else if (validatedThemes.length) {
    parts.push('Some Problem Statement themes are showing up, but the picture is mixed.');
  } else {
    parts.push('Theme distribution is fragmented with limited convergence so far.');
  }
  if (validatedThemes.length) {
    parts.push(`Validated: ${humanList(validatedThemes)}` + (gaps.length ? '.' : ' are present.'));
  }
  if (gaps.length) {
    parts.push(`Missing or weak: ${humanList(gaps)}.`);
  }
  if (emergent.length) {
    parts.push(`Emergent: ${humanList(emergent)}.`);
  }
  if (!emergent.length && earlySignals.length) {
    parts.push(`Early signals: ${humanList(earlySignals)} (watch, not yet core).`);
  }
  return parts.join(' ');
}

function buildFocusNow(ctx: { validatedThemes: string[]; gaps: string[]; emergent: string[]; status: NarrativeInsights['status'] }): string[] {
  const { validatedThemes, gaps, emergent, status } = ctx;
  const out: string[] = [];
  if (status === 'early') {
    out.push('Collect 4–6 more interviews before locking focus');
  }
  if (gaps.length) {
    out.push(`Probe explicitly for ${humanList(gaps)} in next interviews`);
  } else if (validatedThemes.length && status !== 'early') {
    out.push(`Deepen understanding of ${validatedThemes[0]} (moments, frequency, current workaround)`);
  }
  if (emergent.length && !validatedThemes.includes(emergent[0])) {
    out.push(`Assess if ${emergent[0]} should enter the Problem Statement`);
  }
  if (!out.length) out.push('Continue interviewing to strengthen signal');
  return out.slice(0, 3);
}

function buildExperiments(ctx: { gaps: string[]; emergent: string[]; earlySignals: string[]; status: NarrativeInsights['status'] }): string[] {
  const { gaps, emergent, earlySignals, status } = ctx;
  const ex: string[] = [];
  if (status === 'early') {
    ex.push('Schedule next 3 interviews with contrasting contexts');
    ex.push('Standardize note-taking template to reduce noise');
    return ex;
  }
  if (gaps.length) {
    ex.push(`Design an interview guide branch specifically targeting ${gaps[0]}`);
  }
  if (emergent.length) {
    ex.push(`Run a quick screener to size ${emergent[0]} prevalence`);
  } else if (earlySignals.length) {
    ex.push(`Add a closing question to test if ${earlySignals[0]} matters broadly`);
  }
  if (!ex.length) {
    ex.push('Pilot a lightweight solution sketch with 2 users');
  }
  if (ex.length === 1) {
    ex.push('Shadow a user performing the workflow end-to-end');
  }
  return ex.slice(0, 2);
}

function buildTightenData(ctx: { evidence: InsightsEvidence; gaps: string[]; status: NarrativeInsights['status'] }): string[] {
  const { evidence, gaps, status } = ctx;
  const td: string[] = [];
  if (status === 'early') {
    td.push('Capture context (role, frequency) consistently in notes');
    td.push('Log missing moments vs outcomes distinctly');
    return td;
  }
  if (gaps.length) td.push('Add explicit checklist for each Problem Statement theme in notes');
  if (evidence.emergentThemes.length) td.push('Tag emergent mentions with a consistent shorthand');
  if (!td.length) td.push('Introduce lightweight coding pass to quantify frequency');
  return td.slice(0, 2);
}

function buildWhy(ctx: { status: NarrativeInsights['status']; strongAlignment: boolean; misaligned: boolean }): string {
  const { status, strongAlignment, misaligned } = ctx;
  if (status === 'early') return 'Low interview count means any focus choice now would be premature.';
  if (misaligned) return 'Signals differ from stated problem; adapting early prevents sunk cost.';
  if (strongAlignment) return 'Consistent recurrence across interviews indicates the core struggle is real.';
  if (status === 'pivot_signal') return 'Emergent themes dominate interviews, suggesting reframing may unlock clarity.';
  return 'Mixed validation warrants simultaneous probing and pruning to converge faster.';
}
