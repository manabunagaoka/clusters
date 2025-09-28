Here’s a **consolidated, ready-to-paste README.md** that merges your current doc with the ABAC/Insights contracts and the refinements Copilot suggested. Drop it in as-is.

---

# Clusters — JTBD Student Edition (MVP)

> **Purpose** — Help students move from a clear **Problem Statement (PS)** → **JTBD Profiles** → **Metrics & Clusters** → **Insights**.
> **Philosophy** — Deterministic, explainable math for structure (ABAC over core themes); LLMs only for light normalization + faithful narrative rewrites (no creative clustering or hallucinated strategy).

---

## Current Status (September 2025)

| Area | Status | Notes |
|------|--------|-------|
| UI Shell / Navigation | Stable | Layout, chips, loaders, readiness meter standardized |
| Problem Statement Theme Extraction | Implemented | Solution-bias guard + core theme mapping working |
| Profiles (JTBD) | Deprecated (replaced) | Replaced by Theme-Only Interview flow (cores + facets). Legacy code retained temporarily. |
| Metrics API | Implemented | Coverage (core_totals), completeness (per + overall), imbalance ratio, thin interview flags, solution bias passthrough |
| Clusters (ABAC) | Implemented (backend) | Cosine k-means (k∈[2..5]) + silhouette selection; small‑N guard; UI refinement & narrative labelling next |
| Insights | Not started | Will sit on stabilized Metrics + Clusters output; data-first templates first, optional low-temp rephrase later |
| Debug / Diagnostics | Partial | `PROFILES_DEBUG=1` exposes KEEP phrase retention + profile count |

**Active Focus:** Theme-Only Interview extraction quality (core guardrails, facet synonym coverage, small‑N guidance) and re‑aligning clustering/metrics with the new sparse matrix.  
**Next Sequence:** 1) Stabilize `/api/themes` heuristics & warnings → 2) Introduce updated `metrics` (coverage, imbalance, readiness) operating directly on the themes matrix → 3) Re‑enable ABAC clustering → 4) Add deterministic `insights`.  
**Goal:** Keep the 13-core vector stable so downstream clustering & insights remain deterministic.

---

---

## Project Snapshot

* **Implemented (Core):** Problem Statement extractor, Theme-Only Interview extraction (≤3 cores + emergent facets + context + why fragments), UI components hardened (consistent loaders, hydration fixes addressed).
* **Guardrails Added:** Risk/Value/Support strict triggers; max 3 cores; discrete weights (0.33/0.67/1.0); no invention of context; helpful no-core warnings.
* **In Progress:** Metrics & clustering re-alignment atop new `themesMatrix` (sparse record rows) and heuristic refinement for emergent facets.
* **Upcoming:** Reintroduce `/api/metrics` (coverage, imbalance, readiness) → ABAC clustering (k selection & small‑N guard) → deterministic, slot-safe Insights.
* **Principles:** Immutable core dimension set; deterministic theme folding; math before narrative; graceful degradation (never 500; fallback narratives); transparency over cleverness.
* **Consultation Need:** Profile heuristics & validation layer (fact coverage threshold, additional misuse detectors) — this is the current collaboration focus.

---

---

## Quick demo flow

1. **Problem Statement → Extract Themes**

	 * Outputs **2–4 universal “core themes”** (single words):
		 `cost, time, effort, quality, reliability, trust, flexibility, choice, information, risk, support, access, value`.
	 * **Solution sentences are ignored** during scoring.
	 * “Renew/cancel/worth it” → **value** (not risk).
	 * If the statement is genuinely sparse, it can return **1** (with a warning); if too vague, returns **0** and blocks Next with a “add specifics” prompt.

2. **Interview Themes (Theme‑Only Mode)**

	 * Paste interviews (any format). New interview = **blank line** or heading like **“Interview 2 – …”**.
	 * Deterministic pipeline: segmentation → phrase/facet mapping with guardrails → core salience scoring → pick ≤3 cores → discretize weights → emergent facet + context detection → why fragments.
	 * Outputs: table rows with cores (Low/Med/High), emergent facets (display-only), context tokens, why fragments, and warnings for empty rows.
	 * No narratives, approvals, or manual edits; fast path to clustering.

