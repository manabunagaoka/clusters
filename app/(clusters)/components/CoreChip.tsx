"use client";
import React from 'react';
import { CORE_COLORS } from '../lib/coreColors';

interface CoreChipProps { core: string; variant?: 'filled'|'outline'; size?: 'sm'|'md'; title?: string }

export function CoreChip({ core, variant='filled', size='sm', title }: CoreChipProps){
  const key = String(core || '').toLowerCase().trim();
  let color = CORE_COLORS[key] || '#475569';
  const filled = variant === 'filled';
  const pad = size === 'md' ? '2px 10px' : '2px 8px';
  const fontSize = size === 'md' ? 12 : 11;
  const height = size === 'md' ? 22 : 20;
  // If the color is the muted slate (support) add a subtle border + elevate saturation for visibility
  const isMuted = color.toLowerCase() === '#64748b';
  const displayColor = isMuted && filled ? '#475569' : color; // darken muted for contrast
  const bg = filled ? displayColor : 'transparent';
  const ink = filled ? '#fff' : displayColor;
  const style: React.CSSProperties = {
    display:'inline-flex', alignItems:'center',
    background: bg,
    color: ink,
    border: '1px solid '+displayColor,
    borderRadius: 9999, padding: pad, fontSize, lineHeight:1.1, fontWeight:600,
    letterSpacing:0.3, textTransform:'uppercase',
    maxWidth:140, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
    height,
    boxShadow: filled ? '0 0 0 1px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.08)' : 'none'
  };
  return <span data-core-chip data-variant={variant} style={style} title={title || key}>{key}</span>;
}

export default CoreChip;
