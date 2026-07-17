'use client'

import React, { useEffect, useState } from 'react'

const chip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  background: '#EFF5FC',
  border: '1px solid #D6E4F7',
  borderRadius: 999,
  padding: '6px 13px',
  fontSize: 12.5,
  fontWeight: 600,
  color: '#112E81',
}

type Props = {
  userName?: string
}

/** WMO weather codes → short labels (Open-Meteo `weather_code`). */
const WEATHER_LABELS: [codes: number[], label: string][] = [
  [[0], 'sunny'],
  [[1, 2], 'partly cloudy'],
  [[3], 'cloudy'],
  [[45, 48], 'foggy'],
  [[51, 53, 55, 56, 57], 'drizzle'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'rainy'],
  [[71, 73, 75, 77, 85, 86], 'snowy'],
  [[95, 96, 99], 'stormy'],
]

const weatherLabel = (code: number): string =>
  WEATHER_LABELS.find(([codes]) => codes.includes(code))?.[1] ?? ''

// Adelaide HQ — used when the browser denies or lacks geolocation.
const FALLBACK = { lat: -34.9285, lon: 138.6007, city: 'Adelaide' }

async function fetchWeather(lat: number, lon: number, city: string | null): Promise<string> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`,
  )
  if (!res.ok) throw new Error(`weather ${res.status}`)
  const data = await res.json()
  const temp = Math.round(data.current.temperature_2m)
  const label = weatherLabel(data.current.weather_code)
  const parts = [`${temp}°${label ? ` and ${label}` : ''}`]
  if (city) parts.push(city)
  return parts.join(' · ')
}

async function cityFromCoords(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.city || data.locality || null
  } catch {
    return null
  }
}

export const GreetingBar: React.FC<Props> = ({ userName }) => {
  const [greeting, setGreeting] = useState('Good morning')
  const [dateLine, setDateLine] = useState('')
  const [weatherLine, setWeatherLine] = useState<string | null>(null)

  useEffect(() => {
    const now = new Date()
    const h = now.getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    setDateLine(now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async (lat: number, lon: number, knownCity: string | null) => {
      const city = knownCity ?? (await cityFromCoords(lat, lon))
      try {
        const line = await fetchWeather(lat, lon, city)
        if (!cancelled) setWeatherLine(line)
      } catch {
        /* leave the chip hidden if weather is unreachable */
      }
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => void load(pos.coords.latitude, pos.coords.longitude, null),
        () => void load(FALLBACK.lat, FALLBACK.lon, FALLBACK.city),
        { timeout: 5000, maximumAge: 30 * 60 * 1000 },
      )
    } else {
      void load(FALLBACK.lat, FALLBACK.lon, FALLBACK.city)
    }

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      className="il-greeting"
      style={{
        background: '#fff',
        border: '1px solid #E3EBF1',
        borderRadius: 16,
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: '0 1px 2px rgba(17,46,129,0.04)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ fontSize: 21, fontWeight: 800, color: '#112E81', letterSpacing: '-0.01em' }} suppressHydrationWarning>
        {greeting}
        {userName ? `, ${userName}` : ''}
      </div>
      {weatherLine && (
        <span style={{ ...chip, gap: 7 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4.5" stroke="#E4A93C" strokeWidth="2" />
            <path
              d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"
              stroke="#E4A93C"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {weatherLine}
        </span>
      )}
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 13, color: '#5A6478', fontWeight: 600 }} suppressHydrationWarning>
        {dateLine}
      </div>
    </div>
  )
}
