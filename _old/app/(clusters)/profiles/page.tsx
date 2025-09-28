'use client';
import React, { useEffect } from 'react';
import Link from 'next/link';

export default function ProfilesDeprecatedPage(){
  useEffect(()=>{
    // Auto-redirect after short delay to allow user to read deprecation notice if they landed here via old link
    const t = setTimeout(()=>{ try { window.location.replace('/interview'); } catch {} }, 1200);
    return ()=>clearTimeout(t);
  },[]);
  return (
    <section>
      <h2 className="page-title" style={{ marginTop:0 }}>Profiles Deprecated</h2>
      <div className="card" style={{ marginTop:12 }}>
        <p style={{ margin:0 }}>The detailed Profiles (JTBD) flow has been replaced by a faster Interview Themes workflow focused on the 13 Core Universals.</p>
        <ul className="hint" style={{ marginTop:12, paddingLeft:18 }}>
          <li>No approvals or manual edits required</li>
          <li>Immediate matrix for clustering (cores only + top facets)</li>
          <li>Emergent facets are display-only</li>
        </ul>
        <p style={{ marginTop:12 }}>You will be redirected shortly. If not, use the button below.</p>
        <Link href="/interview" className="btn btn-primary" style={{ display:'inline-block', marginTop:12 }}><span className="btn-label">Go to Interview Themes</span></Link>
      </div>
    </section>
  );
}
