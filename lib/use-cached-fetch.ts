"use client"

import { useState, useEffect, useRef } from "react"

// Global in-memory cache shared across all components
const cache = new Map<string, { data: any; timestamp: number }>()
const inflight = new Map<string, Promise<any>>()

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes client-side

/**
 * Auto-prefix same-origin URLs with the deploy's basePath. Callers write
 * `/api/x` (the natural in-app path); when running under a basePath rewrite
 * (production is under datumlab.xyz/sparklend), we prefix it so the fetch
 * hits `/sparklend/api/x` and the rewrite proxies it correctly.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ""
const withBasePath = (url: string) =>
  url.startsWith("/") && !url.startsWith(BASE_PATH + "/") ? BASE_PATH + url : url

/** Prefetch a URL into the cache without needing a React hook */
export function prefetchData(url: string) {
  const key = withBasePath(url)
  if (inflight.has(key)) return
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < DEFAULT_TTL) return

  const promise = fetch(key)
    .then((r) => {
      if (!r.ok) throw new Error(`${r.status}`)
      return r.json()
    })
    .then((result) => {
      cache.set(key, { data: result, timestamp: Date.now() })
      inflight.delete(key)
      return result
    })
    .catch((err) => {
      inflight.delete(key)
      throw err
    })
  inflight.set(key, promise)
}

export function useCachedFetch<T = any>(
  url: string,
  options?: { ttl?: number; enabled?: boolean }
): { data: T | null; loading: boolean; error: string | null } {
  const ttl = options?.ttl ?? DEFAULT_TTL
  const enabled = options?.enabled ?? true
  const key = withBasePath(url)
  const [data, setData] = useState<T | null>(() => {
    const cached = cache.get(key)
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data
    }
    return null
  })
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    // Check cache first
    const cached = cache.get(key)
    if (cached && Date.now() - cached.timestamp < ttl) {
      setData(cached.data)
      setLoading(false)
      return
    }

    // Deduplicate inflight requests
    let promise = inflight.get(key)
    if (!promise) {
      promise = fetch(key)
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`)
          return r.json()
        })
        .then((result) => {
          cache.set(key, { data: result, timestamp: Date.now() })
          inflight.delete(key)
          return result
        })
        .catch((err) => {
          inflight.delete(key)
          throw err
        })
      inflight.set(key, promise)
    }

    setLoading(true)
    promise
      .then((result) => {
        if (mountedRef.current) {
          setData(result)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (mountedRef.current) {
          setError(err.message)
          setLoading(false)
        }
      })
  }, [key, ttl, enabled])

  return { data, loading, error }
}
