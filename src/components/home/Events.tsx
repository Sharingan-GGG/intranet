import React from 'react'

import { tagStyle, type EventGroup } from '@/lib/home'
import { LocalTime } from '@/components/shared/LocalTime'

const MAX_ITEMS = 6

/** Trim groups so the widget shows at most `MAX_ITEMS` events in total. */
const topItems = (groups: EventGroup[]): EventGroup[] => {
  const visible: EventGroup[] = []
  let count = 0
  for (const g of groups) {
    if (count >= MAX_ITEMS) break
    const items = g.items.slice(0, MAX_ITEMS - count)
    visible.push({ ...g, items })
    count += items.length
  }
  return visible
}

export const Events: React.FC<{ groups: EventGroup[]; heading?: string }> = ({
  groups: allGroups,
  heading = 'Upcoming events',
}) => {
  const groups = topItems(allGroups)
  return (
  <div
    id="calendar"
    className="il-events"
    style={{
      background: '#fff',
      border: '1px solid #E3EBF1',
      borderRadius: 20,
      padding: 24,
      boxShadow: '0 1px 2px rgba(17,46,129,0.04)',
      scrollMarginTop: 82,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#112E81', letterSpacing: '-0.01em' }}>{heading}</h2>
      <a href="/calendar" style={{ fontSize: 13, fontWeight: 700, color: '#4382DF' }}>
        View all
      </a>
    </div>

    {groups.length === 0 ? (
      <div style={{ padding: 24, textAlign: 'center', fontSize: 13.5, color: '#5A6478' }}>No upcoming events.</div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groups.map((g) => (
          <div key={`${g.day}-${g.mon}`} style={{ display: 'flex', gap: 14 }}>
            <a
              href={g.dateISO ? `/calendar?date=${g.dateISO.slice(0, 10)}` : '/calendar'}
              title="View this day on the calendar"
              style={{
                flex: 'none',
                width: 48,
                height: 52,
                borderRadius: 12,
                background: '#EFF4FB',
                border: '1px solid #DCE7F5',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 800, color: '#112E81', lineHeight: 1 }}>{g.day}</span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#4647AE',
                  marginTop: 2,
                }}
              >
                {g.mon}
              </span>
            </a>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 2 }}>
              {g.items.map((ev, i) => {
                const [tagBg, tagFg] = tagStyle(ev.tag)
                return (
                  <div key={i} style={{ borderBottom: '1px solid #EEF3F8', paddingBottom: 9 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <a
                        href={g.dateISO ? `/calendar?date=${g.dateISO.slice(0, 10)}` : '/calendar'}
                        style={{ fontSize: 14, fontWeight: 700, color: '#1B2233', textDecoration: 'none' }}
                      >
                        {ev.title}
                      </a>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: tagFg,
                          background: tagBg,
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}
                      >
                        {ev.tag}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: '#5A6478', marginTop: 3 }}>
                      <LocalTime iso={ev.timeISO} fallback={ev.time} /> · {ev.loc}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
  )
}
