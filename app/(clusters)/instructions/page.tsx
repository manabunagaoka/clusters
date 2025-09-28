"use client";

import styles from './instructions.module.css';
import { CoreChip } from '../components/CoreChip';

export default function Page(){
  return (
    <section className={styles.page}>
      <h2 style={{ marginTop: 0 }}>Instructions</h2>

      <div className="card" style={{ marginTop: 12 }}>
        <div className={styles.cardTitle}>What Clusters Is</div>
        <div className={styles.bodyText}>
          Clusters is the first intelligent tool powered by <b>Manaboodle’s Synchronicity Engine</b>. It’s designed to uncover synchronistic moments where the “dots” connect and form meaningful clusters.
          The <b>JTBD Student Edition (MVP)</b> is built to help you validate business ideas and refine them using the <b><a href="https://www.christenseninstitute.org/theory/jobs-to-be-done/?gad_source=1&gad_campaignid=22404177831&gbraid=0AAAAADsapT_jd8RaeyuwwRgSbrGGYEswV&gclid=CjwKCAjwuePGBhBZEiwAIGCVS6McI11ceCYIQ3NQ-eKUqEihYwnwfHNkIQ6rBSasHBQosOkmfupZyxoCPJMQAvD_BwE" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>Jobs-To-Be-Done (JTBD)</a></b> framework. JTBD helps you shift your focus away from solutions you imagine and toward the real problems customers struggle with.
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className={styles.cardTitle}>Why This Matters</div>
        <div className={styles.bodyText}>
          Too many entrepreneurs fall in love with their solution before deeply understanding what people actually want solved. Clusters helps you avoid that trap by starting with <b>evidence</b>, not assumptions.
          Unlike typical AI tools that rely only on large language models, Clusters intentionally combines AI for cleaning and summarizing with deterministic computer science (<b>ABAC Plus — Adaptive Business Alignment Clustering</b>), guided by a human-centered set of <b>universal lenses</b> (<i>Human, Context, and Business Universals</i>). This blend keeps results <b>repeatable</b>, <b>explainable</b>, and grounded in human truth, not just probabilistic text.
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className={styles.cardTitle}>Flow</div>
        <ol className={styles.bodyOrdered}>
          <li><strong>Problem Statement</strong> — Say who this is for, what feels hard right now, what they currently do to cope, and what “good” would look like.</li>
          <li><strong>Extract Themes</strong> — We turn your wording into up to <strong>3 Core Themes</strong> (from our set of 13) plus an optional Meta Theme. This gives a shared lens so different interviews can be compared fairly.</li>
          <li><strong>Interviews → Paste Notes (JTBD-guided)</strong> — Use the same four cues as your Problem Statement: <em>who it’s for</em>, <em>what’s hard</em>, <em>current workaround</em>, <em>what “good” looks like</em>. Put <strong>one concrete idea per line</strong>, add a header like “Interview # — Name (Location)”, and leave a <strong>blank line</strong> between interviews. <em>Limit: 15 interviews. We recommend 10–15 for stable Themes and Clusters.</em></li>
          <li><strong>Form Clusters</strong> — We group interviews that care about <em>similar Themes</em> so natural segments emerge from what people actually said (not assumptions). You’ll see each cluster’s top Themes, size, and a few representative interviews.</li>
          <li><strong>Insights</strong> — A short, plain-English readout that connects <em>Problem Statement → Interviews → Clusters</em> and suggests practical next steps (refine wording, who to interview next, what to probe). It guides discovery; it is <em>not</em> a verdict on idea quality.</li>
        </ol>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className={styles.cardTitle}>Extensibility</div>
        <div className={styles.bodyText}>
          <p>Clusters uses a shared set of <strong>Core Themes</strong> so you can compare interviews across different products and services. We also surface <strong>Emergent Themes</strong>—ideas that show up in notes outside the Core set—so you can decide whether to include or probe them later.</p>
          <div className={styles.coreGrid} role="list" aria-label="Core Themes">
            <div className={styles.coreItem} role="listitem">
              <CoreChip core="cost" />
              <div className={styles.coreDesc}>price, fees, total spend</div>
            </div>
            <div className={styles.coreItem} role="listitem">
              <CoreChip core="time" />
              <div className={styles.coreDesc}>speed, waiting, delays</div>
            </div>
            <div className={styles.coreItem} role="listitem">
              <CoreChip core="effort" />
              <div className={styles.coreDesc}>how hard it is to get done</div>
            </div>
            <div className={styles.coreItem} role="listitem">
              <CoreChip core="quality" />
              <div className={styles.coreDesc}>how good / reliable the outcome feels</div>
            </div>
            <div className={styles.coreItem} role="listitem">
              <CoreChip core="reliability" />
              <div className={styles.coreDesc}>consistency; shows up / works as expected</div>
            </div>
            <div className={styles.coreItem} role="listitem">
              <CoreChip core="trust" />
              <div className={styles.coreDesc}>safety, credibility, peace of mind</div>
            </div>
            <div className={styles.coreItem} role="listitem">
              <CoreChip core="flexibility" />
              <div className={styles.coreDesc}>scheduling, changes, short-notice needs</div>
            </div>
            <div className={styles.coreItem} role="listitem">
              <CoreChip core="choice" />
              <div className={styles.coreDesc}>options; ability to pick what fits</div>
            </div>
            <div className={styles.coreItem} role="listitem">
              <CoreChip core="information" />
              <div className={styles.coreDesc}>clarity, instructions, knowing what to do</div>
            </div>
            <div className={styles.coreItem} role="listitem">
              <CoreChip core="risk" />
              <div className={styles.coreDesc}>uncertainty, downside, exposure</div>
            </div>
            <div className={styles.coreItem} role="listitem">
              <CoreChip core="support" />
              <div className={styles.coreDesc}>help when stuck (human or guided)</div>
            </div>
            <div className={styles.coreItem} role="listitem">
              <CoreChip core="access" />
              <div className={styles.coreDesc}>eligibility, language, coverage, availability</div>
            </div>
            <div className={styles.coreItem} role="listitem">
              <CoreChip core="value" />
              <div className={styles.coreDesc}>worth for the price; fair trade-off</div>
            </div>
          </div>
          <p className={styles.note}><em>Note:</em> We recognize common synonyms (e.g., “reliability” often signals “trust”; “schedule/time” often signals “flexibility”; “eligibility/language/coverage” signals “access”). You can adjust wording as your domain requires.</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className={styles.cardTitle}>Known Limitations</div>
        <ul className={styles.bodyList}>
          <li><strong>Not a crystal ball.</strong> Insights organize patterns; they don’t predict outcomes or judge whether an idea is “good.”</li>
          <li><strong>Sample size matters.</strong> Up to 15 interviews per run; aim for 10–15 to see stable clusters. Small pockets may require a few more interviews before deciding.</li>
          <li><strong>Sector nuance.</strong> Industries use different language and constraints. Expect to refine wording as you see more real cases.</li>
          <li><strong>Quality in → quality out.</strong> Be concrete: who the person is, what’s hard, the current workaround, and what “good” looks like (JTBD cues).</li>
          <li><strong>Synonyms vary.</strong> We map common equivalents (e.g., reliability↔trust, schedule/time↔flexibility, eligibility/language/coverage↔access), but your domain may use different terms—adjust notes accordingly.</li>
          <li><strong>Emergent Themes are advisory.</strong> They surface new ideas from interviews; include them deliberately or gather more evidence before changing your Problem Statement.</li>
          <li><strong>Segmentation, not failure.</strong> A large low-match cluster usually signals different needs (a potential segment), not that your idea is wrong.</li>
        </ul>
      </div>
    </section>
  );
}
