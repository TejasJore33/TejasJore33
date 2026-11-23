// Fetches the public contribution calendar and merges it into data/contributions.json,
// keeping the higher count per day (so private counts from the local snapshot are kept).
// Needs GITHUB_TOKEN (provided automatically in GitHub Actions).
import fs from 'node:fs'

const USER = process.env.GH_USER || 'TejasJore33'
const FILE = new URL('../data/contributions.json', import.meta.url)
const token = process.env.GITHUB_TOKEN
if (!token) throw new Error('GITHUB_TOKEN is required')

const query = `query($login:String!){ user(login:$login){ contributionsCollection { contributionCalendar {
  weeks { contributionDays { date contributionCount contributionLevel } } } } } }`
const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-art' },
  body: JSON.stringify({ query, variables: { login: USER } }),
})
const json = await res.json()
if (!res.ok || json.errors) throw new Error('GraphQL error: ' + JSON.stringify(json.errors || json))
const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 }
const fresh = json.data.user.contributionsCollection.contributionCalendar.weeks
  .flatMap((w) => w.contributionDays)
  .map((d) => ({ date: d.date, count: d.contributionCount, level: LEVEL[d.contributionLevel] ?? 0 }))

const old = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { days: [] }
const byDate = new Map(old.days.map((d) => [d.date, d]))
for (const d of fresh) {
  const prev = byDate.get(d.date)
  if (!prev || d.count > prev.count) byDate.set(d.date, d)
}
// keep the same window GitHub shows (the fresh calendar's dates)
const days = fresh.map((d) => byDate.get(d.date))
// recompute levels on the merged data (quartiles of non-zero days, like GitHub)
const counts = days.map((d) => d.count).filter((c) => c > 0).sort((a, b) => a - b)
const q = (p) => counts[Math.min(counts.length - 1, Math.floor(p * counts.length))] ?? 1
const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)]
for (const d of days) d.level = d.count === 0 ? 0 : d.count <= q1 ? 1 : d.count <= q2 ? 2 : d.count <= q3 ? 3 : 4
const total = days.reduce((s, d) => s + d.count, 0)
fs.writeFileSync(FILE, JSON.stringify({ total, updated: new Date().toISOString().slice(0, 10), days }) + '\n')
console.log(`merged ${days.length} days → ${total} contributions`)
