'use client'

import { Check, Palette } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { useScheme } from '@/providers/Scheme'
import { SCHEMES, defaultScheme } from '@/providers/Scheme/shared'

export const SchemeToggle: React.FC = () => {
  const { scheme, setScheme } = useScheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const active = scheme ?? defaultScheme

  return (
    <div ref={ref} style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Color scheme"
        title="Color scheme"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.14)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(255,255,255,0.25)',
          padding: 0,
          cursor: 'pointer',
          flex: 'none',
        }}
      >
        <Palette size={17} strokeWidth={2.2} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 46,
            right: 0,
            width: 210,
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 16px 40px rgba(17,46,129,0.22)',
            border: '1px solid #E3EBF1',
            overflow: 'hidden',
            zIndex: 50,
          }}
        >
          <div
            style={{
              padding: '11px 14px 7px',
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#8A94A6',
            }}
          >
            Color scheme
          </div>
          {SCHEMES.map((s) => {
            const selected = s.id === active
            return (
              <button
                key={s.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setScheme(s.id)
                  setOpen(false)
                }}
                className="il-doc-row"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '10px 14px',
                  border: 'none',
                  background: 'none',
                  fontSize: 13.5,
                  fontWeight: selected ? 700 : 500,
                  fontFamily: 'inherit',
                  color: '#1B2233',
                  cursor: 'pointer',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    flex: 'none',
                    borderRadius: '50%',
                    background: s.dot,
                    border: '1px solid rgba(0,0,0,0.12)',
                  }}
                />
                <span style={{ flex: 1 }}>{s.label}</span>
                {selected && <Check size={15} strokeWidth={2.6} color="#112E81" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
