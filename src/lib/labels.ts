export function redeemTokenStatusLabel(
  status: 'active' | 'redeemed' | 'expired' | 'cancelled'
) {
  switch (status) {
    case 'active':
      return 'Активен'
    case 'redeemed':
      return 'Использован'
    case 'expired':
      return 'Истёк'
    case 'cancelled':
      return 'Отменён'
  }
}

export function offerTypeLabel(type: '2for1' | 'compliment' | 'kudafest_set') {
  if (type === '2for1') return '1+1'
  if (type === 'compliment') return 'в подарок'
  return 'Сеты Kudafest'
}

/** Витрина: заведение активно или скрыто */
export function listingVisibilityLabel(isActive: boolean): string {
  return isActive ? 'Активно' : 'Скрыто'
}

/** Оффер действует только на вынос */
export function takeawayOnlyLabel(): string {
  return 'Только на вынос'
}

/** Учётная запись PIN персонала */
export function staffPinStatusLabel(isActive: boolean): string {
  return isActive ? 'Активен' : 'Неактивен'
}
