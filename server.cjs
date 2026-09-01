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
  // nginx and LiteSpeed in front of this both allow a Cookie header far larger than Node's
  // 16KB default, and a browser that has accumulated stale Supabase/Auth.js cookies can
  // exceed it. Without this, Node becomes the hop that rejects the request with a bare 400
  // before Next.js middleware gets a chance to prune those cookies.
  createServer({ maxHeaderSize: 65536 }, (req, res) => handle(req, res)).listen(port, () => {
    console.log(`Intranet ready on port ${port}`)
  })
})
