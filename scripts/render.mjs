// Renders the animated profile SVGs into assets/ from data/*.json and data/ascii.txt.
//   node scripts/render.mjs
import fs from 'node:fs'

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const write = (p, s) => fs.writeFileSync(new URL(`../${p}`, import.meta.url), s)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const profile = JSON.parse(read('data/profile.json'))
const contrib = JSON.parse(read('data/contributions.json'))
const PROMPT = `${profile.user}@${profile.host}`

const C = {
  bg1: '#0b1219', bg2: '#070b10', border: '#10b981', title: '#7d8590', text: '#c9d1d9', dim: '#7d8590',
  green: '#34d399', cyan: '#22d3ee', amber: '#fbbf24',
  cells: ['#0f1d18', '#0e4429', '#006d32', '#26a641', '#39d353'],
}
const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/** Terminal window chrome shared by all cards. */
function frame(w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg2}"/></linearGradient>
  <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.green}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient>
</defs>
<rect width="${w}" height="${h}" rx="12" fill="url(#bg)"/>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="12" fill="none" stroke="${C.border}" stroke-opacity="0.45"/>
<line x1="0" y1="32" x2="${w}" y2="32" stroke="${C.border}" stroke-opacity="0.3"/>
<circle cx="20" cy="16" r="5.5" fill="#ff5f56"/><circle cx="38" cy="16" r="5.5" fill="#ffbd2e"/><circle cx="56" cy="16" r="5.5" fill="#27c93f"/>
<text x="${w / 2}" y="20.5" fill="${C.title}" font-size="12" text-anchor="middle">${esc(title)}</text>
${body}
</svg>
`
}

/** Fade + slide-in wrapper with a start delay (SMIL, plays inside GitHub's <img>). */
const appear = (delay, inner) =>
  `<g opacity="0" transform="translate(0,6)">${inner}<animate attributeName="opacity" from="0" to="1" begin="${delay.toFixed(2)}s" dur="0.45s" fill="freeze"/><animateTransform attributeName="transform" type="translate" from="0 6" to="0 0" begin="${delay.toFixed(2)}s" dur="0.45s" fill="freeze"/></g>`

/* ---------------- contributions graph ---------------- */
function renderContrib() {
  const days = contrib.days
  const W = 860, CELL = 12, GAP = 3, STEP = CELL + GAP
  const firstDow = new Date(days[0].date + 'T00:00:00Z').getUTCDay()
  const weeks = Math.ceil((firstDow + days.length) / 7)
  const gridW = weeks * STEP - GAP
  const x0 = Math.round((W - gridW) / 2), y0 = 76
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  let cells = '', months = '', lastMonth = -1
  days.forEach((d, i) => {
    const idx = firstDow + i, col = Math.floor(idx / 7), row = idx % 7
    const x = x0 + col * STEP, y = y0 + row * STEP
    const m = new Date(d.date + 'T00:00:00Z').getUTCMonth()
    if (row === 0 || i === 0) {
      if (m !== lastMonth && col < weeks - 1) {
        months += `<text x="${x}" y="${y0 - 10}" fill="${C.dim}" font-size="10">${MONTHS[m]}</text>`
        lastMonth = m
      }
    }
    const delay = 0.25 + col * 0.028 + row * 0.012
    const stroke = d.level === 0 ? ` stroke="#16302a" stroke-width="1"` : ''
    cells += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2.5" fill="${C.cells[d.level]}"${stroke} opacity="0"><title>${d.count} on ${d.date}</title><animate attributeName="opacity" from="0" to="1" begin="${delay.toFixed(3)}s" dur="0.3s" fill="freeze"/></rect>`
  })

  // stats from real data
  let longest = 0, run = 0
  for (const d of days) { run = d.count > 0 ? run + 1 : 0; longest = Math.max(longest, run) }
  let current = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) current++
    else if (i === days.length - 1) continue // today may not have activity yet
    else break
  }
  const best = days.reduce((a, d) => (d.count > a.count ? d : a), days[0])
  const total = days.reduce((s, d) => s + d.count, 0)
  const active = days.filter((d) => d.count > 0).length

  const gridBottom = y0 + 7 * STEP - GAP
  const sep = gridBottom + 24
  const sweep = `<rect x="-120" y="${y0 - 4}" width="120" height="${7 * STEP + 4}" fill="url(#sweep)" opacity="0.55"><animate attributeName="x" from="-120" to="${W}" begin="2.6s" dur="3.2s" repeatCount="indefinite"/></rect>`
  const body = `
<defs><linearGradient id="sweep" x1="0" x2="1"><stop offset="0" stop-color="${C.green}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.green}" stop-opacity="0.18"/><stop offset="1" stop-color="${C.green}" stop-opacity="0"/></linearGradient></defs>
${months}
${cells}
${sweep}
<line x1="0" y1="${sep}" x2="${W}" y2="${sep}" stroke="${C.border}" stroke-opacity="0.25"/>
${appear(1.8, `<text x="${x0}" y="${sep + 30}" fill="${C.dim}" font-size="14"><tspan fill="${C.green}" font-weight="700">${total.toLocaleString('en-IN')}</tspan> contributions in the last year · <tspan fill="${C.cyan}" font-weight="700">${active}</tspan> active days</text>`)}
${appear(2.0, `<text x="${x0}" y="${sep + 56}" fill="${C.dim}" font-size="14">current streak <tspan fill="${C.cyan}" font-weight="700">${current} day${current === 1 ? '' : 's'}</tspan> · longest <tspan fill="${C.cyan}" font-weight="700">${longest} days</tspan></text>`)}
${appear(1.9, `<text x="${W - x0}" y="${sep + 30}" fill="${C.dim}" font-size="14" text-anchor="end">${days[0].date} → ${days[days.length - 1].date}</text>`)}
${appear(2.1, `<text x="${W - x0}" y="${sep + 56}" fill="${C.dim}" font-size="14" text-anchor="end">best day <tspan fill="${C.amber}" font-weight="700">${best.count}</tspan> on ${best.date}</text>`)}`
  write('assets/contrib.svg', frame(W, sep + 78, `${PROMPT}: ~/contributions --graph`, body))
}

