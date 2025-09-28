'use client';

export default function Page(){
  return (
    <section>
      <h2 className="page-title">Subscribe</h2>
      <div className="card" style={{ marginTop:12, display:'flex', flexDirection:'column', gap:16, padding:16 }}>
        <div style={{fontSize:13, lineHeight:1.55, color:'#334155'}}>
          Get early access to upcoming Pro features: segment evolution tracking, comparative quote lenses, and anchor stability charts.
        </div>
        <div>
          <a
            href="https://www.manaboodle.com/subscribe"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{display:'inline-flex', alignItems:'center', gap:8}}
          >
            Subscribe
          </a>
        </div>
      </div>
    </section>
  );
}
