import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { SchemeProvider } from './Scheme'
import { ThemeProvider } from './Theme'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <SchemeProvider>
        <HeaderThemeProvider>{children}</HeaderThemeProvider>
      </SchemeProvider>
    </ThemeProvider>
  )
}
