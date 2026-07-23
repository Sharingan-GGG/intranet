import React from 'react'

import { defaultTheme, themeLocalStorageKey } from '../ThemeSelector/types'

export const InitTheme: React.FC = () => {
  // React 19 warns about any <script> in a component's render output, even one
  // that only ever renders server-side. Returning null on the client keeps the
  // script out of client reconciliation entirely — it still ships in the
  // server HTML and executes before hydration.
  if (typeof window !== 'undefined') {
    return null
  }

  return (
    <script
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
      return scheme === 'default' || scheme === 'ocean' || scheme === 'midnight'
    }
    var schemePreference = window.localStorage.getItem('il-scheme')
    document.documentElement.setAttribute(
      'data-scheme',
      schemeIsValid(schemePreference) ? schemePreference : 'ocean',
    )
  })();
  `,
      }}
      id="theme-script"
    />
  )
}
