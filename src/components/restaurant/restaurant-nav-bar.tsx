'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { ChevronLeft, Share2 } from 'lucide-react'

type RestaurantNavBarProps = {
  shareTitle: string
  shareText: string
  backHref?: string
}

export function RestaurantNavBar({
  shareTitle,
  shareText,
  backHref = '/',
}: RestaurantNavBarProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    if (typeof window === 'undefined') return
    const shareUrl = window.location.href
    const shareData = { title: shareTitle, text: shareText, url: shareUrl }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        /* user cancelled or unsupported */
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard failed */
    }
  }, [shareTitle, shareText])

  return (
    <div
      className="sticky top-0 z-10 border-b border-neutral-200/70 bg-white/95 backdrop-blur"
      style={{ borderBottomWidth: '0.5px' }}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-600 transition-colors hover:text-neutral-900"
        >
          <ChevronLeft size={12} />
          <span>Все заведения</span>
        </Link>

        <button
          type="button"
          onClick={handleShare}
          aria-label="Поделиться"
          className="relative inline-flex items-center gap-1.5 text-xs text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <Share2 size={12} />
          <span>Поделиться</span>
          {copied ? (
            <span className="absolute -bottom-7 right-0 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium text-white">
              Скопировано
            </span>
          ) : null}
        </button>
      </div>
    </div>
  )
}
