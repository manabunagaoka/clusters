'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchJsonSafe } from '../lib/net'
import { canonicalTag, humanizeTag } from '../lib/canonical'
import type { AppState, Archetype, Analysis, Insights, PsChip, PatternCard, Summary, LegacyArchetype, ArchetypeAPIResponse, ProfilesAPIResponse } from '../lib/types'

const PERSIST = !(process.env.NEXT_PUBLIC_PERSIST === '0' || process.env.NEXT_PUBLIC_PERSIST === 'false');

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
  generatePS: () => Promise<void>
  extractPains: () => Promise<void>
  generateArchetypes: () => Promise<void>
  generateProfiles: () => Promise<void>
  runAnalysis: () => Promise<void>
  getInsights: () => Promise<void>
  ackPSAnimation: () => void
  resetAll: () => void
  canGoArchetypes: () => boolean
  canRunAnalysis: () => boolean
  canSeeInsights: () => boolean
  clearProfiles: () => void
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
    busyExtract: false,
    busyArch: false,
    notes: '',
  archetypes: [],
    patterns: [],
    summary: null,
  emergent: null,
    result: null,
    insights: null,
  error: undefined,
  // Profiles (JTBD)
  profiles: [],
  profilesMatrix: [],
  profilesSummary: null,
  profilesError: '',
  busyProfiles: false,

    setNotes: (v) => set({ notes: v }),
    setPSText: (v) => set({ psText: v }),

    async generatePS() {
      const { title, wizWho, wizStruggle, wizCurrent, wizGap, wizSuccess } = get()
      if (!(title && wizWho && wizStruggle && wizCurrent && wizGap && wizSuccess)) return
      // clear prior outputs and set flag for typing animation
      set({ busyPS: true, psText: '', psTags: [], psWarnings: undefined, psBlocked: false, psJustGenerated: false })
      try {
        // Prefer new API route; fallback to local formatting if unavailable
        const res = await fetchJsonSafe<{ problemStatement: string }>(
          '/api/generate-problem',
          {
            method: 'POST',
            body: JSON.stringify({ projectName: title, who: wizWho, struggle: wizStruggle, current: wizCurrent, gap: wizGap, success: wizSuccess })
          }
        )
        const fallback = `${wizWho} are trying to make progress on “${wizStruggle}”. They currently ${wizCurrent}. What’s not working is that ${wizGap}. Success looks like ${wizSuccess}.`
        const text = res.ok && res.data?.problemStatement ? res.data.problemStatement : fallback
        set({ psText: text, psJustGenerated: true })
      } finally {
        set({ busyPS: false })
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
          const json = res.data;
          // Keep model label; lightly canonicalize tag client-side as well
          const pains = json.pains
          const tags: PsChip[] = pains
            .map((p: { tag: string; label?: string }) => ({ tag: canonicalTag(p.tag), label: (p.label || '').toString() }))
            .filter((p: PsChip) => Boolean(p.tag))

          const count = tags.length
          const tooMany = count >= 5

          // Actionable message
          let note: string | null = null
          if (tooMany) {
            note = `We found ${count} anchors (pains/challenges). That’s 5 or more, which will create messy clusters. Go back to your Problem Statement and refine to narrow your focus (combine related items or specify who/when/where). NEXT is disabled until you reduce anchors.`
          } else if (count > 0) {
            note = `From your Problem Statement, ${count} anchor${count>1?'s':''} were identified. These will be used to analyze your interview notes and check for overlap and emergent themes. If you accept these anchors as is, click NEXT. If there are 5 or more, NEXT remains disabled.`
            if (count === 4) {
              note += ' Consider narrowing to 2–3 for tighter clustering.'
            }
          } else if (json?.warnings) {
            note = 'No anchors detected. Add specifics about who, what’s hard, and what success looks like, then try Extract again.'
          }

          set({
            psTags: tags,
            psWarnings: note || undefined,
            psBlocked: tooMany || !!json?.block_next,
            archetypes:[], summary:null, patterns:[], result:null, insights:null
          })
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
      const ps_tags = (psTags || []).map(p => p.tag);
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
        const payload = { notes: s.notes || '', ps_anchors: (s.psTags||[]).map(t=>t.tag) };
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

    async runAnalysis() {
      const { archetypes } = get()
      const res = await fetchJsonSafe<Analysis>('/api/analysis', { method: 'POST', body: JSON.stringify({ archetypes }) })
  const data = res.ok && res.data ? res.data : stubAnalysis(Array.isArray(archetypes) ? (archetypes as unknown as Archetype[]) : [])
      set({ result: data })
    },

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
      const s = get(); return !!s.result
    },
  }), { name: 'clusters-student-v3', version: 3 })
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
      busyExtract: false,
      busyArch: false,
      notes: '',
  archetypes: [],
      patterns: [],
      summary: null,
  emergent: null,
      result: null,
      insights: null,
  error: undefined,
      // Profiles (JTBD)
      profiles: [],
      profilesMatrix: [],
      profilesSummary: null,
      profilesError: '',
      busyProfiles: false,

      setNotes: (v) => set({ notes: v }),
      setPSText: (v) => set({ psText: v }),

      async generatePS() {
        const { title, wizWho, wizStruggle, wizCurrent, wizGap, wizSuccess } = get()
        if (!(title && wizWho && wizStruggle && wizCurrent && wizGap && wizSuccess)) return
        set({ busyPS: true, psText: '', psTags: [], psWarnings: undefined, psBlocked: false, psJustGenerated: false })
        try {
          const res = await fetchJsonSafe<{ problemStatement: string }>(
            '/api/generate-problem',
            { method: 'POST', body: JSON.stringify({ projectName: title, who: wizWho, struggle: wizStruggle, current: wizCurrent, gap: wizGap, success: wizSuccess }) }
          )
          const fallback = `${wizWho} are trying to make progress on “${wizStruggle}”. They currently ${wizCurrent}. What’s not working is that ${wizGap}. Success looks like ${wizSuccess}.`
          const text = res.ok && res.data?.problemStatement ? res.data.problemStatement : fallback
          set({ psText: text, psJustGenerated: true })
        } finally {
          set({ busyPS: false })
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
            const json = res.data;
            const pains = json.pains
            const tags: PsChip[] = pains
              .map((p: { tag: string; label?: string }) => ({ tag: canonicalTag(p.tag), label: (p.label || '').toString() }))
              .filter((p: PsChip) => Boolean(p.tag))
            const count = tags.length
            const tooMany = count >= 5
            let note: string | null = null
            if (tooMany) {
              note = `We found ${count} anchors (pains/challenges). That’s 5 or more, which will create messy clusters. Go back to your Problem Statement and refine to narrow your focus (combine related items or specify who/when/where). NEXT is disabled until you reduce anchors.`
            } else if (count > 0) {
              note = `From your Problem Statement, ${count} anchor${count>1?'s':''} were identified. These will be used to analyze your interview notes and check for overlap and emergent themes. If you accept these anchors as is, click NEXT. If there are 5 or more, NEXT remains disabled.`
              if (count === 4) { note += ' Consider narrowing to 2–3 for tighter clustering.' }
            } else if (json?.warnings) {
              note = 'No anchors detected. Add specifics about who, what’s hard, and what success looks like, then try Extract again.'
            }
            set({ psTags: tags, psWarnings: note || undefined, psBlocked: tooMany || !!json?.block_next, archetypes:[], summary:null, patterns:[], result:null, insights:null })
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
        const ps_tags = (psTags || []).map(p => p.tag);
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
          const payload = { notes: s.notes || '', ps_anchors: (s.psTags||[]).map(t=>t.tag) };
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

      async runAnalysis() {
        const { archetypes } = get()
        const res = await fetchJsonSafe<Analysis>('/api/analysis', { method: 'POST', body: JSON.stringify({ archetypes }) })
  const data = res.ok && res.data ? res.data : stubAnalysis(Array.isArray(archetypes) ? (archetypes as unknown as Archetype[]) : [])
        set({ result: data })
      },

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
      canSeeInsights() { const s = get(); return !!s.result },
    }))
)
