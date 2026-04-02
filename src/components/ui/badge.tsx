const colors = {
  default: 'bg-gray-100 text-gray-600',
  dark:    'bg-accent text-white',
  green:   'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  red:     'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  yellow:  'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  blue:    'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  accent:  'bg-accent-soft text-accent ring-1 ring-inset ring-accent/20',
} as const

type BadgeProps = {
  color?: keyof typeof colors
  children: React.ReactNode
  className?: string
}

export function Badge({ color = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${colors[color]} ${className}`}
    >
      {children}
    </span>
  )
}
