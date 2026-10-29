'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CITIES, CITY_LABELS, type City } from '@/lib/cities'
import { rememberCity } from '@/lib/city-cookie-client'

/** Один раз после автоопределения города по IP: «Ваш город Алматы? Да / Сменить». */
export function CityHint({ city }: { city: City }) {
  const router = useRouter()
  const [visible, setVisible] = useState(true)
  const [choosing, setChoosing] = useState(false)

  if (!visible) return null

  const confirm = () => {
    rememberCity(city)
    setVisible(false)
  }

  const switchTo = (next: City) => {
    rememberCity(next)
    setVisible(false)
    router.push(`/${next}`)
    router.refresh()
  }

  return (
    <div className="border-t border-gray-100 bg-[#FAECE7]/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-5 py-1.5 text-[13px] text-neutral-700">
        {choosing ? (
          <>
            <span>Выберите город:</span>
            {CITIES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => (option === city ? confirm() : switchTo(option))}
                className="font-medium text-[#D85A30] underline-offset-2 hover:underline"
              >
                {CITY_LABELS[option]}
              </button>
            ))}
          </>
        ) : (
          <>
            <span>Ваш город {CITY_LABELS[city]}?</span>
            <button
              type="button"
              onClick={confirm}
              className="font-medium text-[#D85A30] underline-offset-2 hover:underline"
            >
              Да
            </button>
            <button
              type="button"
              onClick={() => setChoosing(true)}
              className="text-neutral-500 underline-offset-2 hover:underline"
            >
              Сменить
            </button>
          </>
        )}
      </div>
    </div>
  )
}
