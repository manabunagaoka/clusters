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

### Known limitations (in plain language)
- We only count “support” when people really mean customer support. Saying “streaming service” isn’t enough; we look for phrases like “talk to a human” or “customer support.”
- If the AI is busy or unsure, you might see a shorter, simpler summary instead of fancy wording. It’s on purpose so you still get something useful.
- The “extra detail” vocabulary starts small. Different industries use different words—add a few of your own terms when you work in a new area.
- Vague inputs lead to vague results. Tell us who the person is, what’s hard, what they try today, and what success looks like.
