export type UserKind = 'customer' | 'staff' | 'test'

export const USER_KINDS: UserKind[] = ['customer', 'staff', 'test']

export const STAFF_PLAN_END_DATE = '2099-12-31'
export const STAFF_PLAN_NAME = 'staff_access'

export function isCustomerKind(kind: string | null | undefined): boolean {
  return (kind ?? 'customer') === 'customer'
}

export function userKindLabel(kind: UserKind): string {
  switch (kind) {
    case 'staff':
      return 'Стафф'
    case 'test':
      return 'Тест'
    default:
      return 'Клиент'
  }
}
