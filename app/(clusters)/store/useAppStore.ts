'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchJsonSafe } from '../lib/net'
import { canonicalTag, humanizeTag } from '../lib/canonical'
import type { AppState, Archetype, Analysis, Insights, PatternCard, Summary, LegacyArchetype, ArchetypeAPIResponse, ProfilesAPIResponse, MetricsResult, ClustersResult, Readiness } from '../lib/types'

// Disable persistence so a full browser refresh/dev restart yields a fresh session
const PERSIST = false;

const DEFAULT_ANCHORS = ['confusing', 'slow', 'manual', 'inconsistent', 'risky', 'expensive', 'time-consuming']

function unique<T>(arr: T[]): T[] { return Array.from(new Set(arr)) }

function inferTagsFromText(text: string): string[] {
  const words = (text || '').toLowerCase().match(/[a-z]{4,}/g) || []
  const hits = words.filter((w) => DEFAULT_ANCHORS.includes(w))
  return unique(hits.length ? hits : words.slice(0, 5)).map(canonicalTag)
}

function stubArchetypes(notes: string, anchors: string[]): Archetype[] {
  const lines = (notes || '').split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const aligned = lines.filter((l) => anchors.some((a) => l.toLowerCase().includes(a)))
  const groups = anchors.slice(0, 3).map((a) => ({ key: a, quotes: aligned.filter((q) => q.toLowerCase().includes(a)) }))
  return groups.map((g, i) => ({
    id: `a${i+1}`,
    name: humanizeTag(g.key),
    narrative: `Often deals with ${humanizeTag(g.key)} situations and wants fewer steps.`,
    tags: [g.key],
    quotes: g.quotes.slice(0, 6),
  }))
}

function stubAnalysis(archetypes: Archetype[]): Analysis {
  const totalQuotes = archetypes.reduce((s, a) => s + a.quotes.length, 0)
  const density = Math.max(0.1, Math.min(1, totalQuotes / 12))
  return {
    readiness: {
      overall: density,
      focus: Math.min(1, (archetypes.length || 1) / 4),
      clear: Math.min(1, density * 0.9 + 0.05),
      action: Math.min(1, density * 0.8 + 0.1),
    },
  clusters: archetypes.map((a) => ({ id: a.id, label: a.name, tags: a.tags, size: a.quotes.length || 1 })),
  }
}

function stubInsights(state: AppState): Insights {
  const topRaw = (state.psTags && state.psTags[0]) ? state.psTags[0].tag : 'Pain'
  const top = humanizeTag(topRaw)
  return {
    summary: `Students are running into ${top.toLowerCase()} in their current flow. Prioritize reducing friction before adding features.`,
    focusNow: [`Reduce ${top.toLowerCase()} in the first-run experience`],
    twoExperiments: [
      'Run a 5-user think-aloud test on the onboarding path',
      'Ship an A/B removing one step and measure completion rate',
    ],
    tightenData: ['Add a one-question exit survey for drop-offs', 'Tag events for time-on-step in onboarding'],
    whyThisMakesSense: 'Focus on the highest-friction moments first to unlock downstream gains.',
  }
}

