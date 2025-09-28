// Centralized configuration for Student vs future Pro mode.
// Imported by parsing/extraction routes and (optionally) UI helpers.
// Keep values primitive & serializable (avoid functions) so they can be exposed client-side if needed via NEXT_PUBLIC_* mirroring.

export type AppMode = 'student' | 'pro';

export interface ThemesConfig {
  mode: AppMode;
  /** Hard cap on interviews processed per extraction run (segment()). */
  maxInterviews: number;
  /** Hard cap on sentences analyzed per interview block. */
  maxSentences: number;
  /** Fixed universal core dimension count (13 for student edition). */
  cores: number;
  /** Future: enable dimension tier overlays (sector/context). */
  enableExtendedDimensions: boolean;
  /** Future: adaptive saturation guidance (suggest more interviews if new cores emerge). */
  adaptiveSaturation: boolean;
}

export const THEMES_CONFIG: ThemesConfig = {
  mode: (process.env.NEXT_PUBLIC_MODE as AppMode) || 'student',
  maxInterviews: Number(process.env.NEXT_PUBLIC_THEMES_MAX || 15),
  maxSentences: 60,
  cores: 13,
  enableExtendedDimensions: false,
  adaptiveSaturation: false,
};

// Helper: safe accessor (useful if we later allow runtime overrides)
export function getThemesConfig(): ThemesConfig { return THEMES_CONFIG; }

// NOTE: To adopt this config in existing routes:
// 1. Replace literals: parts.slice(0,15) -> parts.slice(0, THEMES_CONFIG.maxInterviews)
// 2. Replace sentence slice(0,60) -> slice(0, THEMES_CONFIG.maxSentences)
// 3. (When Pro) conditionally load extended dimension registries before extraction.
