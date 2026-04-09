'use client'

import { useState, useEffect, useMemo } from 'react'

const MOBILE_BREAKPOINT = 640 // sm
const MOBILE_ITEMS_PER_PAGE = 8
const DESKTOP_ITEMS_PER_PAGE = 15

export function useMobileList<T>(
  items: T[],
  options?: {
    searchTerm?: string
    filterFn?: (item: T, term: string) => boolean
    mobilePerPage?: number
    desktopPerPage?: number
    breakpoint?: number
  }
) {
  const [isMobile, setIsMobile] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const mobilePerPage = options?.mobilePerPage ?? MOBILE_ITEMS_PER_PAGE
  const desktopPerPage = options?.desktopPerPage ?? DESKTOP_ITEMS_PER_PAGE
  const breakpoint = options?.breakpoint ?? MOBILE_BREAKPOINT
  const searchTerm = options?.searchTerm ?? ''
  const filterFn = options?.filterFn

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  // Filtrar por búsqueda
  const filteredItems = useMemo(() => {
    if (!filterFn || !searchTerm.trim()) return items
    const term = searchTerm.toLowerCase().trim()
    return items.filter((item) => filterFn(item, term))
  }, [items, searchTerm, filterFn])

  const itemsPerPage = isMobile ? mobilePerPage : desktopPerPage
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = filteredItems.slice(startIndex, endIndex)

  // Reset page cuando cambian filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  return {
    isMobile,
    paginatedItems,
    filteredItems,
    currentPage,
    setCurrentPage,
    totalPages,
    itemsPerPage,
    startIndex: startIndex + 1,
    endIndex: Math.min(endIndex, filteredItems.length),
    totalFiltered: filteredItems.length,
    shouldShowPagination: filteredItems.length > itemsPerPage,
  }
}