export const useAppStore = create<AppState & {
  setNotes: (v: string) => void
  setPSText: (v: string) => void
  setPsDraft: (v: string) => void
  setPsSnapshot: (themes: string[]) => void
  // Wizard patch + clear (single source of truth for PS wizard)
  setWizard: (patch: Partial<AppState>) => void
  clearPsWizard: () => void
  generatePS: () => Promise<void>
  extractPains: () => Promise<void>
  generateArchetypes: () => Promise<void>
  generateProfiles: () => Promise<void>
  runAnalysis: () => Promise<void>
  // Theme-only mode
  interviewNotes: string
  themesMatrix: number[][]
  themesDisplay: any[]
  themesWarnings: string[]
  busyThemes: boolean
  extractThemes: () => Promise<void>
  resetThemes: () => void
  // New Quality Metrics & Clusters deterministic flow
  getQualityAnalysis: () => Promise<void>
  canRunQC: () => boolean
  getInsights: () => Promise<void>
  ackPSAnimation: () => void
  resetAll: () => void
  canGoArchetypes: () => boolean
  canRunAnalysis: () => boolean
  canSeeInsights: () => boolean
  clearProfiles: () => void
  // Project-level reset for dev clean start
  __resetProject?: () => void
  // Snapshot of PS extraction (explicit core chips)
  psSnapshot?: { themes: string[] } | null
  // PS draft persistence helpers
  clearPs: () => void
}>()(
  PERSIST
    ? persist((set, get) => ({
    // Wizard defaults
    title: '',
    wizWho: '',
    wizStruggle: '',
    wizCurrent: '',
    wizGap: '',
    wizSuccess: '',

  psText: '',
    psTags: [],
    psWarnings: undefined,
    psBlocked: false,
  psJustGenerated: false,
    busyPS: false,
  // PS draft typed by user (persistable)
  psDraft: '',
    busyExtract: false,
    busyArch: false,
    notes: '',
  archetypes: [],
    patterns: [],
    summary: null,
  emergent: null,
  result: null,
  // quality metrics & clusters
  metricsRes: null,
  clustersRes: null,
  readiness: null,
  busyQC: false,
    insights: null,
  error: undefined,
  // gating flag for enabling Clusters navigation after themes extraction
  themesReady: false,
  // snapshot of interview matrix (for gating & potential frequency tie-breaks)
  interviewMatrix: [],
  // Profiles (JTBD)
  profiles: [],
  profilesMatrix: [],
  profilesSummary: null,
  profilesError: '',
  busyProfiles: false,
  // Theme-only mode
  interviewNotes: '',
  themesMatrix: [],
  themesDisplay: [],
  themesWarnings: [],
  busyThemes: false,
  // PS snapshot for simplified UI
  psSnapshot: null,
  // Gating flags (explicit, monotonic within session unless cleared)
  psReady: false,
  interviewReady: false,

  // Wizard state helpers
  setWizard: (patch: Partial<AppState>) => set(patch),
  clearPsWizard: () => set({ psDraft: '', psSnapshot: null }),

  // PS draft + snapshot helpers
  setPsSnapshot: (themes: string[]) => set({ psSnapshot: { themes }, psReady: true }),

  setNotes: (v: string) => set({ notes: v }),
  setPSText: (v: string) => set({ psText: v }),
  setPsDraft: (v: string) => set({ psDraft: v }),

    async generatePS() {
      const { title, wizWho, wizStruggle, wizCurrent, wizGap, wizSuccess, psDraft } = get();
      if (!(title && wizWho && wizStruggle && wizCurrent && wizGap && wizSuccess)) return;
      // Reset outputs but do NOT pre-populate psDraft; animation will stream into psDraft from component effect.
      set({ busyPS: true, psText: '', psTags: [], psWarnings: undefined, psBlocked: false, psJustGenerated: false });
      try {
        const res = await fetchJsonSafe<{ problemStatement: string }>(
          '/api/generate-problem',
          { method: 'POST', body: JSON.stringify({ projectName: title, who: wizWho, struggle: wizStruggle, current: wizCurrent, gap: wizGap, success: wizSuccess }) }
        );
        const fallback = `${wizWho} are trying to make progress on “${wizStruggle}”. They currently ${wizCurrent}. What’s not working is that ${wizGap}. Success looks like ${wizSuccess}.`;
        const text = res.ok && res.data?.problemStatement ? res.data.problemStatement : fallback;
        const sameAsDraft = (psDraft || '') === (text || '');
        set({ psText: text, psJustGenerated: !sameAsDraft });
      } finally {
        set({ busyPS: false });
      }
    },

    async extractPains() {
      const { psText } = get()
      if (!psText) return
      set({ busyExtract: true, psWarnings: undefined, psBlocked: false })
      try {
        const res = await fetchJsonSafe<{ pains: Array<{ tag: string; label?: string }>; warnings?: unknown; block_next?: boolean }>(
          '/api/pains/extract',
          { method: 'POST', body: JSON.stringify({ problem_statement: psText }) }
        )
        if (res.ok && Array.isArray(res.data?.pains)) {
          const json = res.data as { pains?: Array<{ tag?: string }>; warnings?: { solution_bias?: boolean; too_many?: { count?: number }; too_vague?: boolean }; block_next?: boolean; note?: string };
          const pains = Array.isArray(json?.pains) ? json.pains : [];

          // Build a clear, actionable message
          let warnText: string | null = null;
          if (json?.warnings?.solution_bias) {
            warnText = 'Detected solution framing in your statement. Themes were extracted from the problem portion only. Consider removing “solution” sentences for clearer diagnosis.';
          } else if (json?.warnings?.too_many) {
            const c = Number(json.warnings.too_many.count || pains.length || 0);
            warnText = `There are too many themes detected (${c}). Narrow to 2–3 for tighter clustering.`;
          } else if (json?.warnings?.too_vague) {
            warnText = 'Your statement may be too vague. Add who/context, the struggle, current workarounds, and desired outcome.';
          } else if (json?.note) {
            warnText = String(json.note);
          }

          set({
            psTags: pains.map((p) => ({ tag: canonicalTag(String(p.tag || '')) })),
            psWarnings: warnText || undefined,
            psBlocked: !!json?.block_next,
            archetypes: [], summary: null, patterns: [], result: null, insights: null
          });
        } else {
          const tags = inferTagsFromText(psText)
          set({ psTags: tags.map(t => ({ tag: canonicalTag(t) })), psWarnings: undefined, psBlocked: false })
        }
      } finally {
        set({ busyExtract: false })
      }
    },

    async generateArchetypes() {
  const { notes, psTags } = get();
  const ps_tags = (psTags || []).map((p: any) => p.tag);
      if (!notes.trim() || ps_tags.length===0) return;
      set({ busyArch:true, error: undefined });
      try {
        const res = await fetchJsonSafe<ArchetypeAPIResponse>(
          '/api/archetype',
          { method:'POST', body: JSON.stringify({ raw_text: notes, ps_tags }) }
        );
        if (res.ok && res.data) {
          const json = res.data;
          // server returns: { summary, cards:{pattern:[]}, archetypes:[{evidence:[]}] }
          const patterns: PatternCard[] = Array.isArray(json?.cards?.pattern) ? json.cards.pattern : [];
          const legacyArch: LegacyArchetype[] = Array.isArray(json?.archetypes) ? json.archetypes : [];
          const archetypes = legacyArch.length ? legacyArch : [{ id:'1', evidence: [] }];
          const summary: Summary | null = json?.summary || null;
          const emergent = json?.emergent || null;
          const note = typeof (json as { note?: unknown }).note === 'string' ? (json as { note?: string }).note : undefined;
          set({ patterns, archetypes, summary, emergent, error: note });
        } else {
          // fallback to stub for shape compatibility
          const fallback = stubArchetypes(notes, ps_tags);
          set({ archetypes: [{ id:'1', evidence: (fallback||[]).flatMap(a => (a.quotes||[]).map((q:string)=>({ id:'', text:q, primary_tag:(a.tags||[])[0]||'', approved:true })) ) }], patterns: [], summary: null, error: res.error || 'Request failed' });
        }
      } finally {
        set({ busyArch:false });
      }
    },

    async generateProfiles(){
      const s = get();
      set({ busyProfiles:true, profilesError:'', profiles:[], profilesMatrix:[], profilesSummary:null });
      try {
          const payload = { notes: s.notes || '', ps_anchors: (s.psTags||[]).map((t: any)=>t.tag) };
        const json = await fetchJsonSafe<ProfilesAPIResponse>('/api/profiles', {
          method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        const data = (json && json.ok) ? json.data : null;
        set({
          profiles: data?.profiles || [],
          profilesMatrix: data?.matrix || [],
          profilesSummary: data?.summary || null,
          profilesError: data?.note || ''
        });
      } catch(e){
        const msg = e instanceof Error ? e.message : 'Failed to generate profiles.'
        set({ profilesError: msg });
      } finally {
        set({ busyProfiles:false });
      }
    },
    clearProfiles(){ set({ profiles:[], profilesMatrix:[], profilesSummary:null, profilesError:'' }); },

    async extractThemes(){
      const s2 = get();
      const notes = s2.interviewNotes || '';
      if (!notes.trim()) return;
      set({ busyThemes:true, themesWarnings:[], themesMatrix:[], themesDisplay:[] });
      try {
        const res = await fetch('/api/themes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ notes }) });
        const json = await res.json();
        const matrixPairs: Array<[string, Record<string, number>]> = json.matrix||[];
        const display = json.display||[];
        const CORES = ['cost','time','effort','quality','reliability','trust','flexibility','choice','information','access','support','risk','value'];
        const numericMatrix: number[][] = matrixPairs.map(([id, rec]) => CORES.map(c => rec[c] || 0));
        const profilesMatrix = matrixPairs.map(([id, rec]) => [id, rec]) as [string, Record<string,number>][];
        const syntheticProfiles = Array.isArray(display) ? display.map((d:any,i:number)=>{
          const rec = profilesMatrix[i]?.[1] || {};
            return {
              id: d.id || `T${i+1}`,
              narrative:'',
              jtbd:{},
              themes:{ core:(d.top_cores||[]).map((tc:any)=>tc.core), facets:d.emergent||[] },
              theme_weights: rec,
              other:{}, flags:{}, approved:true, original: undefined
            };
        }) : [];
        set({ themesMatrix: numericMatrix, themesDisplay: display, themesWarnings: json.warnings||[], profilesMatrix, profiles: syntheticProfiles, themesReady: true });
      } catch(e){
        set({ themesWarnings: ['Extraction failed. Try simplifying the notes.'] });
      } finally {
        set({ busyThemes:false });
      }
    },
    resetThemes(){ set({ interviewNotes:'', themesMatrix:[], themesDisplay:[], themesWarnings:[] }); },

    async runAnalysis() {
      const { archetypes } = get()
      const res = await fetchJsonSafe<Analysis>('/api/analysis', { method: 'POST', body: JSON.stringify({ archetypes }) })
  const data = res.ok && res.data ? res.data : stubAnalysis(Array.isArray(archetypes) ? (archetypes as unknown as Archetype[]) : [])
      set({ result: data })
    },

    // Compute readiness blend from metrics + clusters
    // focus: balance (second/dominant), clear: silhouette, action: avg(outcomes,jobs), overall weighted
  _computeReadiness(metrics: MetricsResult | null, clusters: ClustersResult | null): Readiness {
      let focus = 0.5;
      const r = metrics?.imbalance?.ratio;
      if (typeof r === 'number' && r > 0) {
        const bal = Math.min(1, 1 / r); // 1 when perfectly balanced, -> 0 when very imbalanced
        focus = bal;
      }
      const clear = Math.max(0, Math.min(1, clusters?.validity?.silhouette || 0));
  const ov: { outcomes?: number; jobs?: number } = metrics?.completeness?.overall || { outcomes: 0, jobs: 0 };
      const action = Math.max(0, Math.min(1, ((Number(ov.outcomes)||0) + (Number(ov.jobs)||0)) / 2));
      const overall = Math.max(0, Math.min(1, 0.4 * clear + 0.3 * focus + 0.3 * action));
      return { overall, focus, clear, action };
    },

    async getQualityAnalysis() {
      const s = get();
      if (!Array.isArray(s.profiles) || s.profiles.length === 0) return;
      if (!Array.isArray(s.profilesMatrix) || s.profilesMatrix.length === 0) return; // guard against premature call
      set({ busyQC: true, metricsRes: null, clustersRes: null, readiness: null });
      try {
        // METRICS
            const psThemes = (s.psTags || []).map((t: any) => String((t as { tag?: string }).tag || t)).filter(Boolean);
      const metricsBody = {
        profiles: s.profiles.map((p: any) => ({ id: p.id, theme_weights: p.theme_weights, jtbd: p.jtbd })),
          ps_themes: psThemes,
          ps_warnings: s.psWarnings ? { solution_bias: /solution/i.test(String(s.psWarnings)) } : undefined
        };
        const metricsResp: MetricsResult = await fetch('/api/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metricsBody) })
          .then(r => r.json());
        set({ metricsRes: metricsResp });

        // CLUSTERS
          const clustersBody = {
            matrix: s.profilesMatrix,
                profiles: s.profiles.map((p: any) => ({ id: p.id, themes: { facets: p.themes?.facets || [] } })),
          k_range: [2, 5],
          distance: 'cosine'
        };
        const clustersResp: ClustersResult = await fetch('/api/clusters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clustersBody) })
          .then(r => r.json());
        set({ clustersRes: clustersResp });

  const { _computeReadiness } = get() as unknown as { _computeReadiness: (m: MetricsResult | null, c: ClustersResult | null) => Readiness };
  const readiness = _computeReadiness(metricsResp, clustersResp);
        set({ readiness });
      } catch {
        set({ metricsRes: null, clustersRes: null, readiness: null });
      } finally {
        set({ busyQC: false });
      }
    },

    canRunQC() { const s = get(); return Array.isArray(s.profiles) && s.profiles.length > 0; },

    async getInsights() {
      const state = get()
      const res = await fetchJsonSafe<Insights>('/api/insights', { method: 'POST', body: JSON.stringify({ state }) })
      const data = res.ok && res.data ? res.data : stubInsights(state)
      set({ insights: data })
    },

    ackPSAnimation() { set({ psJustGenerated: false }); },

    resetAll() {
      const fresh: Partial<AppState> = {
        title: '', wizWho: '', wizStruggle: '', wizCurrent: '', wizGap: '', wizSuccess: '',
        psText: '', psTags: [], psWarnings: undefined, psBlocked: false, psJustGenerated: false,
        busyPS: false, busyExtract: false, busyArch: false,
        notes: '', archetypes: [], patterns: [], summary: null, emergent: null, result: null, insights: null,
        error: undefined,
      };
      set(fresh);
      try {
        localStorage.removeItem('clusters-student-v3');
        localStorage.removeItem('clusters-student-v2');
        localStorage.removeItem('clusters-student-v1');
      } catch {}
    },

    canGoArchetypes() {
      const s = get(); return !!s.psText && (s.psTags?.length || 0) > 0
    },
    canRunAnalysis() {
      const s = get(); return (s.archetypes?.length || 0) > 0
    },
    canSeeInsights() {
      const s = get();
      return !!(s.psText && (s.psTags?.length||0) > 0 && s.clustersRes);
    },
    // Hard reset: clears PS/Interview/Clusters slice for dev clean start
    __resetProject: () => set({
      psSnapshot: null,
      interviewMatrix: [],
      themesReady: false,
      clustersRes: null,
    }),
    clearPs: () => set({ psDraft: '', psSnapshot: null }),
  }), { name: 'clusters-student-jtbd-v1', version: 1, partialize: (s:any)=> ({ psDraft: s.psDraft, psSnapshot: s.psSnapshot }) })
    : ((set, get) => ({
      // Wizard defaults
      title: '',
      wizWho: '',
      wizStruggle: '',
      wizCurrent: '',
      wizGap: '',
      wizSuccess: '',

  psText: '',
      psTags: [],
      psWarnings: undefined,
      psBlocked: false,
      psJustGenerated: false,
      busyPS: false,
  psDraft: '',
      busyExtract: false,
      busyArch: false,
      notes: '',
  archetypes: [],
      patterns: [],
      summary: null,
  emergent: null,
    result: null,
    metricsRes: null,
    clustersRes: null,
    readiness: null,
    busyQC: false,
      insights: null,
  error: undefined,
      // Profiles (JTBD)
      profiles: [],
      profilesMatrix: [],
      profilesSummary: null,
      profilesError: '',
      busyProfiles: false,
  // Theme-only mode
  interviewNotes: '',
  themesMatrix: [],
  themesDisplay: [],
  themesWarnings: [],
  busyThemes: false,
  themesReady: false,
  // PS snapshot for simplified UI
  psSnapshot: null,

      // Wizard state helpers
      setWizard: (patch: Partial<AppState>) => set(patch),
      clearPsWizard: () => set({ psDraft: '', psSnapshot: null }),

      // PS draft + snapshot helpers
  setPsSnapshot: (themes: string[]) => set({ psSnapshot: { themes }, psReady: true }),

      setNotes: (v) => set({ notes: v }),
  setPSText: (v) => set({ psText: v }),
  setPsDraft: (v: string) => set({ psDraft: v }),

      async generatePS() {
        const { title, wizWho, wizStruggle, wizCurrent, wizGap, wizSuccess, psDraft } = get();
        if (!(title && wizWho && wizStruggle && wizCurrent && wizGap && wizSuccess)) return;
        set({ busyPS: true, psText: '', psTags: [], psWarnings: undefined, psBlocked: false, psJustGenerated: false });
        try {
          const res = await fetchJsonSafe<{ problemStatement: string }>(
            '/api/generate-problem',
            { method: 'POST', body: JSON.stringify({ projectName: title, who: wizWho, struggle: wizStruggle, current: wizCurrent, gap: wizGap, success: wizSuccess }) }
          );
          const fallback = `${wizWho} are trying to make progress on “${wizStruggle}”. They currently ${wizCurrent}. What’s not working is that ${wizGap}. Success looks like ${wizSuccess}.`;
          const text = res.ok && res.data?.problemStatement ? res.data.problemStatement : fallback;
          const sameAsDraft = (psDraft || '') === (text || '');
          set({ psText: text, psJustGenerated: !sameAsDraft });
        } finally {
          set({ busyPS: false });
        }
      },

      async extractPains() {
        const { psText } = get()
        if (!psText) return
        set({ busyExtract: true, psWarnings: undefined, psBlocked: false })
        try {
          const res = await fetchJsonSafe<{ pains: Array<{ tag: string; label?: string }>; warnings?: unknown; block_next?: boolean }>(
            '/api/pains/extract',
            { method: 'POST', body: JSON.stringify({ problem_statement: psText }) }
          )
          if (res.ok && Array.isArray(res.data?.pains)) {
            const json = res.data as { pains?: Array<{ tag?: string }>; warnings?: { solution_bias?: boolean; too_many?: { count?: number }; too_vague?: boolean }; block_next?: boolean; note?: string };
            const pains = Array.isArray(json?.pains) ? json.pains : [];

            // Build a clear, actionable message
            let warnText: string | null = null;
            if (json?.warnings?.solution_bias) {
              warnText = 'Detected solution framing in your statement. Themes were extracted from the problem portion only. Consider removing “solution” sentences for clearer diagnosis.';
            } else if (json?.warnings?.too_many) {
              const c = Number((json.warnings?.too_many?.count) ?? (pains.length || 0));
              warnText = `There are too many themes detected (${c}). Narrow to 2–3 for tighter clustering.`;
            } else if (json?.warnings?.too_vague) {
              warnText = 'Your statement may be too vague. Add who/context, the struggle, current workarounds, and desired outcome.';
            } else if (json?.note) {
              warnText = String(json.note);
            }

            set({
              psTags: pains.map((p) => ({ tag: canonicalTag(String(p?.tag || '')) })),
              psWarnings: warnText || undefined,
              psBlocked: !!json?.block_next,
              archetypes: [], summary: null, patterns: [], result: null, insights: null
            });
          } else {
            const tags = inferTagsFromText(psText)
            set({ psTags: tags.map(t => ({ tag: canonicalTag(t) })), psWarnings: undefined, psBlocked: false })
          }
        } finally {
          set({ busyExtract: false })
        }
      },

      async generateArchetypes() {
  const { notes, psTags } = get();
  const ps_tags = (psTags || []).map((p: any) => p.tag);
        if (!notes.trim() || ps_tags.length===0) return;
        set({ busyArch:true, error: undefined });
        try {
          const res = await fetchJsonSafe<ArchetypeAPIResponse>(
            '/api/archetype', { method:'POST', body: JSON.stringify({ raw_text: notes, ps_tags }) }
          );
          if (res.ok && res.data) {
            const json = res.data;
            const patterns: PatternCard[] = Array.isArray(json?.cards?.pattern) ? json.cards.pattern : [];
            const legacyArch: LegacyArchetype[] = Array.isArray(json?.archetypes) ? json.archetypes : [];
            const archetypes: LegacyArchetype[] = legacyArch.length ? legacyArch : [{ id:'1', evidence: [] }];
            const summary: Summary | null = json?.summary || null;
            const emergent = json?.emergent || null;
            set({ patterns, archetypes, summary, emergent, error: undefined });
          } else {
            const anchors = ps_tags;
            const fallback = stubArchetypes(notes, anchors);
            set({ archetypes: [{ id:'1', evidence: (fallback||[]).flatMap(a => (a.quotes||[]).map((q:string)=>({ id:'', text:q, primary_tag:(a.tags||[])[0]||'', approved:true })) ) }], patterns: [], summary: null, error: res.error || 'Request failed' });
          }
        } finally {
          set({ busyArch:false });
        }
      },

      async generateProfiles(){
        const s = get();
        set({ busyProfiles:true, profilesError:'', profiles:[], profilesMatrix:[], profilesSummary:null });
        try {
          const payload = { notes: s.notes || '', ps_anchors: (s.psTags||[]).map((t:any)=>t.tag) };
          const json = await fetchJsonSafe<ProfilesAPIResponse>('/api/profiles', {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
          });
          const data = (json && json.ok) ? json.data : null;
          set({
            profiles: data?.profiles || [],
            profilesMatrix: data?.matrix || [],
            profilesSummary: data?.summary || null,
            profilesError: data?.note || ''
          });
        } catch(e){
          const msg = e instanceof Error ? e.message : 'Failed to generate profiles.'
          set({ profilesError: msg });
        } finally {
          set({ busyProfiles:false });
        }
      },
      clearProfiles(){ set({ profiles:[], profilesMatrix:[], profilesSummary:null, profilesError:'' }); },

      async extractThemes(){
        const s2 = get();
        const notes = s2.interviewNotes || '';
        if (!notes.trim()) return;
        set({ busyThemes:true, themesWarnings:[], themesMatrix:[], themesDisplay:[] });
        try {
          const res = await fetch('/api/themes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ notes }) });
          const json = await res.json();
          const matrixPairs: Array<[string, Record<string, number>]> = json.matrix||[];
          const display = json.display||[];
          const CORES = ['cost','time','effort','quality','reliability','trust','flexibility','choice','information','access','support','risk','value'];
          const numericMatrix: number[][] = matrixPairs.map(([id, rec]) => CORES.map(c => rec[c] || 0));
          const profilesMatrix = matrixPairs.map(([id, rec]) => [id, rec]) as [string, Record<string,number>][];
          const syntheticProfiles = Array.isArray(display) ? display.map((d:any,i:number)=>{
            const rec = profilesMatrix[i]?.[1] || {};
            return {
              id: d.id || `T${i+1}`,
              narrative:'',
              jtbd:{},
              themes:{ core:(d.top_cores||[]).map((tc:any)=>tc.core), facets:d.emergent||[] },
              theme_weights: rec,
              other:{}, flags:{}, approved:true, original: undefined
            };
          }) : [];
          set({ themesMatrix: numericMatrix, themesDisplay: display, themesWarnings: json.warnings||[], profilesMatrix, profiles: syntheticProfiles, themesReady: true, interviewReady: true });
        } catch(e){
          set({ themesWarnings: ['Extraction failed. Try simplifying the notes.'] });
        } finally {
          set({ busyThemes:false });
        }
      },
  resetThemes(){ set({ interviewNotes:'', themesMatrix:[], themesDisplay:[], themesWarnings:[], interviewReady: false }); },

      async runAnalysis() {
        const { archetypes } = get()
        const res = await fetchJsonSafe<Analysis>('/api/analysis', { method: 'POST', body: JSON.stringify({ archetypes }) })
  const data = res.ok && res.data ? res.data : stubAnalysis(Array.isArray(archetypes) ? (archetypes as unknown as Archetype[]) : [])
        set({ result: data })
      },

      _computeReadiness(metrics: MetricsResult | null, clusters: ClustersResult | null): Readiness {
        let focus = 0.5;
        const r = metrics?.imbalance?.ratio;
        if (typeof r === 'number' && r > 0) focus = Math.min(1, 1 / r);
        const clear = Math.max(0, Math.min(1, clusters?.validity?.silhouette || 0));
  const ov: { outcomes?: number; jobs?: number } = metrics?.completeness?.overall || { outcomes: 0, jobs: 0 };
        const action = Math.max(0, Math.min(1, ((Number(ov.outcomes)||0) + (Number(ov.jobs)||0)) / 2));
        const overall = Math.max(0, Math.min(1, 0.4 * clear + 0.3 * focus + 0.3 * action));
        return { overall, focus, clear, action };
      },

      async getQualityAnalysis() {
  const s = get();
        if (!Array.isArray(s.profiles) || s.profiles.length === 0) return;
        set({ busyQC: true, metricsRes: null, clustersRes: null, readiness: null });
        try {
            const psThemes = (s.psTags || []).map((t: any) => String((t as { tag?: string }).tag || t)).filter(Boolean);
            const metricsBody = {
                profiles: s.profiles.map((p) => ({ id: p.id, theme_weights: p.theme_weights, jtbd: p.jtbd })),
            ps_themes: psThemes,
            ps_warnings: s.psWarnings ? { solution_bias: /solution/i.test(String(s.psWarnings)) } : undefined
          };
          const metricsResp: MetricsResult = await fetch('/api/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metricsBody) })
            .then(r => r.json());
          set({ metricsRes: metricsResp });

          const clustersBody = {
            matrix: s.profilesMatrix,
                profiles: s.profiles.map((p: any) => ({ id: p.id, themes: { facets: p.themes?.facets || [] } })),
            k_range: [2, 5],
            distance: 'cosine'
          };
          const clustersResp: ClustersResult = await fetch('/api/clusters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clustersBody) })
            .then(r => r.json());
          set({ clustersRes: clustersResp });

              const { _computeReadiness } = get() as unknown as { _computeReadiness: (m: MetricsResult | null, c: ClustersResult | null) => Readiness };
              const readiness = _computeReadiness(metricsResp, clustersResp);
          set({ readiness });
            } catch {
          set({ metricsRes: null, clustersRes: null, readiness: null });
        } finally {
          set({ busyQC: false });
        }
      },

      canRunQC() { const s = get(); return Array.isArray(s.profiles) && s.profiles.length > 0; },

      async getInsights() {
        const state = get()
        const res = await fetchJsonSafe<Insights>('/api/insights', { method: 'POST', body: JSON.stringify({ state }) })
  const data = res.ok && res.data ? res.data : stubInsights(state)
        set({ insights: data })
      },

      ackPSAnimation() { set({ psJustGenerated: false }) },

      resetAll() {
        const fresh: Partial<AppState> = {
          title: '', wizWho: '', wizStruggle: '', wizCurrent: '', wizGap: '', wizSuccess: '',
          psText: '', psTags: [], psWarnings: undefined, psBlocked: false, psJustGenerated: false,
          busyPS: false, busyExtract: false, busyArch: false,
          notes: '', archetypes: [], patterns: [], summary: null, emergent: null, result: null, insights: null,
          error: undefined,
        };
        set(fresh);
        try {
          localStorage.removeItem('clusters-student-v3')
          localStorage.removeItem('clusters-student-v2')
          localStorage.removeItem('clusters-student-v1')
        } catch {}
      },

      canGoArchetypes() { const s = get(); return !!s.psText && (s.psTags?.length || 0) > 0 },
      canRunAnalysis() { const s = get(); return (Array.isArray(s.patterns) ? s.patterns.length : (s.archetypes?.length || 0)) > 0 },
  canSeeInsights() { const s = get(); return !!(s.psText && (s.psTags?.length||0) > 0 && s.clustersRes); },
      // Hard reset: clears PS/Interview/Clusters slice for dev clean start
      __resetProject: () => set({
        psSnapshot: null,
        interviewMatrix: [],
        themesReady: false,
        clustersRes: null,
      }),
      clearPs: () => set({ psDraft: '', psSnapshot: null }),
    }))
)
