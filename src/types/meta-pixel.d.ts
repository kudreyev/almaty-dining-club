type MetaPixelTrackParams = Record<
  string,
  string | number | string[] | undefined
>

interface MetaPixelFbq {
  (command: 'init', pixelId: string): void
  (command: 'track', event: string, params?: MetaPixelTrackParams): void
  (...args: unknown[]): void
}

interface Window {
  fbq?: MetaPixelFbq
  _fbq?: MetaPixelFbq
}
