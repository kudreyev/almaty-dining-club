'use client'

import { useCallback, useState } from 'react'
import {
  formatKZPhone,
  formatKZPhoneFromDigits,
  isKZNumber,
  normalizeKZPhone,
  normalizeToE164Like,
  sanitizePhoneInput,
} from '@/lib/kz-phone'

export {
  formatKZPhone,
  formatKZPhoneFromDigits,
  isKZNumber,
  normalizeKZPhone,
  normalizeToE164Like,
  sanitizePhoneInput,
} from '@/lib/kz-phone'

export type PhoneInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'inputMode' | 'autoComplete'
> & {
  /** Скрытое поле: отправляется +<digits> или пустая строка */
  name?: string
  /** Контролируемое значение поля (как отображается пользователю) */
  subscriber?: string
  /** Неконтролируемый старт: E.164-like или сырой ввод */
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
  placeholder = 'Например: +77001234567',
  onBlur,
  ...rest
}: PhoneInputProps) {
  const [internal, setInternal] = useState(() => (defaultValue ? sanitizePhoneInput(defaultValue) : ''))

  const controlled = subscriberProp !== undefined
  const subscriber = controlled ? subscriberProp : internal

  const setSubscriber = useCallback(
    (raw: string) => {
      const next = sanitizePhoneInput(raw)
      if (!controlled) setInternal(next)
      onSubscriberChange?.(next)
    },
    [controlled, onSubscriberChange],
  )

  const hiddenValue = normalizeToE164Like(subscriber) ?? ''
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
        inputMode="tel"
        autoComplete="tel"
        className={className}
        value={subscriber}
        readOnly={readOnly}
        disabled={disabled}
        required={Boolean(required && !name)}
        placeholder={placeholder}
        onChange={(e) => {
          if (readOnly || disabled) return
          setSubscriber(e.target.value)
        }}
        onBlur={(e) => {
          if (!readOnly && !disabled) {
            const current = e.target.value
            const normalized = normalizeToE164Like(current)

            let nextValue = sanitizePhoneInput(current)
            if (normalized) {
              nextValue = isKZNumber(normalized)
                ? formatKZPhoneFromDigits(normalized.slice(1))
                : normalized
            } else {
              const digits = current.replace(/\D/g, '')
              if (!current.trim().startsWith('+') && digits.length >= 8) {
                nextValue = `+${digits}`
              }
            }
            setSubscriber(nextValue)
          }
          onBlur?.(e)
        }}
      />
    </>
  )
}
