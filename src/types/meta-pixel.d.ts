type MetaPixelTrackParams = Record<
  string,
  string | number | string[] | undefined
>

type MetaPixelTrackOptions = {
  eventID?: string
}

interface MetaPixelFbq {
  (command: 'init', pixelId: string): void
  (
    command: 'track',
    event: string,
    params?: MetaPixelTrackParams,
    options?: MetaPixelTrackOptions,
  ): void
  (...args: unknown[]): void
}

interface Window {
  fbq?: MetaPixelFbq
  _fbq?: MetaPixelFbq
}
