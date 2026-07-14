import React from 'react'

import '../(frontend)/globals.css'

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  // globals.css hides <html> until data-theme is set (anti-FOUC);
  // the scene has its own day/night handling
  return (
    <html data-theme="light" lang="en">
      <head>
        <link href="/ctg-icon.png" rel="icon" type="image/png" sizes="100x100" />
        <link href="/ctg-icon.ico" rel="icon" sizes="any" />
      </head>
      <body>{children}</body>
    </html>
  )
}
