'use client';
import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import LoaderDots from '../components/LoaderDots';
import ReadinessMeter from '../components/ReadinessMeter';
import { useRouter } from 'next/navigation';

function Tile({ label, value, sub }: { label: string; value: number; sub: string }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background:'#fff' }}>
      <div style={{ fontSize: 12, color: '#374151', fontWeight:500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{pct}%</div>
      <div style={{ fontSize: 11, color: '#6B7280', lineHeight:1.2 }}>{sub}</div>
    </div>
  );
}

export default function MetricsClustersPage() {
  const s = useAppStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // Allow run if legacy profiles path OR new theme-only matrix present
  const hasThemesMatrix = Array.isArray(s.themesMatrix) && s.themesMatrix.length > 0;
  const canRun = s.canRunQC() || hasThemesMatrix;
  const rd = s.readiness;
  const metrics = s.metricsRes;
  const clusters = s.clustersRes;

  // Client-side redirect only; SSR always renders same shell to avoid hydration mismatch
  if (typeof window !== 'undefined' && !canRun && !s.busyProfiles && !hasThemesMatrix) {
    // defer to next tick to avoid changing during render
  setTimeout(() => { if (!s.canRunQC()) router.replace('/interview'); }, 0);
  }

  async function onRun() {
    if (!canRun) return;
    setLoading(true);
    try {
      if (hasThemesMatrix && !s.profilesMatrix?.length) {
        // Direct cluster call using themesMatrix; fabricate minimal profiles shape
        const body = { matrix: s.themesMatrix, profiles: (s.themesDisplay||[]).map((d:any,i:number)=>({ id:`T${i+1}`, themes:{ facets: d.facets||[] } })), k_range:[2,5], distance:'cosine' };
        const resp = await fetch('/api/clusters', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r=>r.json());
        // Store into clustersRes only (metricsRes not computed in theme-only mode yet)
        useAppStore.setState({ clustersRes: resp });
      } else {
        await s.getQualityAnalysis();
      }
    } finally { setLoading(false); }
  }

  return (
      <section data-page="metrics">
        <h2 className="page-title">Quality Metrics &amp; Clusters</h2>
        <div className="card" style={{ marginTop: 12, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
          <button onClick={onRun} disabled={loading || !canRun} className="btn btn-primary">
            {loading ? <LoaderDots /> : <span className="btn-label">Run Analysis</span>}
          </button>
          {(clusters || metrics) && (
            <button type="button" className="btn btn-primary" disabled={loading} onClick={()=> router.push('/insights')}>
              Next
            </button>
          )}
          {!canRun && <div className="hint" style={{ marginTop: 8 }}>Extract Interview Themes first.</div>}
        </div>

        {rd && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-title">Readiness</div>
            <div style={{ marginBottom: 8 }}>
              <ReadinessMeter value={rd.overall || 0} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
              <Tile label="Overall" value={rd.overall || 0} sub="Weighted readiness" />
              <Tile label="Focus" value={rd.focus || 0} sub="Theme distribution balance" />
              <Tile label="Clear" value={rd.clear || 0} sub="Coverage breadth" />
              <Tile label="Action" value={rd.action || 0} sub="Outcome / job presence" />
            </div>
          </div>
        )}

        {metrics && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-title" style={{ marginBottom: 8 }}>Coverage (cores)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {metrics.coverage.core_totals.map((t, i) => (
                <span key={t.tag + i} className="chip">{t.tag} <span className="hint" style={{ marginLeft: 4 }}>({t.sum})</span></span>
              ))}
            </div>
            <div className="card-title" style={{ marginTop: 12, marginBottom: 8 }}>Completeness</div>
            <div className="hint">
              outcomes: {Math.round((metrics.completeness.overall.outcomes || 0) * 100)}% · jobs: {Math.round((metrics.completeness.overall.jobs || 0) * 100)}% · workarounds: {Math.round((metrics.completeness.overall.workarounds || 0) * 100)}%
            </div>
            {metrics.imbalance?.dominant && (
              <div className="hint" style={{ marginTop: 8 }}>
                Dominant theme: <b>{metrics.imbalance.dominant}</b>{typeof metrics.imbalance.ratio === 'number' ? ` (${metrics.imbalance.ratio}×)` : ''}{metrics.imbalance.flag ? ' — consider balancing' : ''}
              </div>
            )}
            {metrics.warnings?.thin_interviews ? (
              <div className="hint" style={{ marginTop: 8, color: '#b45309' }}>
                Thin interviews: {metrics.warnings.thin_interviews} — add outcomes/jobs for clearer interpretation.
              </div>
            ) : null}
          </div>
        )}

        {clusters && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-title" style={{ marginBottom: 8 }}>Clusters</div>
            <div className="hint" style={{ marginBottom: 8 }}>
              k = {clusters.k_selected} · silhouette = {clusters.validity?.silhouette?.toFixed?.(2) ?? '—'}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {clusters.clusters.map((c) => {
                const dims = c.top_dims?.join(' · ') || `Cluster ${c.id}`;
                const facets = (c.top_facets||[]).slice(0,4).join(', ');
                const reps = (c.representatives||[]).slice(0,3).join(', ');
                // Build one-line human story
                let story = '';
                const coreParts = c.top_dims || [];
                if (coreParts.length >= 2) story = `This group centers on ${coreParts[0]} and ${coreParts[1]}`;
                else if (coreParts.length === 1) story = `This group centers on ${coreParts[0]}`;
                const facetParts = (c.top_facets||[]).slice(0,2);
                if (facetParts.length) story += `${story ? '; ' : ''}people often mention ${facetParts.join(' and ')}`;
                if (story) story += '.';
                return (
                  <div key={c.id} style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:12, background:'#fff' }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{dims} <span style={{ color:'#6b7280', fontWeight:400 }}>({c.size})</span></div>
                    {story && <div style={{ fontSize:12, color:'#111827', marginTop:4 }}>{story}</div>}
                    <div style={{ fontSize:12, color:'#374151', marginTop:4 }}>
                      <span style={{ color:'#6b7280' }}>Facets:</span> {facets || '—'}
                    </div>
                    <div style={{ fontSize:12, color:'#374151', marginTop:2 }}>
                      <span style={{ color:'#6b7280' }}>Examples:</span> {reps || '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
  );
}

