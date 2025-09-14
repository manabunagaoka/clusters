'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  FileText, Bug, Users as UsersIcon, Component as ComponentIcon,
  Sparkles, MailPlus, User, ChevronLeft, ChevronRight
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Item = { href:string; label:string; icon: LucideIcon };

const items: Item[] = [
  { href:'/instructions', label:'Instructions', icon: FileText },
  { href:'/problem', label:'Problem Statement', icon: Bug },
  { href:'/archetypes', label:'Archetypes', icon: UsersIcon },
  { href:'/profiles', label:'Profiles (JTBD)', icon: Sparkles },
  { href:'/metrics', label:'Quality Metrics & Clusters', icon: ComponentIcon },
  { href:'/insights', label:'Insights', icon: Sparkles },
  { href:'/subscribe', label:'Subscribe', icon: MailPlus },
];

export default function ClustersLayout({ children }:{ children:React.ReactNode }) {
  const p = usePathname();
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

  useEffect(() => { if (isMobile) setDrawerOpen(false); }, [p, isMobile]);

  const isOpen = isMobile ? drawerOpen : !collapsed;

  return (
    <div className="app-root">
      {/* Full-width header with chevron toggle next to brand */}
      <header className="topbar">
        <button
          className="header-toggle"
          aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
          onClick={() => (isMobile ? setDrawerOpen(v => !v) : setCollapsed(c => !c))}
          title={isOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {isOpen ? <ChevronLeft className="nav-icon" /> : <ChevronRight className="nav-icon" />}
        </button>
        <div className="topbar-title" style={{ marginLeft: 8 }}>
          <span className="brand-green">Clusters</span>
          <span className="subtitle">JTBD Student Edition (MVP)</span>
        </div>
      </header>

      <div className="app-shell">
        {/* Sidebar with tabs at the very top (no divider) */}
        <aside className={`sidebar ${collapsed && !isMobile ? 'collapsed' : ''} ${isMobile && drawerOpen ? 'open' : ''}`}>
          <nav className="nav">
            {items.map(({ href, label, icon:Icon }) => {
              const active = p === href;
              const className = `nav-link ${active ? 'active' : ''}`;
              return (
                <Link key={href} className={className} href={href} title={label}>
                  <Icon className="nav-icon" />
                  <span className="nav-label">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Spacer and bottom account row */}
          <div style={{ flex: 1 }} />
          <div className="section-sep" />
          <div className="sidebar-footer">
            <Link href="/account" className="plain-row account-row account-link" title="Account">
              <User className="nav-icon" />
              <span className="nav-label">Account</span>
            </Link>
          </div>
        </aside>

        {/* Mobile overlay */}
        {isMobile && drawerOpen && <div className="overlay" onClick={() => setDrawerOpen(false)} />}

        {/* Main content */}
        <div className="content">
          <main className="main">{children}</main>
        </div>
      </div>
    </div>
  );
}