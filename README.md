## Clusters — JTBD Student Edition (MVP)

Clusters helps you validate business ideas with the Jobs-To-Be-Done (JTBD) framework. It blends AI for normalization with deterministic mapping into universal themes to keep results repeatable and explainable.

### App overview
- Next.js App Router (TypeScript, React)
- APIs: `/api/pains/extract` (theme extraction) and `/api/profiles` (JTBD profiles)
- Universal themes in `app/(clusters)/lib/universals.ts`

### Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Extensibility
The system uses 13 Core Dimensions (cost, time, effort, quality, reliability, trust, flexibility, choice, information, risk, support, access, value). For domain nuance, extend these maps:
- `FACETS_TO_CORE`: add facets mapped to a core (e.g., `subscription_value` → `value`).
- `SYNONYM_MAP`: add common phrases mapped to a facet or core.
- `CORE_KEYWORDS`: optionally add domain phrases to the regex lists for better heuristic scoring.

These changes are additive; you don’t need to modify the cores.

### Known limitations
- Guarded cores (support, trust, access, reliability, risk) only trigger on explicit phrasing to avoid false positives. Add synonyms for your domain if needed.
- If the LLM times out or returns low-content, the APIs degrade gracefully (never 500) and fall back to deterministic output; narratives may be simpler in those cases.
- The starter facet set is intentionally small; add a “facet pack” per vertical to improve expressiveness.
- Very generic problem statements can yield few themes; include who, struggle, workarounds, and desired outcome for best results.
