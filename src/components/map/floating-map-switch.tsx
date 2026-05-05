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
      <div
        className="pointer-events-auto flex items-center bg-white/95 backdrop-blur"
        style={{
          gap: '4px',
          padding: '4px',
          borderRadius: '9999px',
          borderWidth: '0.5px',
          borderStyle: 'solid',
          borderColor: 'rgb(229 229 229)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        }}
      >
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onLeftClick}
          className="inline-flex items-center justify-center font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          style={{
            borderRadius: '9999px',
            padding: '8px 18px',
            fontSize: '13px',
          }}
        >
          {leftLabel}
        </button>
        <Link
          href={rightHref}
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center font-medium text-white transition-opacity hover:opacity-95"
          style={{
            background: '#D85A30',
            borderRadius: '9999px',
            padding: '8px 18px',
            fontSize: '13px',
          }}
        >
          {rightLabel}
        </Link>
      </div>
    </div>
  )
}
