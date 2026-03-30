'use client'

import { useCallback, useState } from 'react'
import {
  formatKZPhone,
  normalizeKZPhone,
  subscriberDigitsFromRaw,
} from '@/lib/kz-phone'

export { formatKZPhone, normalizeKZPhone } from '@/lib/kz-phone'

export type PhoneInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'inputMode' | 'autoComplete'
> & {
  /** Скрытое поле: отправляется уже нормализованное +7XXXXXXXXXX или пустая строка */
  name?: string
  /** Контролируемое значение — только цифры абонента (0–10), без +7 */
  subscriber?: string
  /** Неконтролируемый старт: E.164 или сырой ввод */
  defaultValue?: string
  onSubscriberChange?: (subscriber: string) => void
}

export function PhoneInput({
  id,
  name,
  className = 'w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none',
  subscriber: subscriberProp,
  defaultValue,
  onSubscriberChange,
  readOnly,
  disabled,
  required,
  placeholder = '+7 (700) 123 4567',
  ...rest
}: PhoneInputProps) {
  const [internal, setInternal] = useState(() =>
    defaultValue ? subscriberDigitsFromRaw(defaultValue) : '',
  )

  const controlled = subscriberProp !== undefined
  const subscriber = controlled ? subscriberProp : internal

  const setSubscriber = useCallback(
    (raw: string) => {
      const next = subscriberDigitsFromRaw(raw)
      if (!controlled) setInternal(next)
      onSubscriberChange?.(next)
    },
    [controlled, onSubscriberChange],
  )

  const display = formatKZPhone(subscriber)
  const hiddenValue = normalizeKZPhone(subscriber) ?? ''
  const hiddenRequired = Boolean(name && required)

  return (
    <>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={hiddenValue}
          required={hiddenRequired}
          readOnly
          tabIndex={-1}
          aria-hidden
        />
      ) : null}
      <input
        {...rest}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="tel"
        className={className}
        value={display}
        readOnly={readOnly}
        disabled={disabled}
        required={Boolean(required && !name)}
        placeholder={placeholder}
        onChange={(e) => {
          if (readOnly || disabled) return
          setSubscriber(e.target.value)
        }}
      />
    </>
  )
}
