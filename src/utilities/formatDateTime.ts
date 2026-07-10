export const formatDateTime = (timestamp: string): string =>
  new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    timestamp ? new Date(timestamp) : new Date(),
  )
