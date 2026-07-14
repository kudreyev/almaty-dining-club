import { CityLanding } from '@/components/city-landing'

export const dynamic = 'force-dynamic'

/**
 * Экран выбора города. Показывается, когда cookie `kuda_city` не установлена.
 * Если cookie есть — middleware редиректит с `/` на `/{city}`.
 */
export default function RootPage() {
  return <CityLanding />
}
