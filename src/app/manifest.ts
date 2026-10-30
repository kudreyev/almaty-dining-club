import type { MetadataRoute } from 'next'
import { SITE_DESCRIPTION } from '@/lib/seo'

const shortcutIcons = [{ src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' }]

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Постоянный id: смена start_url не «раздваивает» установленное приложение.
    id: '/',
    name: 'KudaClub — 1+1 в кафе и ресторанах',
    short_name: 'KudaClub',
    description: SITE_DESCRIPTION,
    lang: 'ru',
    dir: 'ltr',
    categories: ['food', 'lifestyle'],
    // Middleware уводит «/» в каталог города пользователя (cookie kc_city → IP → Алматы).
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#D85A30',
    background_color: '#fafafa',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [
      {
        src: '/screenshots/catalog.png',
        sizes: '1080x1920',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Каталог заведений с предложениями 1+1',
      },
      {
        src: '/screenshots/restaurant.png',
        sizes: '1080x1920',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Карточка заведения',
      },
      {
        src: '/screenshots/code.png',
        sizes: '1080x1920',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Код для официанта',
      },
    ],
    shortcuts: [
      {
        name: 'Мой код',
        short_name: 'Мой код',
        description: 'Кабинет и активный код',
        url: '/app/me?source=pwa_shortcut',
        icons: shortcutIcons,
      },
      {
        name: 'Заведения Алматы',
        short_name: 'Алматы',
        url: '/almaty?source=pwa_shortcut',
        icons: shortcutIcons,
      },
      {
        name: 'Заведения Астаны',
        short_name: 'Астана',
        url: '/astana?source=pwa_shortcut',
        icons: shortcutIcons,
      },
    ],
  }
}
