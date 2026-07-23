import React from 'react'

const FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSe5gqLRU1kWAB_7_xqy6WxkCwmfQ5-6wVW6naKhPzClolT9lw/viewform?usp=header'

// TODO: point this at the CTG Organisational Chart (PDF / Drive link)
const ORG_CHART_URL = '#'

const cardStyle: React.CSSProperties = {
  flex: '1 1 300px',
  maxWidth: 620,
  background: '#fff',
  border: '1px solid var(--il-border)',
  borderRadius: 20,
  padding: '30px 34px',
  boxShadow: '0 1px 2px rgba(17,46,129,0.04)',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 800,
  color: 'var(--il-brand)',
  letterSpacing: '-0.01em',
}

const subStyle: React.CSSProperties = {
  fontSize: 13.5,
  color: 'var(--il-text-body)',
  marginTop: 5,
}

const ctaStyle: React.CSSProperties = {
  display: 'inline-block',
  marginTop: 'auto',
  background: 'var(--il-brand)',
  color: '#fff',
  border: 'none',
  borderRadius: 999,
  padding: '11px 30px',
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  textDecoration: 'none',
}

export const Feedback: React.FC = () => (
  <div
    id="support"
    className="il-support"
    style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 14px', scrollMarginTop: 82 }}
  >
    <div
      style={{
        width: 1000,
        maxWidth: '100%',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 20,
        justifyContent: 'center',
      }}
    >
      <div style={cardStyle}>
        <h2 style={headingStyle}>CTG Organisational Chart</h2>
        <div style={subStyle}>See how the Complex Travel Group teams fit together.</div>
        <a
          href={ORG_CHART_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="il-cta il-cta-navy"
          style={{ ...ctaStyle, marginTop: 18 }}
        >
          View
        </a>
      </div>

      <div style={cardStyle}>
        <h2 style={headingStyle}>Provide Feedback</h2>
        <div style={subStyle}>Submit your feedback or ideas for improvement across the organisation. Not limited to Intranet only - think big or think small. We want to hear it.</div>
        <a
          href={FEEDBACK_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="il-cta il-cta-navy"
          style={{ ...ctaStyle, marginTop: 18 }}
        >
          Send
        </a>
      </div>
    </div>
  </div>
)
