import { NextRequest, NextResponse } from 'next/server';
import { CORE_DIMENSIONS } from '@/app/(clusters)/lib/universals';

/** Round to 2 decimals (fixed) */
function r2(n: number): number { return Number((n ?? 0).toFixed(2)); }

type CoreId = typeof CORE_DIMENSIONS[number];

interface MetricsInputProfile {
  id?: string;
  theme_weights?: Record<string, number>;
  jtbd?: {
    who?: string;
    context?: Record<string, unknown>;
    struggling_moment?: string;
    workarounds?: unknown;
    jobs?: unknown;
    outcomes?: unknown;
    selection_criteria?: unknown;
    anxieties?: unknown;
  };
  // Allow arbitrary extra fields without failing
  [k: string]: unknown;
}

interface MetricsRequestBody {
  profiles?: MetricsInputProfile[];
  ps_themes?: string[];
  ps_warnings?: { solution_bias?: boolean; [k: string]: unknown };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as MetricsRequestBody));
    const { profiles = [], ps_themes = [], ps_warnings = {} } = body as MetricsRequestBody;

    // Normalize profiles list
    const normProfiles = Array.isArray(profiles) ? profiles.filter(p => p && typeof p === 'object') : [];

    // Coverage aggregation
    const coverageSums = new Map<CoreId, number>();
    for (const core of CORE_DIMENSIONS) coverageSums.set(core, 0); // initialize to 0 for stable ordering later

    // Completeness per profile
    const completenessPer: Array<{
      id: string;
      who_or_context: boolean;
      struggle: boolean;
      workarounds: boolean;
      jobs: boolean;
      outcomes: boolean;
      extras: { selection_criteria: boolean; anxieties: boolean };
    }> = [];

    let thinCount = 0;

    for (const raw of normProfiles) {
      const id = String(raw.id || '').trim() || String(completenessPer.length + 1);
      const weights = (raw.theme_weights && typeof raw.theme_weights === 'object') ? raw.theme_weights : {};
      for (const [k, v] of Object.entries(weights)) {
        if (!Number.isFinite(v)) continue;
        if ((CORE_DIMENSIONS as string[]).includes(k)) {
          coverageSums.set(k as CoreId, (coverageSums.get(k as CoreId) || 0) + Number(v));
        }
      }

  const jtbd = (raw.jtbd || {}) as NonNullable<MetricsInputProfile['jtbd']>;
  const ctxObj: Record<string, unknown> | undefined = (jtbd && typeof jtbd.context === 'object') ? jtbd.context : undefined;
  const who_or_context = Boolean(jtbd.who) || (ctxObj ? Object.values(ctxObj).some(Boolean) : false);
  const struggle = Boolean(jtbd.struggling_moment);
  const workarounds = Array.isArray(jtbd.workarounds) && jtbd.workarounds.length > 0;
  const jobs = Array.isArray(jtbd.jobs) && jtbd.jobs.length > 0;
  const outcomes = Array.isArray(jtbd.outcomes) && jtbd.outcomes.length > 0;
  const selection_criteria = Array.isArray(jtbd.selection_criteria) && jtbd.selection_criteria.length > 0;
  const anxieties = Array.isArray(jtbd.anxieties) && jtbd.anxieties.length > 0;

      const primaryCount = [who_or_context, struggle, workarounds, jobs, outcomes].filter(Boolean).length;
      const isThin = !outcomes || primaryCount < 3;
      if (isThin) thinCount++;

      completenessPer.push({
        id,
        who_or_context,
        struggle,
        workarounds,
        jobs,
        outcomes,
        extras: { selection_criteria, anxieties }
      });
    }

    // Coverage core_totals array
    // Only include cores that have >0 OR were explicitly in ps_themes. We'll add ps_themes with zero if needed.
    const psSet = new Set((Array.isArray(ps_themes) ? ps_themes : []).map(s => String(s || '').trim()).filter(Boolean));

    // Ensure ps cores present (even if zero) for convergence/divergence downstream
    for (const ps of psSet) {
      if ((CORE_DIMENSIONS as string[]).includes(ps) && !coverageSums.has(ps as CoreId)) {
        coverageSums.set(ps as CoreId, 0);
      }
    }

    const coverageArray = Array.from(coverageSums.entries())
      .filter(([core, sum]) => sum > 0 || psSet.has(core))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, sum]) => ({ tag, sum: r2(sum) }));

    // Completeness overall fractions
    const denom = completenessPer.length || 1; // avoid div/0
    const overall = {
      who_or_context: r2(completenessPer.filter(p => p.who_or_context).length / denom),
      struggle: r2(completenessPer.filter(p => p.struggle).length / denom),
      workarounds: r2(completenessPer.filter(p => p.workarounds).length / denom),
      jobs: r2(completenessPer.filter(p => p.jobs).length / denom),
      outcomes: r2(completenessPer.filter(p => p.outcomes).length / denom)
    };

    // Imbalance calculation
    let imbalance: { dominant?: string; ratio?: number; flag?: boolean } = {};
    const nonZero = coverageArray.filter(c => c.sum > 0);
    if (nonZero.length === 1) {
      imbalance.dominant = nonZero[0].tag;
    } else if (nonZero.length >= 2) {
      const [first, second] = [...nonZero].sort((a, b) => b.sum - a.sum);
      const ratio = second.sum > 0 ? r2(first.sum / second.sum) : undefined;
      imbalance = {
        dominant: first.tag,
        ratio,
        flag: typeof ratio === 'number' ? ratio >= 1.5 : undefined
      };
    }

    const thin_fraction = r2(normProfiles.length ? thinCount / normProfiles.length : 0);

    const warnings: Record<string, unknown> = {
      solution_bias: Boolean(ps_warnings?.solution_bias),
      thin_interviews: thinCount,
      thin_fraction
    };
    if (nonZero.length < 2) warnings.low_coverage = true;
    if (thin_fraction >= 0.33) warnings.thin_flag = true;

    const response = {
      coverage: { core_totals: coverageArray },
      completeness: { per_profile: completenessPer, overall },
      imbalance,
      warnings,
      note: ''
    };

    return NextResponse.json(response, { status: 200 });
  } catch (e) {
    return NextResponse.json({
      coverage: { core_totals: [] },
      completeness: { per_profile: [], overall: { who_or_context: 0, struggle: 0, workarounds: 0, jobs: 0, outcomes: 0 } },
      imbalance: {},
      warnings: { error: true },
      note: e instanceof Error ? e.message : 'metrics computation failed'
    }, { status: 200 });
  }
}
