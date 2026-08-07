'use client'

import { X } from 'lucide-react'

/** Упрощённая пиктограмма iOS «Поделиться» (квадрат + стрелка вверх). */
function IosShareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 3v11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8.5 6.5 12 3l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 11v7.5A2.5 2.5 0 0 0 8.5 21h7a2.5 2.5 0 0 0 2.5-2.5V11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function HomeScreenIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 8v8M8 12h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

type PwaIosGuideSheetProps = {
  open: boolean
  onClose: () => void
}

export function PwaIosGuideSheet({ open, onClose }: PwaIosGuideSheetProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-ios-guide-title"
        className="relative z-[121] w-full max-w-md rounded-t-2xl bg-white px-5 pb-8 pt-5 shadow-2xl sm:rounded-2xl sm:pb-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2
            id="pwa-ios-guide-title"
            className="text-[17px] font-semibold tracking-[-0.2px] text-neutral-900"
          >
            Как добавить на экран «Домой»
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        <ol className="space-y-4">
          <li className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800">
              <IosShareIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[14px] font-medium text-neutral-900">
                1. Нажмите «Поделиться»
              </p>
              <p className="mt-0.5 text-[13px] leading-[1.45] text-neutral-500">
                Иконка внизу Safari (квадрат со стрелкой вверх).
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800">
              <HomeScreenIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[14px] font-medium text-neutral-900">
                2. «На экран „Домой“»
              </p>
              <p className="mt-0.5 text-[13px] leading-[1.45] text-neutral-500">
                Пролистайте меню и выберите этот пункт, затем «Добавить».
              </p>
            </div>
          </li>
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-[15px] font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Понятно
        </button>
      </div>
    </div>
  )
}