3. **Quality Metrics & Clusters (ABAC)**

	 * **ABAC (Adaptive Business Alignment Clustering)** — a deterministic, “pure CS” procedure that clusters **profiles × core-dimension vectors** (no LLM in the loop).
		 Distance: **cosine**; `k∈[2..5]`; choose k by simplest validity (silhouette; tie-break rule below).

4. **Insights (data-first)**

	 * Compare PS cores vs cluster cores (convergence/divergence), summarize clusters, call out data gaps (e.g., thin interviews, solution bias), and suggest next steps.

---

## Repository structure

```
app/
	(clusters)/
		account/               # account & reset UI
		archetypes/            # legacy (archived in git); not in main flow
		components/            # chips, loaders, etc.
		insights/              # (UI) Insights page (reads ABAC + metrics)
		instructions/          # onboarding copy (JTBD student-friendly)
		lib/
			universals.ts        # universal themes registry + mappers (core & facets)
		metrics/               # (UI) Quality Metrics & Clusters page
		problem/               # PS page (Generate PS + Extract Themes)
		profiles/              # (deprecated) legacy Profiles page -> redirect to /interview
		store/                 # zustand store (persist toggle & key)
		subscribe/
		layout.tsx             # sidebar / topbar layout

	api/
		pains/
			extract/route.ts     # PS theme extraction (universal cores; solution-bias guard)
		profiles/route.ts      # JTBD normalize → profiles + matrix + summary
		# (next) metrics/route.ts, clusters/route.ts, insights/route.ts

globals.css                # base styling & tokens
legacy/                    # optional archived notes/doc links
README.md                  # this doc
```

**Framework:** Next.js (App Router) + TypeScript
**State:** Zustand (with optional localStorage persistence)
**LLM calls:** OpenAI (low temp; timeouts; concurrency-limited)

---

## Environment

`.env.local`:

```bash
OPENAI_API_KEY=sk-****
# Turn persistence OFF in dev unless you deliberately want it:
NEXT_PUBLIC_PERSIST=0
```

Scripts:

```bash
npm run dev      # start dev server
npm run build    # production build
npm run start    # run built app
```

---

## Universal Themes

### Core Dimensions (single words; immutable)

`cost, time, effort, quality, reliability, trust, flexibility, choice, information, risk, support, access, value`

* **Clusters use core dimensions only** (these are the vector features).
* **Guarded behavior:**

	* “renew/cancel/worth it” → **value** (not risk)
	* **risk** requires **lock-in/penalty/contract** language
	* **support** means human/customer support, not generic “service”

### Facets (expressive domain specifics)

Map to one Core (preserve narrative color, not features by default):
`overnight_care → flexibility`, `referral_networks → trust`, `content_discovery → information`, `staff_rotation → reliability`, `household_support → effort`, `bilingual_support → access`, etc.

**Registry & mappers:** `app/(clusters)/lib/universals.ts`

* `mapPhraseToUniversal(raw)` → `{ core?: CoreDimensionId, facet?: string }`
* `foldToUniversalsWithFacetWeights(rawTags)` → `{ coreWeights: Map, facetWeights: Map }`
* `normalizeWeights(coreWeights)` → `{ [core]: 0.33|0.67|1.0 }`
* `pickCriticalFacets(facetWeights, limit=3)` → top display facets per profile
* **Context facets** (role/geo/language/work pattern) are **not** math features by default; use later for slices.

---

## APIs (current)

### `POST /api/pains/extract`

**Purpose:** Extract **2–4 core themes** from the PS text.
**Guards:**

* Splits PS into **problem vs solution**, scores **problem only**.
* Down-weights **risk** unless lock-in/penalty/contract language exists; map renew/cancel/worth-it → **value**.

**Input**

```json
{ "problem_statement": "..." }
```

**Output**

```json
{
	"pains": [
		{ "tag": "trust", "why": "...", "confidence": 0.67 },
		{ "tag": "cost", "why": "...", "confidence": 0.62 }
	],
	"warnings": {
		"solution_bias": true,
		"solution_snippet": "The solution involves..."
	},
	"block_next": false,
	"note": ""
}
```

