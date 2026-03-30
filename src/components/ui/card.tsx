type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({
  padding = 'md',
  hover = false,
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm ${
        hover ? 'transition-shadow duration-150 hover:shadow-md' : ''
      } ${paddings[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
