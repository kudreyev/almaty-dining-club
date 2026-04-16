'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { parseFiltersFromSearchParams, serializeFiltersToSearchParams, type RestaurantFilters } from '@/lib/restaurant-filters'

export function useUrlRestaurantFilters(): {
  filters: RestaurantFilters
  setFilters: (next: RestaurantFilters) => void
  buildHrefWithSameFilters: (pathname: string) => string
} {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filters = useMemo(() => {
    return parseFiltersFromSearchParams(new URLSearchParams(searchParams.toString()))
  }, [searchParams])

  const setFilters = (next: RestaurantFilters) => {
    const nextSp = serializeFiltersToSearchParams(next, new URLSearchParams(searchParams.toString()))
    const qs = nextSp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const buildHrefWithSameFilters = (targetPath: string) => {
    const qs = new URLSearchParams(searchParams.toString()).toString()
    return qs ? `${targetPath}?${qs}` : targetPath
  }

  return { filters, setFilters, buildHrefWithSameFilters }
}

