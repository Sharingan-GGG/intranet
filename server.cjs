// cPanel / Passenger startup file.
// Set this as the "Application startup file" in cPanel's Setup Node.js App.
const path = require('path')

process.chdir(__dirname)
process.env.NODE_ENV = 'production'

// This host has no IPv6 route. Node's default DNS result order can non-deterministically
// return an IPv6 address for the Supabase pooler hostname (it round-robins across many nodes),
// causing ENETUNREACH. Force IPv4 so Postgres connections always resolve to a reachable address.
require('dns').setDefaultResultOrder('ipv4first')

const next = require('next')
const { createServer } = require('http')

const port = parseInt(process.env.PORT || '3000', 10)
const app = next({ dev: false, dir: __dirname })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`Intranet ready on port ${port}`)
  })
})
