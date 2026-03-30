import Link from 'next/link'

type Tab = {
  id: string
  label: string
  href?: string
}

type TabsProps = {
  tabs: Tab[]
  active: string
  onChange?: (id: string) => void
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
      {tabs.map((tab) => {
        const isActive = active === tab.id
        const cls = `rounded-lg px-4 py-2 text-sm font-medium transition-all ${
          isActive
            ? 'bg-white text-black shadow-sm'
            : 'text-gray-600 hover:text-black'
        }`

        if (tab.href) {
          return (
            <Link key={tab.id} href={tab.href} className={cls}>
              {tab.label}
            </Link>
          )
        }

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange?.(tab.id)}
            className={cls}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
