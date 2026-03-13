'use client'

import { useEffect, useState } from 'react'

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
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

  // если key пустой, подсказываем его из title (но не перезаписываем вручную заданный)
  useEffect(() => {
    if (!key && title) setKey(slugify(title))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          offer_title
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
          offer_key (уникально в ресторане)
        </label>

        <div className="flex gap-3">
          <input
            name={nameKey}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Например: pasta_2for1"
            required
            className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm font-mono outline-none"
          />

          <button
            type="button"
            onClick={() => setKey(slugify(title))}
            className="shrink-0 rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-black"
          >
            Сгенерировать
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Совет: используй стабильный key (например <span className="font-mono">pasta_2for1</span> или{' '}
          <span className="font-mono">dessert_compliment</span>), чтобы CSV upsert обновлял нужный оффер.
        </p>
      </div>
    </div>
  )
}