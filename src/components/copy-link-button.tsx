'use client'

import { useEffect, useState } from 'react'

export function CopyLinkButton({
  textToCopy,
  className,
}: {
  textToCopy: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(id)
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
    } catch {
      // Буфер обмена может быть недоступен в части окружений.
    }
  }

  return (
    <button type="button" onClick={handleCopy} className={className} disabled={copied}>
      {copied ? 'Скопировано' : 'Копировать ссылку'}
    </button>
  )
}

