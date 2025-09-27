"use client";
import React from 'react';
import { CORE_COLORS } from '../lib/coreColors';

interface CoreChipProps { core: string; variant?: 'filled'|'outline'; size?: 'sm'|'md'; title?: string }

export function CoreChip({ core, variant='filled', size='sm', title }: CoreChipProps){
  const color = CORE_COLORS[core] || '#475569';
  const filled = variant === 'filled';
  const pad = size === 'md' ? '2px 10px' : '2px 8px';
  const fontSize = size === 'md' ? 12 : 11;
  const height = size === 'md' ? 22 : 20;
  const style: React.CSSProperties = {
    display:'inline-flex', alignItems:'center',
    background: filled ? color : 'transparent',
    color: filled ? '#fff' : color,
    border: filled ? '1px solid '+color : '1px solid '+color,
    borderRadius: 9999, padding: pad, fontSize, lineHeight:1.1, fontWeight:500,
    maxWidth:120, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
    height,
  };
  return <span data-core-chip data-variant={variant} style={style} title={title || core}>{core}</span>;
}

export default CoreChip;
