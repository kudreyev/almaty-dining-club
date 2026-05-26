'use client'

import { useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { redeemTokenByCode } from '@/app/staff/redeem/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type SubmitButtonProps = {
  label: string
  pendingLabel: string
}

function SubmitButton({ label, pendingLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  )
}

type StaffRedeemConfirmFormProps = {
  tokenFromUrl: string
  tokenUrlIssue: 'none' | 'not_found' | 'wrong_restaurant'
}

export function StaffRedeemConfirmForm({
  tokenFromUrl,
  tokenUrlIssue,
}: StaffRedeemConfirmFormProps) {
  const submitStartedRef = useRef(false)

  function guardDoubleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (submitStartedRef.current) {
      event.preventDefault()
      return
    }
    submitStartedRef.current = true
  }

  if (tokenFromUrl && tokenUrlIssue === 'none') {
    return (
      <form
        action={redeemTokenByCode}
        className="mt-6 space-y-4"
        onSubmit={guardDoubleSubmit}
      >
        <input type="hidden" name="tokenCode" value={tokenFromUrl} />
        <p className="text-center text-2xl font-semibold tracking-[0.15em]">
          {tokenFromUrl}
        </p>
        <p className="text-center text-xs text-gray-500">
          Нажмите, когда гость предъявил этот код.
        </p>
        <SubmitButton label="Подтвердить" pendingLabel="Подтверждаю…" />
      </form>
    )
  }

  return (
    <form
      action={redeemTokenByCode}
      className="mt-6 space-y-4"
      onSubmit={guardDoubleSubmit}
    >
      <Input
        id="tokenCode"
        name="tokenCode"
        type="text"
        label="Код гостя"
        required
        defaultValue={tokenUrlIssue !== 'none' ? '' : tokenFromUrl}
        placeholder="Например: 482193"
        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-center text-sm tracking-[0.2em] outline-none transition-colors focus:border-accent"
        data-ym-disable-keys
      />
      <SubmitButton label="Подтвердить код" pendingLabel="Подтверждаю…" />
    </form>
  )
}
