"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  FileText, Bug, Users as UsersIcon, Component as ComponentIcon,
  Sparkles, MailPlus, User, ChevronLeft, ChevronRight, Menu
} from 'lucide-react';

type Item = { href:string; label:string; icon:any; external?:boolean };

const items: Item[] = [
  { href:'/instructions', label:'Instructions', icon: FileText },
  { href:'/problem', label:'Problem Statement', icon: Bug },
  { href:'/archetypes', label:'Archetypes', icon: UsersIcon },
  { href:'/metrics', label:'Quality Metrics & Clusters', icon: ComponentIcon },
  { href:'/insights', label:'Insights', icon: Sparkles },
  // Subscribe = external per spec
  { href:'https://www.manaboodle.com/subscribe', label:'Subscribe', icon: MailPlus, external:true },
];

export default function ClustersLayout({ children }:{ children:React.ReactNode }) {
  const p = usePathname();

  // Desktop collapse + Mobile drawer
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Close drawer when navigating on mobile
  useEffect(() => { if (isMobile) setDrawerOpen(false); }, [p, isMobile]);

  return (
    <div className="app-shell">
      {/* Sidebar with toggle row UNDER header area */}
      <aside className={`sidebar ${collapsed && !isMobile ? 'collapsed' : ''} ${isMobile && drawerOpen ? 'open' : ''}`}>
        {/* Collapse button row aligned to icon column */}
        {!isMobile && (
          <div className="collapse-row">
            <button
              className="collapse-btn"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
            </button>
          </div>
        )}

        {/* Nav items (subtle active shade) */}
        <nav className="nav">
          {items.map(({ href, label, icon:Icon, external }) => {
            const active = !external && p === href;
            const className = `nav-link ${active ? 'active' : ''}`;
            return external ? (
              <a key={href} className={className} href={href} target="_blank" rel="noopener noreferrer" title={label}>
                <Icon className="nav-icon" />
                <span className="nav-label">{label}</span>
              </a>
            ) : (
              <Link key={href} className={className} href={href} title={label}>
                <Icon className="nav-icon" />
                <span className="nav-label">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer: Account only (subtle) */}
        <div className="sidebar-footer" style={{ marginTop:12 }}>
          <Link href="/account" className="nav-link account-link" title="Account" style={{ flexGrow:0 }}>
            <User className="nav-icon" />
            <span className="nav-label">Account</span>
          </Link>
        </div>
      </aside>

      {/* Mobile drawer overlay + hamburger (single toggle on mobile ONLY) */}
      {isMobile && drawerOpen && <div className="overlay" onClick={() => setDrawerOpen(false)} />}

      <div className="content">
        {/* Full-width header with brand + subtitle; hamburger only on mobile */}
        <header className="topbar">
          {isMobile ? (
            <button className="nav-toggle" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
              <Menu size={18} />
            </button>
          ) : (
            <div />
          )}
          <div className="topbar-title">
            <span className="brand-green">Clusters</span>
            <span className="subtitle">JTBD Student Edition (MVP)</span>
          </div>
        </header>

        <main className="main">{children}</main>
      </div>
    </div>
  );
}
