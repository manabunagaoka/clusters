"use client";

export default function Page(){
  return (
    <section>
      <h2 style={{ marginTop: 0 }}>Instructions</h2>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>What Clusters is</div>
        <div style={{ color: '#334155', lineHeight: 1.6, fontSize: 14 }}>
          Clusters is the first intelligent tool powered by <b>Manaboodle’s Synchronicity Engine</b>. It’s designed to uncover synchronistic moments where the “dots” connect and form meaningful clusters.
          The <b>JTBD Student Edition (MVP)</b> is built to help you validate business ideas and refine them using the <b>Jobs-To-Be-Done (JTBD)</b> framework. JTBD helps you shift your focus away from solutions you imagine and toward the real problems customers struggle with.
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Why this matters</div>
        <div style={{ color: '#334155', lineHeight: 1.6, fontSize: 14 }}>
          Too many entrepreneurs fall in love with their solution before deeply understanding what people actually want solved. Clusters helps you avoid that trap by starting with <b>evidence</b>, not assumptions.
          Unlike typical AI tools that rely only on large language models, Clusters intentionally combines AI for cleaning and summarizing with deterministic computer science (<b>ABAC Plus — Adaptive Business Alignment Clustering</b>), guided by a human-centered set of <b>universal lenses</b> (<i>Human, Context, and Business Universals</i>). This blend keeps results <b>repeatable</b>, <b>explainable</b>, and grounded in human truth, not just probabilistic text.
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Flow</div>
        <ol style={{ paddingLeft: 18, margin: 0, color: '#334155', lineHeight: 1.8 }}>
          <li><b>Refine your Problem Statement</b> — Make clear who, what’s hard, and what success looks like.</li>
          <li><b>Extract Pains</b> — Pull key pain points to test against interviews.</li>
          <li><b>Interview → Paste Notes</b> — One idea per line. Examples:
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>I’m concerned about <b>rising childcare costs</b>.</li>
              <li>I’m <b>confused by phone data plans</b> — too many choices.</li>
              <li>I’m <b>unsure whether going back to college</b> is right for my career.</li>
            </ul>
          </li>
          <li><b>Generate Archetypes</b> — One-sentence profiles, canonical tags, and aligned quotes.</li>
          <li><b>Run Analysis → Quality Metrics, Readiness &amp; Clusters → Insights</b> — Review metrics and readiness, then learn segments from Clusters formed from Archetypes. Open Insights to see what this means and next steps.</li>
        </ol>
      </div>
    </section>
  );
}
