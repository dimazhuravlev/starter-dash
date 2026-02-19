import type { ButtonHTMLAttributes, ReactNode } from 'react'

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  /** default — компактная основная; mobile — крупная (плавающая кнопка); ghost — вторичная (дебаг, группы) */
  variant?: 'default' | 'mobile' | 'ghost'
  /** Выделенное состояние (например, выбранная скорость в дебаг-панели) */
  active?: boolean
}

export function PrimaryButton({
  children,
  variant = 'default',
  active = false,
  className = '',
  ...rest
}: PrimaryButtonProps) {
  const base = 'primary-btn'
  const variantClass =
    variant === 'mobile' ? 'primary-btn--mobile' :
    variant === 'ghost' ? 'primary-btn--ghost' : 'primary-btn--default'
  const activeClass = active ? 'primary-btn--active' : ''
  return (
    <button
      type="button"
      className={`${base} ${variantClass} ${activeClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  )
}
