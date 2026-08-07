import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'kudaclub',
    short_name: 'kudaclub',
    description: 'Подписка с офферами 2 за 1 и в подарок в ресторанах Казахстана.',
    start_url: '/app/me?utm_source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#D85A30',
    background_color: '#fafafa',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Мой код скидки',
        short_name: 'Код',
        description: 'Открыть кабинет с кодом скидки',
        url: '/app/me',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Заведения Алматы',
        short_name: 'Алматы',
        description: 'Каталог заведений в Алматы',
        url: '/almaty?utm_source=pwa_shortcut',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Заведения Астана',
        short_name: 'Астана',
        description: 'Каталог заведений в Астане',
        url: '/astana?utm_source=pwa_shortcut',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  }
}
