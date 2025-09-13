'use client';

export default function Page(){
  return (
    <section>
      <h2 style={{ marginTop:0 }}>Subscribe</h2>
      <div className="card" style={{ marginTop:12 }}>
        <div className="hint" style={{ marginBottom:8 }}>
          Get updates about the JTBD Student Edition and new Manaboodle tools.
        </div>
        <a
          className="btn btn-primary"
          href="https://www.manaboodle.com/subscribe"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display:'inline-block' }}
        >
          Subscribe on Manaboodle
        </a>
      </div>
    </section>
  );
}