/* ---------------- ASCII monogram ---------------- */
function renderAscii() {
  const lines = read('data/ascii.txt').replace(/\r/g, '').split('\n').filter((l, i, a) => i < a.length - 1 || l)
  const W = 600, H = 660, FS = 17, LH = 21, CW = FS * 0.602
  const cols = Math.max(...lines.map((l) => l.length))
  const x = Math.round((W - cols * CW) / 2), y0 = Math.round(32 + (H - 32 - 70 - lines.length * LH) / 2) + FS
  let rows = ''
  lines.forEach((l, i) => {
    const width = Math.ceil(l.length * CW) + 4
    const d = 0.3 + i * 0.07
    rows += `<clipPath id="r${i}"><rect x="${x - 2}" y="${y0 + i * LH - FS}" width="0" height="${LH}"><animate attributeName="width" from="0" to="${width}" begin="${d.toFixed(2)}s" dur="0.35s" fill="freeze"/></rect></clipPath><text x="${x}" y="${y0 + i * LH}" font-size="${FS}" fill="url(#ascii)" clip-path="url(#r${i})" xml:space="preserve">${esc(l)}</text>`
  })
  const end = 0.3 + lines.length * 0.07 + 0.4
  const body = `
<defs><linearGradient id="ascii" gradientUnits="userSpaceOnUse" x1="0" y1="${y0}" x2="${W}" y2="${y0 + lines.length * LH}"><stop offset="0" stop-color="${C.green}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient></defs>
${rows}
<line x1="16" y1="${H - 46}" x2="${W - 16}" y2="${H - 46}" stroke="${C.border}" stroke-opacity="0.25"/>
${appear(end, `<text x="24" y="${H - 20}" font-size="13" fill="${C.dim}">${esc(PROMPT)}:~$ whoami <tspan fill="${C.text}" font-weight="700">Tejas Jore</tspan><tspan fill="${C.green}"> — freelance dev, Pune</tspan></text><rect x="${24 + 51 * 7.83}" y="${H - 31}" width="8" height="15" fill="${C.green}"><animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/></rect>`)}`
  write('assets/ascii.svg', frame(W, H, `${PROMPT}: ~$ ./portrait.sh`, body))
}

/* ---------------- neofetch card ---------------- */
function renderNeofetch() {
  const W = 600, H = 660, LX = 34, VX = 140, LH = 21
  let y = 74, n = 0, out = ''
  const d = () => 0.15 + n++ * 0.07
  out += appear(d(), `<text x="${LX}" y="${y}" font-size="22" font-weight="700"><tspan fill="${C.green}">${esc(profile.user)}</tspan><tspan fill="${C.dim}">@</tspan><tspan fill="${C.cyan}">${esc(profile.host)}</tspan></text><line x1="${LX + 150}" y1="${y - 7}" x2="${W - 34}" y2="${y - 7}" stroke="${C.border}" stroke-opacity="0.6"/>`)
  y += 32
  const row = (k, v) => { out += appear(d(), `<text x="${LX}" y="${y}" font-size="13.5"><tspan fill="${C.amber}" font-weight="700">${esc(k)}</tspan></text><text x="${VX}" y="${y}" font-size="13.5" fill="${C.text}">${esc(v)}</text>`); y += LH }
  const head = (t) => { y += 10; out += appear(d(), `<text x="${LX}" y="${y}" font-size="13.5" font-weight="700" fill="${C.cyan}">— ${esc(t)}</text><line x1="${LX + 18 + t.length * 8.2}" y1="${y - 5}" x2="${W - 34}" y2="${y - 5}" stroke="${C.cyan}" stroke-opacity="0.25"/>`); y += LH + 2 }
  profile.about.forEach(([k, v]) => row(k, v))
  head('Stack')
  profile.stack.forEach(([k, v]) => row(k, v))
  head('Highlights')
  profile.highlights.forEach((h) => { out += appear(d(), `<circle cx="${LX + 4}" cy="${y - 4.5}" r="3" fill="${C.green}"/><text x="${LX + 16}" y="${y}" font-size="13.5" fill="${C.text}">${esc(h)}</text>`); y += LH })
  head('Contact')
  profile.contact.forEach(([k, v]) => row(k, v))
  y += 8
  const palette = ['#0e4429', '#006d32', '#26a641', '#39d353', '#22d3ee', '#0ea5e9', '#fbbf24', '#f472b6']
  out += appear(d(), palette.map((c, i) => `<rect x="${LX + i * 30}" y="${y}" width="24" height="14" rx="2" fill="${c}"/>`).join(''))
  write('assets/neofetch.svg', frame(W, Math.max(H, y + 40), `${PROMPT}: ~$ neofetch`, out))
}

fs.mkdirSync(new URL('../assets/', import.meta.url), { recursive: true })
renderContrib()
renderAscii()
renderNeofetch()
console.log('rendered assets/contrib.svg, assets/ascii.svg, assets/neofetch.svg')
