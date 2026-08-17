import Script from 'next/script'
import React from 'react'

import { defaultTheme, themeLocalStorageKey } from '../ThemeSelector/types'

export const InitTheme: React.FC = () => {
  return (
    <Script
      id="theme-script"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `
  (function () {
    function getImplicitPreference() {
      var mediaQuery = '(prefers-color-scheme: dark)'
      var mql = window.matchMedia(mediaQuery)
      var hasImplicitPreference = typeof mql.matches === 'boolean'

      if (hasImplicitPreference) {
        return mql.matches ? 'dark' : 'light'
      }

      return null
    }

    function themeIsValid(theme) {
      return theme === 'light' || theme === 'dark'
    }

    var themeToSet = '${defaultTheme}'
    var preference = window.localStorage.getItem('${themeLocalStorageKey}')

    if (themeIsValid(preference)) {
      themeToSet = preference
    } else {
      var implicitPreference = getImplicitPreference()

      if (implicitPreference) {
        themeToSet = implicitPreference
      }
    }

    document.documentElement.setAttribute('data-theme', themeToSet)

    // Color scheme (il-scheme) — independent of light/dark data-theme above.
    // Default 'ocean' applies when no valid stored preference exists.
    function schemeIsValid(scheme) {
      return scheme === 'ocean' || scheme === 'midnight'
    }
    var schemePreference = window.localStorage.getItem('il-scheme')
    document.documentElement.setAttribute(
      'data-scheme',
      schemeIsValid(schemePreference) ? schemePreference : 'ocean',
    )
  })();
  `,
      }}
    />
  )
}
