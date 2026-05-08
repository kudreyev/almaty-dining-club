'use client'

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'

const YM_ID = process.env.NEXT_PUBLIC_YM_ID

declare global {
  interface Window {
    ym?: (id: string | number, action: string, ...args: unknown[]) => void
  }
}

function YandexMetricaPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!YM_ID || typeof window === 'undefined' || !window.ym) return

    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
    window.ym(YM_ID, 'hit', url)

    if (pathname.startsWith('/admin')) {
      window.ym(YM_ID, 'disableWebvisor')
    }
  }, [pathname, searchParams])

  return null
}

export function YandexMetrica() {
  if (!YM_ID) return null

  return (
    <>
      <Script id="yandex-metrica" strategy="afterInteractive">
        {`
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {
              if (document.scripts[j].src === r) { return; }
            }
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],
            k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window, document,'script',
            'https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}', 'ym');

          ym(${YM_ID}, 'init', {
            ssr: true,
            webvisor: true,
            clickmap: true,
            ecommerce: "dataLayer",
            accurateTrackBounce: true,
            trackLinks: true
          });
        `}
      </Script>
      <Suspense fallback={null}>
        <YandexMetricaPageView />
      </Suspense>
      <noscript>
        <div>
          <img
            src={`https://mc.yandex.ru/watch/${YM_ID}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>
    </>
  )
}
