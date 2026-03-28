import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const rootDir = process.cwd()
const bundleName = `pw-studio-${process.platform}-${process.arch}`
const releaseDir = path.join(rootDir, 'release')
const bundleDir = path.join(releaseDir, bundleName)
const nodeBinaryName = process.platform === 'win32' ? 'node.exe' : 'node'

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function copyIfExists(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return
  }

  fs.cpSync(sourcePath, targetPath, { recursive: true })
}

function run(command, cwd = rootDir) {
  execSync(command, {
    cwd,
    stdio: 'inherit',
    shell: true,
  })
}

fs.rmSync(bundleDir, { recursive: true, force: true })
fs.mkdirSync(bundleDir, { recursive: true })

copyIfExists(path.join(rootDir, 'dist'), path.join(bundleDir, 'dist'))
copyIfExists(path.join(rootDir, 'README.md'), path.join(bundleDir, 'README.md'))
copyIfExists(path.join(rootDir, 'ARCHITECTURE.md'), path.join(bundleDir, 'ARCHITECTURE.md'))
copyIfExists(path.join(rootDir, 'CONTRIBUTING.md'), path.join(bundleDir, 'CONTRIBUTING.md'))

const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'))
delete packageJson.devDependencies
packageJson.scripts = {
  start: 'node dist/server/index.js',
}

writeFile(path.join(bundleDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`)
copyIfExists(path.join(rootDir, 'package-lock.json'), path.join(bundleDir, 'package-lock.json'))

run('npm install --omit=dev', bundleDir)

const bundledNodePath = path.join(bundleDir, 'bin', nodeBinaryName)
fs.mkdirSync(path.dirname(bundledNodePath), { recursive: true })
fs.copyFileSync(process.execPath, bundledNodePath)

writeFile(
  path.join(bundleDir, 'start.cmd'),
  '@echo off\r\ncd /d "%~dp0"\r\n"%~dp0bin\\node.exe" "%~dp0dist\\server\\index.js"\r\n'
)

writeFile(
  path.join(bundleDir, 'start.sh'),
  '#!/usr/bin/env sh\nDIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"\ncd "$DIR"\n"$DIR/bin/node" "$DIR/dist/server/index.js"\n'
)

if (process.platform !== 'win32') {
  fs.chmodSync(path.join(bundleDir, 'start.sh'), 0o755)
  fs.chmodSync(bundledNodePath, 0o755)
}

run(`npx bestzip "release/${bundleName}.zip" "release/${bundleName}/*"`)

console.log(`[pw-studio] runtime bundle created at release/${bundleName}.zip`)
