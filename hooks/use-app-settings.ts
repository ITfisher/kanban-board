"use client"

import { useEffect, useState } from "react"
import { DEFAULT_SETTINGS } from "@/lib/default-settings"
import type { SettingsData } from "@/lib/types"

export function useAppSettings() {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadSettings = async () => {
      try {
        const response = await fetch("/api/settings")
        if (!response.ok) {
          throw new Error("Failed to load settings")
        }

        const data: SettingsData = await response.json()
        if (!cancelled) {
          setSettings({ ...DEFAULT_SETTINGS, ...data })
        }
      } catch {
        if (!cancelled) {
          setSettings(DEFAULT_SETTINGS)
        }
      } finally {
        if (!cancelled) {
          setLoaded(true)
        }
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [])

  return { settings, setSettings, loaded }
}
