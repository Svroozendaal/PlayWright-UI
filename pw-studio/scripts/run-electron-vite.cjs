const { spawn } = require('node:child_process')
const path = require('node:path')

const cliPath = path.join(__dirname, '..', 'node_modules', 'electron-vite', 'bin', 'electron-vite.js')
const args = process.argv.slice(2)
const env = { ...process.env }

if (env.ELECTRON_RUN_AS_NODE) {
  delete env.ELECTRON_RUN_AS_NODE
  process.stderr.write('PW Studio: cleared ELECTRON_RUN_AS_NODE before launching electron-vite.\n')
}

const child = spawn(process.execPath, [cliPath, ...args], {
  cwd: path.join(__dirname, '..'),
  env,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
