/**
 * The dashboard is served two ways:
 *   1. datumlab.xyz/sparklend/*   — via a rewrite in the DatumLabs Next.js
 *      project. The dashboard needs basePath so its own <Link> / router /
 *      static assets emit the "/sparklend" prefix that survives the rewrite.
 *   2. sparklend-dashboard.vercel.app/sparklend/* — the raw Vercel origin,
 *      same URL shape as (1). Direct visits to the bare root 404 by design;
 *      users always reach the dashboard via datumlab.xyz/sparklend.
 *
 * BASE_PATH is set by the NEXT_PUBLIC_BASE_PATH env var on Vercel
 * (production = "/sparklend"). Left empty for local `next dev`, so pages
 * are still served at the root during development.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ""

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH || undefined,
}

module.exports = nextConfig
