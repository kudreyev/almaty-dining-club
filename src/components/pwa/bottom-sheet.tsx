'use client'

import { useEffect, useId, type ReactNode } from 'react'
import { X } from 'lucide-react'

type BottomSheetProps = {
  title: string
  onClose: () => void
  children: ReactNode
  /** Над панелью (например, стрелка к панели Safari снизу). */
  footer?: ReactNode
}

/** Нижняя панель без затемнения фона: не перекрывает страницу и не мешает ей пользоваться. */
export function BottomSheet({ title, onClose, children, footer }: BottomSheetProps) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex justify-center px-2">
      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        className="pointer-events-auto w-full max-w-md rounded-t-2xl border border-b-0 border-neutral-200 bg-white px-5 pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="pt-1 text-[17px] font-semibold tracking-[-0.2px] text-neutral-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>
        {children}
        {footer}
      </section>
    </div>
  )
}

export function SheetActions({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex gap-2">{children}</div>
}

export function SheetPrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props
  return (
    <button
      type="button"
      {...rest}
      className={`flex flex-1 items-center justify-center rounded-xl bg-primary px-4 py-3 text-[15px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60 ${className}`}
    />
  )
}

export function SheetSecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props
  return (
    <button
      type="button"
      {...rest}
      className={`flex flex-1 items-center justify-center rounded-xl bg-neutral-100 px-4 py-3 text-[15px] font-medium text-neutral-800 transition-colors hover:bg-neutral-200 ${className}`}
    />
  )
}