### (Deprecated) `/api/profiles`

The legacy narrative profiles endpoint has been deprecated in favor of the lean `/api/themes` extraction. It is retained temporarily only for backward compatibility and will be removed once metrics & insights consume the new matrix directly.

---

## UI pages

### Problem Statement (`/problem`)

* **Generate PS** → 2–3 sentence paragraph.
* **Extract Themes** → **2–4 core** chips; solution bias warning if present.
* *Tip:* clearer PS → better themes. Include **who/context**, **struggling**, **workarounds**, **outcomes**; avoid solution wording here.

### Interview Themes (`/interview`)

Theme-Only Mode focusing on just the 13 Core Universals for fast clustering.

Workflow:
1. Paste raw interview notes (multiple interviews separated by blank lines or headers).
2. Click Extract Themes.
3. See a table of each interview with:
   * Core themes (up to 3) with discrete weights (0.33 / 0.67 / 1.0)
   * Emergent facet badges (display-only; not in vector)
   * Context tokens (role / language / geo when explicit)
4. Proceed directly to Metrics & Clusters (no approvals, narratives, or editing).

Determinism & Guardrails:
* Risk requires explicit penalty/lock-in/compliance cues.
* Value requires renewal/cancel/worth triggers (never inferred from generic cost talk).
* Support requires explicit human help / customer support language.
* At most 3 cores per interview; weights discretized.
* Emergent facets limited to top ≤3 non-core phrases by frequency.
* No narratives, no quotes, no coverage %, no approvals.

### Student Edition Constraint Rationale

This build intentionally enforces a **15 interview cap** and a fixed **13-core dimension space**. These constraints are pedagogical and technical:

Why 13 fixed cores:
* Keeps vectors dense enough for stable cosine clustering with small-N.
* Teaches prioritization: users must phrase PS around a few universal tensions instead of inventing bespoke tags.
* Enables deterministic comparison across cohorts (everyone learns on the same axis set).

Why cap at 15 interviews:
* Diminishing signal: By ~12–15 you generally reach thematic saturation for PS validation (no new core emerges, rank order stabilizes).
* Prevents “evidence hoarding” before synthesizing; encourages iterative refinement.
* Keeps extraction + clustering near-instant (low cognitive/context switching cost for students).
* Simplifies guidance: one clear stop line rather than subjective “maybe keep going.”

Stop criteria (any pro upgrade would formalize these as metrics):
1. Last 4 interviews add **no new core twice**.
2. Top 3 core rank order unchanged across last 5 interviews.
3. No emergent facet crosses a “promotion” threshold (e.g., appears in ≥30% of interviews with ≥Medium weight alignment to a core not in PS).
4. Silhouette delta < 0.02 after adding a batch of 2–3 interviews.

When more than 15 might matter (future Pro triggers):
* Distinct hypothesized segments each <5 reps (role, geo, maturity).
* Late weak signal (e.g., trust) starts recurring and needs validation.
* Pricing / packaging or willingness-to-pay exploration (needs diversity + depth).
* Need for sub-cluster narratives (k=4–5) with stable member counts.

Planned Pro Mode extensions (roadmap sketch):
* Configurable `maxInterviews` (e.g., 30–50) with adaptive recommendation (auto-suggest +3 if a new core appears twice late).
* Dimension tier overlays (contextual or sector packs) layered atop the 13 universal cores.
* Segment-aware clustering: cluster within segments, then compare centroid drift.
* Facet maturity scoring (emerging vs established) and facet purity metrics.
* Saturation meter UI (visual stop indicators using the criteria above).
* Enhanced diagnostics: core imbalance normalization toggle, sparsity heatmap, PS alignment coverage.

Non-goals (Student Edition):
* Persona narrative generation.
* Free-form tag clouds.
* Unlimited transcript ingestion.

### Config Hooks (future-proofing)

Add a minimal config module to externalize current literals so upgrading to Pro mode is a non-breaking change:

