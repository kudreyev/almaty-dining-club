'use client'

// src/lib/auth/use-user.tsx
// Клиентский контекст текущего пользователя для CTA-компонентов.
// Один раз запрашивает /api/me/subscription и раздаёт статус всем SubscribeCTA
// на странице (в шапке, на pricing, на карточке заведения и т.п.).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

export type CurrentUser = {
  id: string
  phone: string
  subscriptionStatus: 'active' | null
}

type UserContextValue = {
  user: CurrentUser | null
  loading: boolean
  refresh: () => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/me/subscription', { cache: 'no-store' })
      if (!res.ok) {
        setUser(null)
        return
      }
      const data = (await res.json()) as { user: CurrentUser | null }
      setUser(data.user ?? null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <UserContext.Provider value={{ user, loading, refresh }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) {
    // Безопасный дефолт, если провайдер почему-то не смонтирован.
    return { user: null, loading: false, refresh: async () => {} }
  }
  return ctx
}
