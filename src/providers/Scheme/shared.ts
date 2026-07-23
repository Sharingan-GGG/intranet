export type SchemeId = 'default' | 'ocean' | 'midnight'

export const schemeLocalStorageKey = 'il-scheme'

export const defaultScheme: SchemeId = 'ocean'

export type SchemeMeta = {
  id: SchemeId
  label: string
  /** Representative swatch color shown in the toggle popover. */
  dot: string
}

export const SCHEMES: SchemeMeta[] = [
  { id: 'default', label: 'Avatar', dot: '#112E81' },
  { id: 'ocean', label: 'Ocean', dot: '#4C8CE4' },
  { id: 'midnight', label: 'Midnight Gold', dot: '#FBBC13' },
]

export const schemeIsValid = (scheme: unknown): scheme is SchemeId =>
  scheme === 'default' || scheme === 'ocean' || scheme === 'midnight'