```
// app/(clusters)/lib/config.ts
export const THEMES_CONFIG = {
	mode: process.env.NEXT_PUBLIC_MODE || 'student',
	maxInterviews: Number(process.env.NEXT_PUBLIC_THEMES_MAX || 15),
	maxSentences: 60,
	cores: 13,
};
```

Then in `api/themes/route.ts`, replace `parts.slice(0,15)` with `parts.slice(0, THEMES_CONFIG.maxInterviews)` and `slice(0,60)` for sentences similarly. This keeps Student defaults while allowing a Pro toggle later via env var or feature flag.

Upgrade trigger copy example (not yet implemented):
> Processed first 15 of 28 interviews (Student limit). Unlock Pro Mode to analyze all interviews, segment by role, and track saturation metrics.

This section exists to remind maintainers NOT to prematurely expand dimensionality or volume without adding corresponding interpretability tooling.

Matrix Shape:
* `themesMatrix`: rows = interviews; 13 fixed columns in canonical core order.
* Also mirrored into `profilesMatrix` with synthetic minimal profiles for backward compatibility with existing clustering code.

Deprecation Notice:
* The older `/profiles` JTBD page now displays a redirect notice and will be removed after the metrics & insights layers are fully adapted.

### Metrics & Clusters (`/metrics`) — *next phase*

* Reads `profiles`, `matrix`, computes coverage/completeness/imbalance and runs ABAC (see contracts below).

### Insights (`/insights`) — *next phase*

* Data-first report; optional low-temp narration to rephrase into slot-safe JSON; deterministic fallback templates.

---

## ABAC (pure CS) — API contract (next phase)

**ABAC (Adaptive Business Alignment Clustering)** — deterministic clustering of **interview theme vectors (rows × 13 cores)**. No LLM.

### `POST /api/metrics`

**Input**

```json
{
	"profiles": [
		{ "id":"1", "theme_weights": { "trust":1.0, "cost":0.67 } }
	],
	"ps_themes": ["trust","cost","flexibility","information"]
}
```

**Output**

```json
{
	"coverage": {
		"core_totals": [{ "tag":"trust","sum":4.67 }, { "tag":"cost","sum":3.25 }]
	},
	"completeness": {
		"per_profile": [{ "id":"1","who":true,"struggle":true,"outcomes":false,"jobs":true }],
		"overall": { "who":0.88,"struggle":1.0,"workarounds":0.75,"outcomes":0.38,"jobs":0.62 }
	},
	"imbalance": { "dominant":"cost", "ratio": 2.1 },
	"warnings": { "solution_bias": true, "thin_interviews": 3 },
	"note": ""
}
```

### `POST /api/clusters`

**Input**

```json
{
	"matrix": [["1", {"trust":1.0,"cost":0.67}], ["2", {"flexibility":1.0}], ...],
	"k_range": [2,5],
	"distance": "cosine"
}
```

**Output**

```json
{
	"k_selected": 3,
	"validity": { "silhouette": 0.41, "alt": [{ "k":2,"silhouette":0.36 }, { "k":4,"silhouette":0.39 }] },
	"clusters": [
		{
			"id": 0, "size": 5,
			"centroid": { "trust": 0.88, "reliability": 0.71 },
			"top_dims": ["trust","reliability"],
			"top_facets": ["referral_networks","staff_rotation"],
			"representatives": ["1","8"]
		}
	],
	"note": ""
}
```

**Defaults & assumptions**

* Distance: **cosine**.
* `k ∈ [2..5]`, choose max silhouette.
* **Tie-break:** if silhouette ties, pick the **lower k** for interpretability unless coverage shows a major unresolved theme gap.
* **Small-N guard:** require **N ≥ k + 2**; else return a single “no clustering yet” group with guidance to gather more interviews.
* Top facets per cluster: count member facets; exclude context facets.
* **Skew guard (optional):** if a core (e.g., **cost**) dominates globally, you may standardize by global mean/variance before clustering. Keep default unnormalized cosine first; enable normalization only when skew demonstrably harms separation.

---

## Insights — spec & contract (next phase)

### `POST /api/insights`

**Input**

