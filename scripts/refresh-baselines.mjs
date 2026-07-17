// Copy the current on-disk ephemeral caches into the git-committed baseline
// snapshots that get bundled into the Vercel serverless functions.
//
// Run from the sparklend-dashboard root:
//   node scripts/refresh-baselines.mjs
//
// You typically want to run this after letting `npm run dev` sit for a while
// so the scanners fully populate the .*-cache.json files, then commit the
// updated data/*.json alongside your other changes.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const MAP = [
  [".wallet-positions-cache.json", "data/wallet-positions-baseline.json"],
  [".wallet-users-cache.json", "data/wallet-users-baseline.json"],
  [".distribution-rewards-cache.json", "data/distribution-rewards-baseline.json"],
]

mkdirSync(join(ROOT, "data"), { recursive: true })

for (const [src, dst] of MAP) {
  const srcPath = join(ROOT, src)
  const dstPath = join(ROOT, dst)
  if (!existsSync(srcPath)) {
    console.warn(`skip ${src} — not present. Run the app first to populate it.`)
    continue
  }
  const bytes = readFileSync(srcPath)
  writeFileSync(dstPath, bytes)
  console.log(`refreshed ${dst} (${(bytes.length / 1024).toFixed(1)} KB)`)
}
