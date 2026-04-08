"use client"

import { useState, useEffect, useRef } from "react"

// Global in-memory cache shared across all components
const cache = new Map<string, { data: any; timestamp: number }>()
const inflight = new Map<string, Promise<any>>()

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes client-side

/** Prefetch a URL into the cache without needing a React hook */
export function prefetchData(url: string) {
  if (inflight.has(url)) return
  const cached = cache.get(url)
  if (cached && Date.now() - cached.timestamp < DEFAULT_TTL) return

  const promise = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`${r.status}`)
      return r.json()
    })
    .then((result) => {
      cache.set(url, { data: result, timestamp: Date.now() })
      inflight.delete(url)
      return result
    })
    .catch((err) => {
      inflight.delete(url)
      throw err
    })
  inflight.set(url, promise)
}

export function useCachedFetch<T = any>(
  url: string,
  options?: { ttl?: number; enabled?: boolean }
): { data: T | null; loading: boolean; error: string | null } {
  const ttl = options?.ttl ?? DEFAULT_TTL
  const enabled = options?.enabled ?? true
  const [data, setData] = useState<T | null>(() => {
    const cached = cache.get(url)
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
    const cached = cache.get(url)
    if (cached && Date.now() - cached.timestamp < ttl) {
      setData(cached.data)
      setLoading(false)
      return
    }

    // Deduplicate inflight requests
    let promise = inflight.get(url)
    if (!promise) {
      promise = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`)
          return r.json()
        })
        .then((result) => {
          cache.set(url, { data: result, timestamp: Date.now() })
          inflight.delete(url)
          return result
        })
        .catch((err) => {
          inflight.delete(url)
          throw err
        })
      inflight.set(url, promise)
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
  }, [url, ttl, enabled])

  return { data, loading, error }
}