```json
{
	"ps_themes": ["trust","cost","flexibility","information"],
	"metrics": { /* /api/metrics output */ },
	"clusters": { /* /api/clusters output */ },
	"profiles": [
		{ "id":"1","narrative":"...", "theme_weights": { "trust":1.0,"cost":0.67 }, "themes": { "core":["trust","cost"], "facets":["referral_networks"] } }
	]
}
```

**Output**

```json
{
	"overview": {
		"convergence": ["trust","flexibility"],
		"divergence": { "ps_only": ["information"], "observed_only": ["value"] },
		"data_quality": ["3 interviews missing outcomes","solution bias detected"]
	},
	"clusters": [
		{
			"id": 0,
			"label": "Trust · Referral networks",
			"why": ["High centroid weights on trust/reliability","Frequent 'referral_networks' facet"],
			"representatives": ["1","8"]
		}
	],
	"next_steps": [
		"Run 2 interviews focused on outcomes/selection criteria to improve cluster interpretability",
		"Probe cost ceilings for the Flexibility cluster (quick willingness-to-pay check)"
	],
	"notes": []
}
```

**Label rule:** `TopCore · TopFacet` when a facet has clear consensus; **fallback** to the **top two cores** (e.g., `Trust · Reliability`) if no facet consensus.
**Guardrails:** data-first, no hallucinations; optional low-temp LLM only to rephrase into this JSON; deterministic templates on failure.

---

## Known limitations (and how to handle them)

* **Themes = single-word cores.** Nuance is compressed for comparability. Use **facets** for domain color.
* **“Support” is literal.** “Streaming service” ≠ support; “help from a person/support team” does.
* **Solution bias affects themes.** We filter solution sentences, but leakage can happen. Keep PS problem-only; Insights will flag bias.
* **Vague inputs → vague outputs.** Thin findings mean short profiles & weak clusters. Capture **Who/Context · Struggling · Workarounds · Anxieties · Outcomes** per interview.
* **Critical facets capped** to keep cards readable (≤3 per profile).
* **Stability over creativity.** If LLM is slow/uncertain, we return a simpler narrative rather than failing.
* **Context doesn’t drive math** by default (role, geo, language). Use later for slicing.
* **Interview limit:** ~15 per run; use batches if bigger.
* **Local-only persistence in dev:** set `NEXT_PUBLIC_PERSIST=0`. Use page-level **Clear fields** or **Account → Reset** to wipe.
* **Student-first tool:** favors stability and clarity; when input is thin/ambiguous, returns a **safe** summary and suggests better evidence.

---

## Troubleshooting

### TODO / Open Visual Issue

* Ring animation start angle (Rings view): Some environments show certain arc segments appearing to start around “7–8 o’clock” instead of the intended 12 o’clock. Current implementation (`RingsView.tsx`) draws each arc path starting at the top using `M 0 -r A r r 0 1 1 0 r A r r 0 1 1 0 -r` and animates with a full‐circumference `strokeDasharray` + `strokeDashoffset` transition (from `C` → `(1 - fraction)*C`). Geometrically this is correct; the perceived offset is likely visual.
	Investigation checklist (defer until we revisit):
	1. Change `strokeLinecap` from `round` → `butt` to rule out cap overhang creating a false leading edge.
	2. Temporarily set a thin guide line at 12 o’clock (already scaffolded/commented) to visually confirm origin.
	3. Add `pathLength={1}` and express dash values as ratios to rule out browser circumference rounding differences.
	4. Test on different pixel densities (retina vs standard) to see if antialiasing shifts the apparent start.
	5. As fallback, consider animating path length growth (dasharray 0→target) instead of dashoffset, though that previously exhibited the same perception.
	6. If still ambiguous, render a faint radial tick ring (12/3/6/9) only during animation for orientation.
	No functional regression elsewhere; purely a visual polish item, safe to defer.

* **Restart showed another project:** Persistence was ON (localStorage). Set `NEXT_PUBLIC_PERSIST=0` and clear `clusters-student-*` keys in DevTools → Application → Local Storage.
* **React error “Objects are not valid as a child”:** Ensure arrays include **strings**, not objects. Profiles API now string-sanitizes lists; UI maps `.map(x => String(x?.tag ?? x))`.
* **PS returned “risk” incorrectly:** We map renew/cancel/worth-it → **value**; **risk** needs explicit lock-in/penalty/contract language.

