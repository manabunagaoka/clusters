// Action recommendation generator
// Consumes narrative (extended insights) and returns up to 5 concrete next actions.

export interface NarrativeLike {
  status?: string;
  confidence?: string;
  validatedThemes?: string[];
  gaps?: string[];
  emergent?: string[];
  earlySignals?: string[];
  focusNow?: string[] | string;
}

export function generateActions(n: NarrativeLike | null | undefined): string[] {
  if (!n) return [];
  const actions: string[] = [];
  const gaps = (n.gaps || []).slice(0, 3);
  const emergent = (n.emergent || []).slice(0, 2);
  const early = (n.earlySignals || []).slice(0, 1);

  if (n.status === 'early') {
    actions.push('Add 4–6 more interviews to firm up signal');
  }
  gaps.forEach(g => actions.push(`Design targeted interview guide section to probe ${g} root causes`));
  emergent.forEach(e => actions.push(`Quantify prevalence of emerging theme “${e}” with a short screener`));
  if (early.length && !emergent.length) actions.push(`Lightweight test question to validate if “${early[0]}” matters broadly`);
  if ((n.validatedThemes || []).length && (n.confidence === 'medium' || n.confidence === 'high')) {
    actions.push(`Sketch solution concept around ${(n.validatedThemes||[])[0]} and pressure-test willingness to change`);
  }
  if (n.confidence === 'high') actions.push('Begin narrowing scope to a single high-friction moment');
  return Array.from(new Set(actions)).slice(0, 5);
}
