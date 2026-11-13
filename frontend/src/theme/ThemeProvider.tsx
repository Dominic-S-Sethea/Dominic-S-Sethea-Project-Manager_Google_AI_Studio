import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePreset = "crystal" | "violet" | "aurora" | "ember" | "emerald" | "porcelain";

export interface ThemeDefinition {
  id: ThemePreset;
  name: string;
  description: string;
  accent: string;
}

export const THEME_PRESETS: ThemeDefinition[] = [
  {
    id: "crystal",
    name: "Obsidian Signal",
    description: "Graphite-black glass with crystal-bright-blue emphasis (Default).",
    accent: "#54C8FF",
  },
  {
    id: "violet",
    name: "Carbon Orchid",
    description: "Smoky graphite glass with a clear violet signal.",
    accent: "#C7A6FF",
  },
  {
    id: "aurora",
    name: "Aurora Mint",
    description: "Deep green-black glass with a calm mint accent.",
    accent: "#87E2C0",
  },
  {
    id: "ember",
    name: "Forge Amber",
    description: "Warm charcoal glass with a precise amber signal.",
    accent: "#FFC47A",
  },
  {
    id: "emerald",
    name: "Emerald Circuit",
    description: "Neutral black glass with a lucid emerald accent.",
    accent: "#67E7AD",
  },
  {
    id: "porcelain",
    name: "Porcelain Glass",
    description: "Optional daylight frosted glass with cobalt emphasis.",
    accent: "#4773D8",
  },
];

interface ThemeState {
  theme: ThemePreset;
  accent: string;
  hasCustomAccent: boolean;
}

interface ThemeContextValue {
  theme: ThemePreset;
  accent: string;
  hasCustomAccent: boolean;
  preset: ThemePreset;
  presetName: string;
  setTheme: (theme: ThemePreset) => void;
  setPreset: (theme: ThemePreset) => void;
  setCustomAccent: (hex: string) => boolean;
  setAccent: (hex: string) => boolean;
  resetAccent: () => void;
  resetTheme: () => void;
}

const STORAGE_KEY = "pm-theme-preference-v2";
const DEFAULT_THEME: ThemeState = { theme: "crystal", accent: "#54C8FF", hasCustomAccent: false };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function isHexColor(value: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(value.trim());
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toUpperCase() : null;
}

function hexToRgb(hex: string): string {
  const normalized = normalizeHexColor(hex) ?? DEFAULT_THEME.accent;
  const value = normalized.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

function accentInk(hex: string): string {
  const normalized = normalizeHexColor(hex) ?? DEFAULT_THEME.accent;
  const value = normalized.slice(1);
  const channels = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  return luminance > 0.42 ? "#06131A" : "#F7FCFF";
}

function normalizeThemeId(value: unknown): ThemePreset {
  if (typeof value !== "string") return DEFAULT_THEME.theme;
  const aliasMap: Record<string, ThemePreset> = {
    crystal: "crystal",
    obsidian: "crystal",
    violet: "violet",
    prism: "violet",
    aurora: "aurora",
    ember: "ember",
    emerald: "emerald",
    juniper: "emerald",
    porcelain: "porcelain",
  };
  return aliasMap[value] ?? DEFAULT_THEME.theme;
}

function readStoredTheme(): ThemeState {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacyTheme = normalizeThemeId(window.localStorage.getItem("pm-ui-theme"));
      const legacyAccent = normalizeHexColor(window.localStorage.getItem("pm-ui-custom-accent") || "");
      const presetAccent = THEME_PRESETS.find((item) => item.id === legacyTheme)?.accent ?? DEFAULT_THEME.accent;
      return {
        theme: legacyTheme,
        accent: legacyAccent ?? presetAccent,
        hasCustomAccent: Boolean(legacyAccent && legacyAccent !== presetAccent),
      };
    }
    const parsed = JSON.parse(raw) as { theme?: unknown; preset?: unknown; accent?: unknown; hasCustomAccent?: unknown };
    const theme = normalizeThemeId(parsed.theme ?? parsed.preset);
    const presetAccent = THEME_PRESETS.find((item) => item.id === theme)?.accent ?? DEFAULT_THEME.accent;
    const accent = typeof parsed.accent === "string" ? normalizeHexColor(parsed.accent) : null;
    const resolvedAccent = accent ?? presetAccent;
    const hasCustomAccent = Boolean(parsed.hasCustomAccent) || (resolvedAccent !== presetAccent);
    return { theme, accent: resolvedAccent, hasCustomAccent };
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.pmTheme = state.theme;
    root.classList.toggle("dark", state.theme !== "porcelain");
    root.style.setProperty("--pm-accent", state.accent);
    root.style.setProperty("--pm-accent-rgb", hexToRgb(state.accent));
    root.style.setProperty("--pm-accent-ink", accentInk(state.accent));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.localStorage.setItem("pm-ui-theme", state.theme);
    if (state.hasCustomAccent) {
      window.localStorage.setItem("pm-ui-custom-accent", state.accent);
    } else {
      window.localStorage.removeItem("pm-ui-custom-accent");
    }
  }, [state]);

  const value = useMemo<ThemeContextValue>(() => {
    const selected = THEME_PRESETS.find((preset) => preset.id === state.theme) ?? THEME_PRESETS[0]!;
    const setTheme = (theme: ThemePreset) => {
      const preset = THEME_PRESETS.find((item) => item.id === theme);
      if (!preset) return;
      setState({ theme, accent: preset.accent, hasCustomAccent: false });
    };
    const setCustomAccent = (value: string) => {
      const accent = normalizeHexColor(value);
      if (!accent) return false;
      setState((current) => ({ ...current, accent, hasCustomAccent: true }));
      return true;
    };
    const resetAccent = () => {
      setState((current) => ({
        ...current,
        accent: THEME_PRESETS.find((preset) => preset.id === current.theme)?.accent ?? DEFAULT_THEME.accent,
        hasCustomAccent: false,
      }));
    };
    return {
      theme: state.theme,
      accent: state.accent,
      hasCustomAccent: state.hasCustomAccent,
      preset: state.theme,
      presetName: state.hasCustomAccent ? `${selected.name} · ${state.accent}` : selected.name,
      setTheme,
      setPreset: setTheme,
      setCustomAccent,
      setAccent: setCustomAccent,
      resetAccent,
      resetTheme: () => setState(DEFAULT_THEME),
    };
  }, [state]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