---

## Contributing & extensions

### Facet packs

Log unknown phrases (shadow mode), review/approve into JSON packs per domain (childcare, streaming…), extend `FACETS_TO_CORE` + synonyms in `universals.ts`.

**Facet pack JSON (example):**

```json
{
	"domain": "childcare",
	"version": "2025-01-01",
	"facets": [
		{ "id": "overnight_care",       "maps_to": "flexibility", "synonyms": ["overnight", "night shifts", "overnight nanny"] },
		{ "id": "referral_networks",    "maps_to": "trust",       "synonyms": ["referrals", "word of mouth", "trusted network"] },
		{ "id": "staff_rotation",       "maps_to": "reliability", "synonyms": ["rotating staff", "turnover", "inconsistent caregivers"] },
		{ "id": "household_support",    "maps_to": "effort",      "synonyms": ["meal prep", "light cleaning", "errands"] },
		{ "id": "bilingual_support",    "maps_to": "access",      "synonyms": ["spanish speaking", "language match"] }
	]
}
```

### Interpretability heuristic (future QA/Insights)

* **Core concentration:** top 1–2 cores explain ≥ X% of centroid weight.
* **Facet purity:** cluster’s top facet appears in ≥ Y% of members.
* **Representative completeness:** ≥ 1 representative profile has outcomes + jobs + anxieties populated.

### Skew guard (optional)

If one core dominates globally (e.g., **cost**), consider standardizing dimensions by global mean/variance before clustering. Keep default unnormalized cosine first; enable normalization only when skew harms separation.

---

## Tech stack

* **Next.js** (App Router, TS) — UI & API routes
* **Zustand** — client state, with opt-in localStorage persist (`NEXT_PUBLIC_PERSIST`)
* **OpenAI** — low-temp LLM calls for PS scoring & narrative draft; **timeouts** + **concurrency=3**; **never-500** user errors
* **Pure CS** — ABAC clustering over core-dimension vectors (no LLM in cluster decisions)

---

This README is the current source of truth. When you implement `/api/metrics`, `/api/clusters`, and `/api/insights`, follow the contracts above so Insights stays slot-safe and data-first.

---

## Data Contract Stability

| Endpoint | Stability | Notes |
|----------|-----------|-------|
| `POST /api/pains/extract` | Stable | Core theme extraction (2–4 cores) + solution-bias warnings. Field names frozen; warning keys may extend. |
| `POST /api/themes` | Stable (shape) / Tunable (heuristics) | `matrix` + `display` arrays stable; internal cue heuristics & warnings list may evolve. 15 interview & 60 sentence caps configurable in `config.ts` (not yet wired). |
| `POST /api/metrics` | Stable (v1) | `coverage.core_totals`, `completeness.per_profile/overall`, `imbalance`, `warnings` objects stable; may append new warning keys (non-breaking). |
| `POST /api/clusters` | Stable (v1 backend) | k-selection, `validity.silhouette`, `clusters[]` fields stable; future additions: `label`, `ps_match_explained`. No removals planned. |
| `POST /api/insights` | Planned | Contract documented above; not yet implemented. |
| `/api/profiles` (legacy) | Deprecated | Will be removed after Insights consumes matrix directly. |

Versioning Policy:
* Additive fields only until first Pro release (no breaking renames).
* Deprecated endpoints emit a `Deprecation` note field 1 milestone before removal.
* Heuristic changes that do not change output field names (e.g., facet scoring tweaks) are not version bumps.

Consumer Guidance:
* Treat unknown keys in `warnings` or cluster objects as optional (forward compatibility).
* Do not rely on ordering inside arrays except where documented (e.g., top_dims sorted by weight desc).
* For deterministic tests, pin snapshots to `tag` + numeric values (ignore warning ordering).

Config Source:
* See `app/(clusters)/lib/config.ts` (`THEMES_CONFIG`) for future parameterization; currently not wired into routes to keep behavioral parity.

