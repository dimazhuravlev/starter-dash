import type { ButtonHTMLAttributes, ReactNode } from 'react'

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  /** default — компактная основная; mobile — крупная (плавающая кнопка); ghost — вторичная (дебаг, группы); accent — акцентная фиолетовая */
  variant?: 'default' | 'mobile' | 'ghost' | 'accent'
  /** Выделенное состояние (например, выбранная скорость в дебаг-панели) */
  active?: boolean
  /** Иконка 16px перед текстом (например, Done для «Назначить»). Цвет — --text-inverted. */
  iconStart?: string
}

export function PrimaryButton({
  children,
  variant = 'default',
  active = false,
  className = '',
  iconStart,
  ...rest
}: PrimaryButtonProps) {
  const base = 'primary-btn'
  const variantClass =
    variant === 'mobile' ? 'primary-btn--mobile' :
    variant === 'ghost' ? 'primary-btn--ghost' :
    variant === 'accent' ? 'primary-btn--accent' : 'primary-btn--default'
  const activeClass = active ? 'primary-btn--active' : ''
  const withIconClass = iconStart ? 'primary-btn--with-icon' : ''
  return (
    <button
      type="button"
      className={`${base} ${variantClass} ${activeClass} ${withIconClass} ${className}`.trim()}
      aria-pressed={active ? true : undefined}
      {...rest}
    >
      {iconStart ? (
        <span
          className="primary-btn__icon"
          style={{ ['--icon-src' as string]: `url(${iconStart})` }}
          aria-hidden
        />
      ) : null}
      {children}
    </button>
  )
}
