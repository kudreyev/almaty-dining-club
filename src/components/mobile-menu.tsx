'use client'

import { useState } from 'react'
import Link from 'next/link'

type NavLink = { href: string; label: string }

export function MobileMenu({
  navLinks,
  adminLinks,
  isLoggedIn,
}: {
  navLinks: NavLink[]
  adminLinks: NavLink[]
  isLoggedIn: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-black"
        aria-label="Меню"
      >
        {open ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
          </svg>
        )}
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-14 z-50 border-b border-gray-200 bg-white px-5 py-4 shadow-lg">
          <nav className="flex flex-col gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {l.label}
              </Link>
            ))}
            {adminLinks.length > 0 ? (
              <>
                <div className="my-2 h-px bg-gray-100" />
                <p className="px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Админ</p>
                {adminLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    {l.label}
                  </Link>
                ))}
              </>
            ) : null}
            {!isLoggedIn ? (
              <>
                <div className="my-2 h-px bg-gray-100" />
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-black px-3 py-2.5 text-center text-sm font-medium text-white"
                >
                  Войти
                </Link>
              </>
            ) : null}
          </nav>
        </div>
      ) : null}
    </div>
  )
}
