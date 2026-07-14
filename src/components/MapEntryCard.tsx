import Link from 'next/link'

type Props = {
  href?: string
}

export default function MapEntryCard({ href = '/' }: Props) {
  return (
    <Link
      href={href}
      aria-label="Открыть карту заведений"
      className="group relative block w-full overflow-hidden rounded-2xl"
    >
      <img
        src="/map-cover.svg"
        alt=""
        aria-hidden="true"
        className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] sm:h-48 md:h-56"
      />
      {/* лёгкий скрим для читаемости кнопки */}
      <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/[0.03]" />
      {/* пилюля-кнопка по центру */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-md transition-colors duration-200 group-hover:bg-primary-hover">
          {/* иконка карты */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          Смотреть на карте
        </span>
      </div>
    </Link>
  )
}
