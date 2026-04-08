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
      className={`rounded-2xl border border-gray-300/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_-2px_rgba(0,0,0,0.07)] ${
        hover
          ? 'transition-shadow duration-150 hover:shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_20px_-4px_rgba(0,0,0,0.1)]'
          : ''
      } ${paddings[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
