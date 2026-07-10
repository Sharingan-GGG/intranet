'use client'

import React, { useState } from 'react'

const CATEGORIES = ['Idea', 'Issue', 'Praise'] as const

export const Feedback: React.FC = () => {
  const [rating, setRating] = useState(0)
  const [cat, setCat] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  // Honeypot — real users leave this empty.
  const [company, setCompany] = useState('')

  const submit = () => {
    if (company) return // bot caught
    if (!rating && !message.trim()) {
      setError('Add a rating or a message before sending.')
      return
    }
    setError('')
    // TODO: POST to the `feedback` collection once modelled in Payload.
    setSent(true)
  }

  return (
    <div id="support" style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 14px', scrollMarginTop: 82 }}>
      <div
        style={{
          width: 620,
          maxWidth: '100%',
          background: '#fff',
          border: '1px solid #E3EBF1',
          borderRadius: 20,
          padding: '30px 34px',
          boxShadow: '0 1px 2px rgba(17,46,129,0.04)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, color: '#112E81', letterSpacing: '-0.01em' }}>Feedback</div>
        <div style={{ fontSize: 13.5, color: '#5A6478', marginTop: 5 }}>
          Spotted something broken, or have an idea for the intranet? Tell us.
        </div>

        {!sent ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '18px 0 14px' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  aria-pressed={rating === n}
                  onClick={() => setRating(n)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2 }}
                >
                  <svg width="27" height="27" viewBox="0 0 24 24">
                    <path
                      d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95z"
                      fill={n <= rating ? '#F2B93E' : '#EDF1F6'}
                      stroke={n <= rating ? '#E0A428' : '#C8D2DE'}
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 14 }}>
              {CATEGORIES.map((name) => {
                const active = cat === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setCat(active ? '' : name)}
                    style={{
                      border: `1px solid ${active ? '#4647AE' : '#DDE6EE'}`,
                      background: active ? '#4647AE' : '#fff',
                      color: active ? '#fff' : '#5A6478',
                      fontSize: 12.5,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      padding: '6px 14px',
                      borderRadius: 999,
                      cursor: 'pointer',
                    }}
                  >
                    {name}
                  </button>
                )
              })}
            </div>

            {/* Honeypot: visually hidden, off-screen. */}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
              aria-hidden
            />

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message…"
              rows={3}
              className="il-input"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid #DDE6EE',
                borderRadius: 13,
                background: '#F7FAFC',
                padding: '12px 14px',
                fontSize: 13.5,
                fontFamily: 'inherit',
                color: '#1B2233',
                resize: 'vertical',
                outline: 'none',
              }}
            />

            {error && <div style={{ fontSize: 12.5, color: '#B4443C', marginTop: 10 }}>{error}</div>}

            <button
              type="button"
              onClick={submit}
              className="il-cta il-cta-navy"
              style={{
                marginTop: 14,
                background: '#112E81',
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                padding: '11px 30px',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Send feedback
            </button>
          </>
        ) : (
          <div style={{ margin: '22px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#E7F3EC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#1F8A5B" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1B2233' }}>Thanks — your feedback is on its way.</div>
            <div style={{ fontSize: 13, color: '#5A6478' }}>The intranet team reads every submission.</div>
          </div>
        )}
      </div>
    </div>
  )
}
