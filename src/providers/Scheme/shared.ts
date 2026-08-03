export type SchemeId = 'ocean' | 'midnight'

export const schemeLocalStorageKey = 'il-scheme'

export const defaultScheme: SchemeId = 'ocean'

export type SchemeMeta = {
  id: SchemeId
  label: string
  /** Representative swatch color shown in the toggle popover. */
  dot: string
}

export const SCHEMES: SchemeMeta[] = [
  { id: 'ocean', label: 'Ocean', dot: '#4C8CE4' },
  { id: 'midnight', label: 'Midnight Sun', dot: '#FBBC13' },
]

export const schemeIsValid = (scheme: unknown): scheme is SchemeId =>
  scheme === 'ocean' || scheme === 'midnight'
