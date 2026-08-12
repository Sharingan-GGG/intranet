import React from 'react'

type FeedbackCard = {
  title: string
  description?: string | null
  buttonLabel: string
  buttonUrl: string
}

// Falls back to the original copy for any 'feedback' block saved before these fields
// existed — Payload doesn't backfill group defaults into already-stored block data.
const DEFAULT_ORG_CHART: FeedbackCard = {
  title: 'CTG Organisational Chart',
  description: 'See how the Complex Travel Group teams fit together.',
  buttonLabel: 'View',
  buttonUrl: '#',
}

const DEFAULT_FEEDBACK_FORM: FeedbackCard = {
  title: 'Provide Feedback',
  description:
    'Submit your feedback or ideas for improvement across the organisation. Not limited to Intranet only - think big or think small. We want to hear it.',
  buttonLabel: 'Send',
  buttonUrl:
    'https://docs.google.com/forms/d/e/1FAIpQLSe5gqLRU1kWAB_7_xqy6WxkCwmfQ5-6wVW6naKhPzClolT9lw/viewform?usp=header',
}

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

const FeedbackCardView: React.FC<{ card: FeedbackCard }> = ({ card }) => (
  <div style={cardStyle}>
    <h2 style={headingStyle}>{card.title}</h2>
    {card.description && <div style={subStyle}>{card.description}</div>}
    <a
      href={card.buttonUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="il-cta il-cta-navy"
      style={{ ...ctaStyle, marginTop: 18 }}
    >
      {card.buttonLabel}
    </a>
  </div>
)

export const Feedback: React.FC<{
  orgChart?: FeedbackCard | null
  feedbackForm?: FeedbackCard | null
}> = ({ orgChart, feedbackForm }) => (
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
      <FeedbackCardView card={orgChart ?? DEFAULT_ORG_CHART} />
      <FeedbackCardView card={feedbackForm ?? DEFAULT_FEEDBACK_FORM} />
    </div>
  </div>
)
