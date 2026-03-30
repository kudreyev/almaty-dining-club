'use client'

import { useEffect, useMemo, useState } from 'react'

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}

function validateOfferKey(key: string) {
  const trimmed = key.trim()

  if (trimmed.length < 2) return 'Слишком короткий (минимум 2 символа).'
  if (trimmed.length > 48) return 'Слишком длинный (максимум 48 символов).'
  if (!/^[a-z0-9_]+$/.test(trimmed)) return 'Только латиница a-z, цифры 0-9 и _.'
  if (/__+/.test(trimmed)) return 'Не используйте подряд несколько _.'
  if (trimmed.startsWith('_') || trimmed.endsWith('_')) return 'Не начинайте и не заканчивайте на _.'

  return null
}

export function OfferKeyField(props: {
  defaultKey?: string
  defaultTitle?: string
  nameKey?: string
  nameTitle?: string
}) {
  const {
    defaultKey = '',
    defaultTitle = '',
    nameKey = 'offer_key',
    nameTitle = 'offer_title',
  } = props

  const [title, setTitle] = useState(defaultTitle)
  const [key, setKey] = useState(defaultKey)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!key && title) setKey(slugify(title))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  const error = useMemo(() => validateOfferKey(key), [key])
  const showError = touched && !!error

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Название предложения
        </label>
        <input
          name={nameTitle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: 1+1 на пасту"
          required
          className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Ключ оффера (уникален в заведении)
        </label>

        <div className="flex gap-3">
          <input
            name={nameKey}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Например: pasta_2for1"
            required
            className={`w-full rounded-2xl border px-4 py-3 text-sm font-mono outline-none ${
              showError ? 'border-red-300' : 'border-gray-300'
            }`}
            aria-invalid={showError}
          />

          <button
            type="button"
            onClick={() => {
              setKey(slugify(title))
              setTouched(true)
            }}
            className="shrink-0 rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-black"
          >
            Сгенерировать
          </button>
        </div>

        {showError ? (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        ) : (
          <p className="mt-2 text-xs text-gray-500">
            Разрешено: <span className="font-mono">a-z</span>, <span className="font-mono">0-9</span>, <span className="font-mono">_</span>.
            Пример: <span className="font-mono">dessert_compliment</span>
          </p>
        )}

        {/* скрытое поле, чтобы подсказать форме "не отправляй", если key невалиден */}
        <input type="hidden" name="offer_key_valid" value={error ? '0' : '1'} />
      </div>
    </div>
  )
}