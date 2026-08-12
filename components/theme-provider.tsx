/**
 * Theme provider + hook.
 *
 * Syncs the active theme between localStorage and `<html data-theme>`, and
 * exposes `useThemeColors()` — a Recharts-friendly object mirroring the live
 * CSS variables so charts re-render on theme toggle. Default: dark. Persisted
 * under `sparklend-theme`.
 */
"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

export type Theme = "light" | "dark"

export const THEME_STORAGE_KEY = "sparklend-theme"

interface ThemeContextValue {
  theme: Theme
  setTheme: (next: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readActiveTheme(): Theme {
  if (typeof document === "undefined") return "dark"
  const attr = document.documentElement.getAttribute("data-theme")
  return attr === "light" ? "light" : "dark"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readActiveTheme())

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", next)
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        // localStorage disabled — DOM + in-memory still flip.
      }
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark")
  }, [theme, setTheme])

  useEffect(() => {
    const active = readActiveTheme()
    if (active !== theme) setThemeState(active)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (ctx) return ctx
  return {
    theme: "dark",
    setTheme: () => {},
    toggleTheme: () => {},
  }
}

const DARK_FALLBACK = {
  background: "#0B0D0F",
  cardBg: "#111318",
  cardBorder: "rgba(255, 255, 255, 0.08)",
  textPrimary: "#E0E0E0",
  textSecondary: "#A0A4AB",
  textMuted: "#6B7280",
  accent: "#FF6B35",
  accentSecondary: "#B44AFF",
  success: "#10B981",
  danger: "#FF4444",
  warning: "#F59E0B",
}

const LIGHT_FALLBACK = {
  background: "#F5F7FA",
  cardBg: "#FFFFFF",
  cardBorder: "rgba(0, 0, 0, 0.08)",
  textPrimary: "#1A1E24",
  textSecondary: "#4B5563",
  textMuted: "#6B7280",
  accent: "#E55A1F",
  accentSecondary: "#9333EA",
  success: "#059669",
  danger: "#DC2626",
  warning: "#D97706",
}

type ThemeColors = typeof DARK_FALLBACK

function readLiveColors(theme: Theme): ThemeColors {
  if (typeof window === "undefined") {
    return theme === "light" ? LIGHT_FALLBACK : DARK_FALLBACK
  }
  const style = window.getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => {
    const v = style.getPropertyValue(name).trim()
    return v.length > 0 ? v : fallback
  }
  const fb = theme === "light" ? LIGHT_FALLBACK : DARK_FALLBACK
  return {
    background: read("--background", fb.background),
    cardBg: read("--card-bg", fb.cardBg),
    cardBorder: read("--card-border", fb.cardBorder),
    textPrimary: read("--text-primary", fb.textPrimary),
    textSecondary: read("--text-secondary", fb.textSecondary),
    textMuted: read("--text-muted", fb.textMuted),
    accent: read("--accent", fb.accent),
    accentSecondary: read("--accent-secondary", fb.accentSecondary),
    success: read("--success", fb.success),
    danger: read("--danger", fb.danger),
    warning: read("--warning", fb.warning),
  }
}

export function useThemeColors(): ThemeColors {
  const { theme } = useTheme()
  const [colors, setColors] = useState<ThemeColors>(() =>
    theme === "light" ? LIGHT_FALLBACK : DARK_FALLBACK,
  )

  useEffect(() => {
    const update = () => setColors(readLiveColors(theme))
    update()
    if (typeof document === "undefined") return
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    })
    return () => observer.disconnect()
  }, [theme])

  return colors
}
