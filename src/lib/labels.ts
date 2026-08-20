export function paymentStatusLabel(status: 'pending' | 'approved' | 'rejected') {
    switch (status) {
      case 'pending':
        return 'На проверке'
      case 'approved':
        return 'Подтверждено'
      case 'rejected':
        return 'Отклонено'
    }
  }
  
  export function subscriptionStatusLabel(
    status: 'inactive' | 'pending_payment' | 'active' | 'cancelled' | 'expired'
  ) {
    switch (status) {
      case 'inactive':
        return 'Не активна'
      case 'pending_payment':
        return 'Ожидает оплату'
      case 'active':
        return 'Активна'
      case 'cancelled':
        return 'Отменена'
      case 'expired':
        return 'Истекла'
    }
  }
  
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

  /** Статусы записей activation_links для отображения в админке */
  export function activationLinkStatusLabel(status: string): string {
    switch (status) {
      case 'issued':
        return 'Выдана'
      case 'activated':
        return 'Активирована'
      case 'revoked':
        return 'Отменена'
      case 'expired':
        return 'Истекла'
      default:
        return status
    }
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

  /** Псевдоним для статусов `activation_links` в админке */
  export const statusLabel = activationLinkStatusLabel