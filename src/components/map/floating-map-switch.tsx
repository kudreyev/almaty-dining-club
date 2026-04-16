'use client'

import Link from 'next/link'

export function FloatingMapSwitch({
  leftLabel,
  onLeftClick,
  rightLabel,
  rightHref,
}: {
  leftLabel: string
  onLeftClick: () => void
  rightLabel: string
  rightHref: string
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:hidden">
      <div className="pointer-events-auto flex items-center gap-2 rounded-3xl border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onLeftClick}
          className="inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100"
        >
          {leftLabel}
        </button>
        <Link
          href={rightHref}
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black"
        >
          {rightLabel}
        </Link>
      </div>
    </div>
  )
}

