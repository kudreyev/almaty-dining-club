'use client'

import { useState } from 'react'
import {
  BottomSheet,
  SheetActions,
  SheetPrimaryButton,
  SheetSecondaryButton,
} from '@/components/pwa/bottom-sheet'
import { trackPwa } from '@/lib/pwa/analytics'
import { PWA_STORAGE, writeStored } from '@/lib/pwa/install'
import { enablePush } from '@/lib/pwa/push'

export type PushSoftAskTrigger = 'first_launch' | 'code_redeemed' | 'profile_menu'

/** Мягкий экран перед системным запросом: системное окно — только после «Да, сообщать». */
export function PushSoftAsk({
  trigger,
  onClose,
}: {
  trigger: PushSoftAskTrigger
  onClose: (result: 'granted' | 'denied' | 'dismissed' | 'error') => void
}) {
  const [pending, setPending] = useState(false)

  const dismiss = () => {
    trackPwa('push_softask_dismissed', { trigger })
    writeStored(PWA_STORAGE.pushSoftAsk, String(Date.now()))
    onClose('dismissed')
  }

  const accept = async () => {
    trackPwa('push_softask_accepted', { trigger })
    setPending(true)
    const result = await enablePush()
    setPending(false)
    if (result === 'granted') {
      trackPwa('push_permission_granted', { trigger })
      onClose('granted')
    } else if (result === 'denied') {
      trackPwa('push_permission_denied', { trigger })
      onClose('denied')
    } else if (result === 'default') {
      // Закрыли системное окно без ответа — считаем как «Не надо».
      writeStored(PWA_STORAGE.pushSoftAsk, String(Date.now()))
      onClose('dismissed')
    } else {
      onClose('error')
    }
  }

  return (
    <BottomSheet title="Сообщать о новых 1+1 рядом с вами?" onClose={dismiss}>
      <p className="mt-1 text-[14px] leading-[1.45] text-neutral-600">
        Не чаще 2 раз в неделю, только вечером
      </p>
      <SheetActions>
        <SheetSecondaryButton onClick={dismiss}>Не надо</SheetSecondaryButton>
        <SheetPrimaryButton onClick={accept} disabled={pending}>
          Да, сообщать
        </SheetPrimaryButton>
      </SheetActions>
    </BottomSheet>
  )
}
