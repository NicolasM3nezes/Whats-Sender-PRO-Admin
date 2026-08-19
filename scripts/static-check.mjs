import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const src = path.join(root, 'src')
const files = []

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const stat = fs.statSync(p)
    if (stat.isDirectory()) walk(p)
    else if (/\.(jsx|js)$/.test(name)) files.push(p)
  }
}
walk(src)

const missing = []
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8')
  const importRe = /from\s+['"](\.\.?\/[^'"]+)['"]/g
  for (const match of code.matchAll(importRe)) {
    const base = path.resolve(path.dirname(file), match[1])
    const candidates = [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js'), path.join(base, 'index.jsx')]
    if (!candidates.some(p => fs.existsSync(p))) missing.push(`${path.relative(root, file)} -> ${match[1]}`)
  }
}

const required = ['index.html','package.json','vite.config.js','vercel.json','src/main.jsx','src/App.jsx','src/lib/supabase.js']
for (const f of required) if (!fs.existsSync(path.join(root, f))) missing.push(`arquivo obrigatório: ${f}`)

if (missing.length) {
  console.error('Falhas encontradas:')
  missing.forEach(x => console.error('-', x))
  process.exit(1)
}
console.log(`OK: ${files.length} arquivos JS/JSX verificados e imports locais resolvidos.`)
