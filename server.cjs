// cPanel / Passenger startup file.
// Set this as the "Application startup file" in cPanel's Setup Node.js App.
const path = require('path')

process.chdir(__dirname)
process.env.NODE_ENV = 'production'

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
