'use client'

import { useEffect, useState } from 'react'

export function FormSubmitGuard() {
  const [formEl, setFormEl] = useState<HTMLFormElement | null>(null)

  useEffect(() => {
    // ищем ближайшую форму
    const el = document.querySelector('form')
    if (el && el instanceof HTMLFormElement) setFormEl(el)
  }, [])

  useEffect(() => {
    if (!formEl) return

    const handler = (e: Event) => {
      const valid = formEl.querySelector<HTMLInputElement>('input[name="offer_key_valid"]')?.value
      if (valid === '0') {
        e.preventDefault()
        e.stopPropagation()
        alert('Исправьте ключ оффера перед сохранением.')
      }
    }

    formEl.addEventListener('submit', handler)
    return () => formEl.removeEventListener('submit', handler)
  }, [formEl])

  return null
}