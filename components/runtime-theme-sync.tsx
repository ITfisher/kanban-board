"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { useAppSettings } from "@/hooks/use-app-settings"

export function RuntimeThemeSync() {
  const { settings } = useAppSettings()
  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme(settings.darkMode ? "dark" : "light")
  }, [settings.darkMode, setTheme])

  return null
}
