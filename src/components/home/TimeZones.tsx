'use client'

import React, { useEffect, useState } from 'react'

import type { OfficeZone } from '@/lib/home'

type ZoneView = { city: string; time: string; date: string; hourDeg: number; minDeg: number }

const computeZones = (offices: OfficeZone[], now: Date): ZoneView[] =>
  offices.map((c) => {
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: c.tz,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now)
    const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10)
    const hh = get('hour') % 24
    const mm = get('minute')
    const time = new Intl.DateTimeFormat('en-AU', { timeZone: c.tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(now)
    const date = new Intl.DateTimeFormat('en-AU', { timeZone: c.tz, weekday: 'short', day: 'numeric', month: 'short' }).format(now)
    return { city: c.city, time, date, hourDeg: ((hh % 12) + mm / 60) * 30, minDeg: mm * 6 }
  })

export const TimeZones: React.FC<{ offices: OfficeZone[] }> = ({ offices }) => {
  const [zones, setZones] = useState<ZoneView[] | null>(null)

  useEffect(() => {
    const tick = () => setZones(computeZones(offices, new Date()))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [offices])

  return (
    <div
      id="offices"
      style={{
        background: 'linear-gradient(120deg,#112E81,#4647AE 70%,#4382DF)',
        borderRadius: 20,
        padding: '22px 30px',
        display: 'flex',
        alignItems: 'center',
        gap: 26,
      }}
    >
      <div style={{ flex: 'none', width: 150 }}>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 800, lineHeight: 1.25 }}>Time in our offices</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, marginTop: 4 }}>Live · updates every second</div>
      </div>
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(offices.length, 4) || 4},1fr)`,
          gap: 14,
        }}
      >
        {(zones ?? offices.map((o) => ({ city: o.city, time: '', date: '', hourDeg: 0, minDeg: 0 }))).map((z) => (
          <div
            key={z.city}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: 'rgba(255,255,255,0.11)',
              border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: 15,
              padding: '13px 16px',
            }}
          >
            <svg width="52" height="52" viewBox="0 0 64 64" style={{ flex: 'none' }} aria-hidden>
              <circle cx="32" cy="32" r="29" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
              <circle cx="32" cy="7.5" r="1.6" fill="#fff" />
              <circle cx="32" cy="56.5" r="1.6" fill="#fff" />
              <circle cx="7.5" cy="32" r="1.6" fill="#fff" />
              <circle cx="56.5" cy="32" r="1.6" fill="#fff" />
              <line
                x1="32"
                y1="32"
                x2="32"
                y2="19"
                stroke="#fff"
                strokeWidth="3.4"
                strokeLinecap="round"
                transform={`rotate(${z.hourDeg} 32 32)`}
              />
              <line
                x1="32"
                y1="32"
                x2="32"
                y2="12.5"
                stroke="#AACCD6"
                strokeWidth="2.2"
                strokeLinecap="round"
                transform={`rotate(${z.minDeg} 32 32)`}
              />
              <circle cx="32" cy="32" r="2.4" fill="#fff" />
            </svg>
            <div>
              <div
                style={{
                  color: 'rgba(255,255,255,0.72)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {z.city}
              </div>
              <div
                style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}
                suppressHydrationWarning
              >
                {z.time || '—'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11.5 }} suppressHydrationWarning>
                {z.date || ' '}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
