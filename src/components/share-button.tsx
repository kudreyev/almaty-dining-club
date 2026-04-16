'use client'

import { useCallback, useState } from 'react'

type ShareButtonProps = {
  title: string
  text?: string
  url?: string
}

export function ShareButton({ title, text, url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    const shareUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '')
    const shareData = { title, text: text ?? title, url: shareUrl }

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
  }, [title, text, url])

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="Поделиться"
      className="group relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-all duration-150 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 active:scale-95"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-[18px] w-[18px]"
        aria-hidden="true"
      >
        <path
          d="M21 3L14.5 21l-3.22-8.28L3 9.5 21 3z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21 3l-9.72 9.72"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {copied ? (
        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white">
          Скопировано
        </span>
      ) : null}
    </button>
  )
}
