type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
}

export function Input({ label, hint, error, id, className = '', ...props }: InputProps) {
  return (
    <div>
      {label ? (
        <label htmlFor={id} className="mb-1.5 block text-base font-medium text-gray-700">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-base outline-none transition-colors placeholder:text-gray-500 focus:border-accent focus:ring-1 focus:ring-accent/20 ${
          error ? 'border-red-300' : 'border-gray-200'
        } ${className}`}
        {...props}
      />
      {hint && !error ? <p className="mt-1 text-sm text-gray-500">{hint}</p> : null}
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
}

export function Select({ label, id, className = '', children, ...props }: SelectProps) {
  return (
    <div>
      {label ? (
        <label htmlFor={id} className="mb-1.5 block text-base font-medium text-gray-700">
          {label}
        </label>
      ) : null}
      <select
        id={id}
        className={`w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/20 ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
}

export function Textarea({ label, id, className = '', ...props }: TextareaProps) {
  return (
    <div>
      {label ? (
        <label htmlFor={id} className="mb-1.5 block text-base font-medium text-gray-700">
          {label}
        </label>
      ) : null}
      <textarea
        id={id}
        className={`w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base outline-none transition-colors placeholder:text-gray-500 focus:border-accent focus:ring-1 focus:ring-accent/20 ${className}`}
        {...props}
      />
    </div>
  )
}
