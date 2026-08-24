import React from 'react'

type FeedbackCard = {
  title: string
  description?: string | null
  buttonLabel: string
  buttonUrl: string
}

// Falls back to the original two cards for any 'feedback' block saved before
// the array field existed — Payload doesn't backfill old group data into it.
const DEFAULT_CARDS: FeedbackCard[] = [
  {
    title: 'CTG Organisational Chart',
    description: 'See how the Complex Travel Group teams fit together.',
    buttonLabel: 'View',
    buttonUrl: '#',
  },
  {
    title: 'Provide Feedback',
    description:
      'Submit your feedback or ideas for improvement across the organisation. Not limited to Intranet only - think big or think small. We want to hear it.',
    buttonLabel: 'Send',
    buttonUrl:
      'https://docs.google.com/forms/d/e/1FAIpQLSe5gqLRU1kWAB_7_xqy6WxkCwmfQ5-6wVW6naKhPzClolT9lw/viewform?usp=header',
  },
]

const cardStyle: React.CSSProperties = {
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

export const Feedback: React.FC<{ cards?: FeedbackCard[] | null }> = ({ cards }) => {
  const items = cards?.length ? cards : DEFAULT_CARDS

  return (
    <div
      id="support"
      className="il-support"
      style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 14px', scrollMarginTop: 82 }}
    >
      <div
        className="il-feedback-grid"
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 420px))',
          justifyContent: 'center',
          gap: 20,
        }}
      >
        {items.map((card, idx) => (
          <FeedbackCardView key={`${card.title}-${idx}`} card={card} />
        ))}
      </div>
    </div>
  )
}
