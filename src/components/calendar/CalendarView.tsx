'use client'

import { useSearchParams } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { tagStyle, type CalendarEvent, type EventTag } from '@/lib/home'
import { LocalTime } from '@/components/shared/LocalTime'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Parse a "YYYY-MM-DD" key into a local Date, or null. */
const parseKey = (s: string | null): Date | null => {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** All cells (including leading/trailing days) for a Monday-first month grid. */
const monthCells = (month: Date): Date[] => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const lead = (first.getDay() + 6) % 7 // days shown from the previous month
  const start = new Date(first)
  start.setDate(first.getDate() - lead)

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const weeks = Math.ceil((lead + daysInMonth) / 7)

  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

const fullDateFmt = new Intl.DateTimeFormat('en-AU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const navBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: '1px solid var(--il-border)',
  background: '#fff',
  color: 'var(--il-brand)',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

export const CalendarView: React.FC<{ events: CalendarEvent[] }> = ({ events }) => {
  const searchParams = useSearchParams()
  const initialSelected = useMemo(() => parseKey(searchParams.get('date')), [searchParams])

  const [selected, setSelected] = useState<string | null>(
    initialSelected ? dateKey(initialSelected) : null,
  )
  const [month, setMonth] = useState(() => {
    const base = initialSelected ?? new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  // Category tab filter. Empty set = show all; otherwise only the active tags.
  const tags = useMemo(() => Array.from(new Set(events.map((e) => e.tag))).sort(), [events])
  const [activeTags, setActiveTags] = useState<Set<EventTag>>(new Set())
  const toggleTag = (tag: EventTag) =>
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  const isTagOn = (tag: EventTag) => activeTags.size === 0 || activeTags.has(tag)

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of events) {
      if (activeTags.size && !activeTags.has(ev.tag)) continue
      const key = dateKey(new Date(ev.dateISO))
      const list = map.get(key)
      if (list) list.push(ev)
      else map.set(key, [ev])
    }
    return map
  }, [events, activeTags])

  const cells = useMemo(() => monthCells(month), [month])
  const todayKey = dateKey(new Date())
  const monthLabel = new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' }).format(month)

  const shiftMonth = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))

  const selectedDate = parseKey(selected)
  const selectedEvents = selected ? (eventsByDay.get(selected) ?? []) : []

  return (
    <div
      className="il-calendar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: 'calc(100dvh - 160px)',
      }}
    >
      {/* Toolbar */}
      <div className="il-calendar-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--il-brand)', letterSpacing: '-0.01em', margin: 0 }}>
          {monthLabel}
        </h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button aria-label="Previous month" onClick={() => shiftMonth(-1)} style={navBtn}>
            ‹
          </button>
          <button aria-label="Next month" onClick={() => shiftMonth(1)} style={navBtn}>
            ›
          </button>
          <button
            onClick={() => {
              const now = new Date()
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
              setSelected(dateKey(now))
            }}
            style={{ ...navBtn, width: 'auto', padding: '0 14px', fontSize: 13 }}
          >
            Today
          </button>
        </div>
        <div className="il-tabs" style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
          {tags.map((tag) => {
            const [bg, fg] = tagStyle(tag)
            const on = isTagOn(tag)
            const picked = activeTags.has(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={picked}
                title={`Filter by ${tag}`}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  fontFamily: 'inherit',
                  color: fg,
                  background: bg,
                  padding: '3px 10px',
                  borderRadius: 999,
                  border: picked ? `1px solid ${fg}` : '1px solid var(--il-border)',
                  cursor: 'pointer',
                  opacity: on ? 1 : 0.4,
                  transition: 'opacity 150ms ease, border-color 150ms ease',
                }}
              >
                {tag}
              </button>
            )
          })}
          {activeTags.size > 0 && (
            <button
              type="button"
              onClick={() => setActiveTags(new Set())}
              title="Clear filters"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                fontFamily: 'inherit',
                color: 'var(--il-text-body)',
                background: 'transparent',
                padding: '3px 10px',
                borderRadius: 999,
                border: '1px solid var(--il-border)',
                cursor: 'pointer',
              }}
            >
              All
            </button>
          )}
        </div>
      </div>

      {/* Calendar grid + selected-day panel */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flex: 1, flexWrap: 'wrap' }}>
        <div
          className="il-cal-scroll"
          style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {/* Weekday header */}
          <div className="il-cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--il-text-body)',
                  textAlign: 'center',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Month grid */}
          <div
            className="il-cal-grid"
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gridAutoRows: 'minmax(104px, 1fr)',
              gap: 8,
            }}
          >
            {cells.map((d) => {
              const key = dateKey(d)
              const inMonth = d.getMonth() === month.getMonth()
              const isToday = key === todayKey
              const isSelected = key === selected
              const dayEvents = eventsByDay.get(key) ?? []

              return (
                <div
                  key={key}
                  onClick={() => setSelected(key)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelected(key)
                    }
                  }}
                  style={{
                    background: isSelected ? '#EEF4FF' : inMonth ? '#fff' : '#F7FAFC',
                    border: isSelected
                      ? '2px solid #2D57D3'
                      : isToday
                        ? '1.5px solid #9CC0F0'
                        : '1px solid var(--il-border)',
                    borderRadius: 14,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: isSelected
                      ? '0 4px 12px rgba(45,87,211,0.16)'
                      : inMonth
                        ? '0 1px 2px rgba(17,46,129,0.04)'
                        : 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      lineHeight: 1,
                      color: isToday ? '#fff' : inMonth ? 'var(--il-brand)' : '#A5B0C2',
                      background: isToday ? 'var(--il-accent)' : 'transparent',
                      borderRadius: 999,
                      padding: isToday ? '4px 8px' : '4px 0',
                      alignSelf: 'flex-start',
                    }}
                  >
                    {d.getDate()}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
                    {dayEvents.map((ev, i) => {
                      const [bg, fg] = tagStyle(ev.tag)
                      return (
                        <div
                          key={i}
                          title={`${ev.title}\n${ev.time} · ${ev.loc}${ev.description ? `\n${ev.description}` : ''}`}
                          style={{
                            display: 'block',
                            background: bg,
                            color: fg,
                            borderRadius: 8,
                            padding: '4px 7px',
                            fontSize: 11.5,
                            fontWeight: 700,
                            lineHeight: 1.25,
                          }}
                        >
                          <div
                            style={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {ev.title}
                          </div>
                          <div style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.85 }}>
                            <LocalTime iso={ev.timeISO} fallback={ev.time} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Selected-day panel */}
        <aside
          style={{
            flex: '0 0 320px',
            maxWidth: '100%',
            background: '#fff',
            border: '1px solid var(--il-border)',
            borderRadius: 16,
            padding: 20,
            boxShadow: '0 1px 2px rgba(17,46,129,0.04)',
            alignSelf: 'flex-start',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--il-brand)', letterSpacing: '-0.01em' }}>
            {selectedDate ? fullDateFmt.format(selectedDate) : 'Select a date'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--il-text-body)', marginTop: 3 }}>
            {selectedDate
              ? `${selectedEvents.length} event${selectedEvents.length === 1 ? '' : 's'}`
              : 'Click any day to see its events.'}
          </div>

          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedDate && selectedEvents.length === 0 && (
              <div style={{ fontSize: 13.5, color: 'var(--il-text-muted)', padding: '8px 0' }}>
                No events scheduled for this day.
              </div>
            )}
            {selectedEvents.map((ev, i) => {
              const [bg, fg] = tagStyle(ev.tag)
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid #EDF1F7',
                  }}
                >
                  <span
                    style={{
                      alignSelf: 'flex-start',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: fg,
                      background: bg,
                      padding: '2px 9px',
                      borderRadius: 999,
                    }}
                  >
                    {ev.tag}
                  </span>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--il-text)', lineHeight: 1.3 }}>
                    {ev.title}
                  </span>
                  <span style={{ fontSize: 12.5, color: 'var(--il-text-body)' }}>
                    <LocalTime iso={ev.timeISO} fallback={ev.time} /> · {ev.loc}
                  </span>
                  {ev.description && (
                    <span style={{ fontSize: 13, color: '#3A4658', lineHeight: 1.55, marginTop: 2, whiteSpace: 'pre-wrap' }}>
                      {ev.description}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </aside>
      </div>
    </div>
  )
}
