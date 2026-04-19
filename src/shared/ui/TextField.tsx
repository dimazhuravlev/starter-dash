import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import crossIcon from '../../assets/Cross.svg'

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  className?: string
  /** Доп. класс на `<input>` */
  inputClassName?: string
  /** Подпись над полем; если нет — только инпут (или поиск) */
  label?: ReactNode
  /** Классы для текстовой подписи, если `label` — строка */
  labelClassName?: string
  /** `key` у внутреннего span подписи (например сброс анимации ошибки в формах) */
  labelKey?: string | number
  /** Ошибка: класс и анимация подписи */
  labelError?: boolean
  /** default — форма; search — поле с очисткой */
  variant?: 'default' | 'search'
  onClear?: () => void
  clearAriaLabel?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    className,
    inputClassName,
    label,
    labelClassName,
    labelKey,
    labelError,
    variant = 'default',
    onClear,
    clearAriaLabel = 'Очистить',
    ...inputProps
  },
  ref,
) {
  const hasValue = String(inputProps.value ?? '').length > 0

  const inputClass = [
    'text-field__input',
    variant === 'search' && hasValue ? 'text-field__input--has-clear' : '',
    inputClassName,
  ]
    .filter(Boolean)
    .join(' ')

  const inputEl = <input ref={ref} className={inputClass} {...inputProps} />

  if (variant === 'search') {
    return (
      <div className={['text-field', 'text-field--search', className].filter(Boolean).join(' ')}>
        {inputEl}
        <button
          type="button"
          className={['text-field__clear', hasValue ? 'text-field__clear--visible' : ''].filter(Boolean).join(' ')}
          aria-label={clearAriaLabel}
          tabIndex={hasValue ? 0 : -1}
          onClick={() => {
            onClear?.()
          }}
        >
          <span
            className="text-field__clear-icon"
            style={{ ['--icon-src' as string]: `url(${crossIcon})` }}
            aria-hidden
          />
        </button>
      </div>
    )
  }

  if (label != null && typeof label !== 'string') {
    return (
      <label className={['text-field__field', className].filter(Boolean).join(' ')}>
        {label}
        {inputEl}
      </label>
    )
  }

  if (label != null) {
    return (
      <label className={['text-field__field', className].filter(Boolean).join(' ')}>
        <span
          key={labelKey}
          className={['text-field__label', labelError ? 'text-field__label--error' : '', labelClassName]
            .filter(Boolean)
            .join(' ')}
        >
          {label}
        </span>
        {inputEl}
      </label>
    )
  }

  return <input ref={ref} className={[inputClass, className].filter(Boolean).join(' ')} {...inputProps} />
})
