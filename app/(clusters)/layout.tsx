"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href:'/instructions', label:'Instructions' },
  { href:'/problem', label:'Problem Statement' },
  { href:'/archetypes', label:'Archetypes' },
  { href:'/metrics', label:'Quality Metrics & Clusters' },
  { href:'/insights', label:'Insights' },
];

export default function ClustersLayout({ children }:{ children:React.ReactNode }) {
  const p = usePathname();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Clusters</div>
        <div className="hint" style={{marginTop:-6}}>JTBD Student Edition</div>
        <nav className="nav">
          {items.map(it => (
            <Link key={it.href} className={`nav-link ${p===it.href ? 'active' : ''}`} href={it.href}>
              {it.label}
            </Link>
          ))}
        </nav>
        <div style={{marginTop:'auto'}} className="hint">© Manaboodle</div>
      </aside>

      <div className="content">
        <header className="topbar">
          <div style={{fontWeight:700}}>Clusters JTBD Student Edition</div>
          <div className="hint">student build</div>
        </header>
        <main className="main">
          {children}
        </main>
      </div>
    </div>
  );
}
