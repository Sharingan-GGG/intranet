'use client'

import React, { createContext, useCallback, use, useEffect, useState } from 'react'

import canUseDOM from '@/utilities/canUseDOM'
import { defaultScheme, schemeIsValid, schemeLocalStorageKey, type SchemeId } from './shared'

type SchemeContextType = {
  scheme: SchemeId | undefined
  setScheme: (scheme: SchemeId) => void
}

const initialContext: SchemeContextType = {
  scheme: undefined,
  setScheme: () => null,
}

const SchemeContext = createContext(initialContext)

export const SchemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [scheme, setSchemeState] = useState<SchemeId | undefined>(
    canUseDOM
      ? ((document.documentElement.getAttribute('data-scheme') as SchemeId) ?? undefined)
      : undefined,
  )

  const setScheme = useCallback((schemeToSet: SchemeId) => {
    setSchemeState(schemeToSet)
    window.localStorage.setItem(schemeLocalStorageKey, schemeToSet)
    document.documentElement.setAttribute('data-scheme', schemeToSet)
  }, [])

  useEffect(() => {
    const preference = window.localStorage.getItem(schemeLocalStorageKey)
    const schemeToSet = schemeIsValid(preference) ? preference : defaultScheme

    document.documentElement.setAttribute('data-scheme', schemeToSet)
    setSchemeState(schemeToSet)
  }, [])

  return <SchemeContext value={{ scheme, setScheme }}>{children}</SchemeContext>
}

export const useScheme = (): SchemeContextType => use(SchemeContext)
