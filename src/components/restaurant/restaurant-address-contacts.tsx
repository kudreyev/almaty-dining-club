import { Camera, Globe, MapPin, Phone } from 'lucide-react'

type RestaurantAddressContactsProps = {
  id: string
  address: string
  phone: string | null
  twoGisUrl: string | null
  instagramUrl: string | null
  staticMapUrl: string | null
  mapHrefUrl: string
  hasCoordinates: boolean
}

export function RestaurantAddressContacts({
  id,
  address,
  phone,
  twoGisUrl,
  instagramUrl,
  staticMapUrl,
  mapHrefUrl,
  hasCoordinates,
}: RestaurantAddressContactsProps) {
  return (
    <section id={id} style={{ padding: '24px 20px' }}>
      <h2
        className="font-medium text-neutral-900"
        style={{ fontSize: '18px', marginBottom: '16px' }}
      >
        Адрес и контакты
      </h2>

      {hasCoordinates && staticMapUrl ? (
        <a
          href={mapHrefUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden bg-neutral-100"
          style={{
            borderRadius: '6px',
            marginBottom: '12px',
            height: 'clamp(140px, 35vw, 180px)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={staticMapUrl}
            alt={`Карта: ${address}`}
            className="h-full w-full object-cover"
          />
        </a>
      ) : null}

      <div className="flex flex-col" style={{ gap: '8px' }}>
        {address ? (
          <div className="flex items-start text-neutral-700" style={{ gap: '10px', fontSize: '13px' }}>
            <MapPin
              size={13}
              style={{ opacity: 0.5, marginTop: '4px', flexShrink: 0 }}
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <span>{address}</span>
          </div>
        ) : null}

        {phone ? (
          <div className="flex items-start" style={{ gap: '10px', fontSize: '13px' }}>
            <Phone
              size={13}
              style={{ opacity: 0.5, marginTop: '4px', flexShrink: 0 }}
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <a
              href={`tel:${phone}`}
              className="text-neutral-700 transition-colors hover:text-neutral-900"
            >
              {phone}
            </a>
          </div>
        ) : null}
      </div>

      {(twoGisUrl || instagramUrl) ? (
        <div
          className="grid grid-cols-2"
          style={{ gap: '8px', marginTop: '14px' }}
        >
          {twoGisUrl ? (
            <a
              href={twoGisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-white text-neutral-700 transition-colors hover:bg-neutral-50"
              style={{
                borderWidth: '0.5px',
                borderStyle: 'solid',
                borderColor: 'rgb(229 229 229)',
                borderRadius: '6px',
                fontSize: '12px',
                padding: '9px 12px',
                gap: '6px',
              }}
            >
              <Globe size={12} style={{ opacity: 0.6 }} strokeWidth={1.6} aria-hidden="true" />
              <span>Открыть в 2GIS</span>
            </a>
          ) : null}

          {instagramUrl ? (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-white text-neutral-700 transition-colors hover:bg-neutral-50"
              style={{
                borderWidth: '0.5px',
                borderStyle: 'solid',
                borderColor: 'rgb(229 229 229)',
                borderRadius: '6px',
                fontSize: '12px',
                padding: '9px 12px',
                gap: '6px',
              }}
            >
              <Camera size={12} style={{ opacity: 0.6 }} strokeWidth={1.6} aria-hidden="true" />
              <span>Instagram</span>
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
