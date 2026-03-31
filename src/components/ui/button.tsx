import Link from 'next/link'

const base =
  'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]'

const variants = {
  primary:   'bg-accent text-white hover:bg-accent-dark',
  secondary: 'border border-gray-200 bg-white text-gray-900 hover:bg-accent-soft hover:border-accent/30',
  ghost:     'text-gray-500 hover:text-accent hover:bg-accent-soft',
  danger:    'bg-red-600 text-white hover:bg-red-700',
} as const

const sizes = {
  sm: 'rounded-xl px-3.5 py-2 text-xs gap-1.5',
  md: 'rounded-xl px-5 py-2.5 text-sm gap-2',
  lg: 'rounded-xl px-6 py-3 text-sm gap-2',
} as const

type Variant = keyof typeof variants
type Size = keyof typeof sizes

type ButtonBaseProps = {
  variant?: Variant
  size?: Size
  className?: string
}

type ButtonAsButton = ButtonBaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & { href?: never }

type ButtonAsLink = ButtonBaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> & { href: string }

export type ButtonProps = ButtonAsButton | ButtonAsLink

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`

  if ('href' in props && props.href) {
    const { href, ...rest } = props as ButtonAsLink
    if (href.startsWith('http') || href.startsWith('mailto:')) {
      return <a href={href} className={cls} {...rest} />
    }
    return <Link href={href} className={cls} {...(rest as any)} />
  }

  return <button className={cls} {...(props as ButtonAsButton)} />
}
