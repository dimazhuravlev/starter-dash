import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import arrowDownIcon from '../assets/Arrow-down.svg'
import doneIcon from '../assets/Done.svg'
import crossIcon from '../assets/Cross.svg'
import { RESTAURANT_COORDS, type Courier, type CourierGender } from '../model/types'
import { useDashboardStore } from '../store/useDashboardStore'
import { TextField } from '../shared/ui/TextField'
import { courierLoginFromNames } from '../utils/translitLogin'

const GENDER_OPTIONS: { value: CourierGender; label: string }[] = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
]

type FieldKey = 'lastName' | 'firstName' | 'login' | 'phone'

const emptyErrors = (): Record<FieldKey, boolean> => ({
  lastName: false,
  firstName: false,
  login: false,
  phone: false,
})

function splitNameFromDisplay(full: string): { lastName: string; firstName: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length <= 1) {
    return { lastName: parts[0] ?? '', firstName: '' }
  }
  return { lastName: parts[0]!, firstName: parts.slice(1).join(' ') }
}

function newCourierId(): string {
  const couriers = useDashboardStore.getState().couriers
  let max = 0
  for (const id of Object.keys(couriers)) {
    const m = /^courier_(\d+)$/.exec(id)
    if (m) {
      max = Math.max(max, parseInt(m[1], 10))
    }
  }
  return `courier_${max + 1}`
}

function defaultNewCourierCoords(): { lat: number; lng: number } {
  const radiusDeg = 0.00072
  const angle = Math.random() * 2 * Math.PI
  return {
    lat: RESTAURANT_COORDS.lat + radiusDeg * Math.cos(angle) * 0.5,
    lng: RESTAURANT_COORDS.lng + radiusDeg * Math.sin(angle) * 0.5,
  }
}

export type CourierAddModalProps = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (courier: Courier) => void
  initialCourier?: Courier | null
}

export function CourierAddModal({
  isOpen,
  onClose,
  onSubmit,
  initialCourier = null,
}: CourierAddModalProps) {
  const titleId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [rendered, setRendered] = useState(false)
  const [active, setActive] = useState(false)

  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [gender, setGender] = useState<CourierGender>('male')
  const [login, setLogin] = useState('')
  /** Пока true — логин пересчитывается из фамилии и имени; сбрасывается при ручном вводе */
  const [loginAuto, setLoginAuto] = useState(true)
  const [phone, setPhone] = useState('')

  const [fieldErrors, setFieldErrors] = useState<Record<FieldKey, boolean>>(emptyErrors)
  const [shakeEpoch, setShakeEpoch] = useState(0)

  const resetForm = useCallback(() => {
    setLastName('')
    setFirstName('')
    setGender('male')
    setLogin('')
    setLoginAuto(true)
    setPhone('')
    setFieldErrors(emptyErrors())
  }, [])

  const onRequestClose = useCallback(() => {
    if (!rendered) {
      return
    }
    setActive(false)
  }, [rendered])

  const handleBackdropTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget || e.propertyName !== 'opacity') {
        return
      }
      if (!active) {
        setRendered(false)
        resetForm()
        onClose()
      }
    },
    [active, onClose, resetForm],
  )

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- монтирование оверлея и входная анимация
      setRendered(true)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setActive(true))
      })
      return () => cancelAnimationFrame(id)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen && rendered) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация закрытия с пропом isOpen
      setActive(false)
    }
  }, [isOpen, rendered])

  useEffect(() => {
    if (!isOpen) {
      return
    }
    /* eslint-disable react-hooks/set-state-in-effect -- поля формы при открытии (новый / редактирование) */
    if (initialCourier) {
      if (initialCourier.lastName !== undefined || initialCourier.firstName !== undefined) {
        setLastName(initialCourier.lastName ?? '')
        setFirstName(initialCourier.firstName ?? '')
      } else {
        const split = splitNameFromDisplay(initialCourier.name)
        setLastName(split.lastName)
        setFirstName(split.firstName)
      }
      setGender(initialCourier.gender ?? 'male')
      setLogin(initialCourier.login)
      setLoginAuto(false)
      setPhone(initialCourier.phone)
    } else {
      resetForm()
    }
    setFieldErrors(emptyErrors())
    setShakeEpoch(0)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, initialCourier, resetForm])

  useEffect(() => {
    if (!isOpen || !loginAuto) {
      return
    }
    setLogin(courierLoginFromNames(lastName, firstName))
  }, [isOpen, loginAuto, lastName, firstName])

  useEffect(() => {
    if (!active) {
      return
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [active])

  useEffect(() => {
    if (!active) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onRequestClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onRequestClose])

  useEffect(() => {
    if (isOpen && active) {
      const first = formRef.current?.querySelector<HTMLInputElement>(
        'input:not([type="hidden"]), select',
      )
      first?.focus()
    }
  }, [isOpen, active])

  const clearFieldError = (field: FieldKey) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: false } : prev))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const ln = lastName.trim()
    const fn = firstName.trim()
    const next: Record<FieldKey, boolean> = {
      lastName: !ln,
      firstName: !fn,
      login: !login.trim(),
      phone: !phone.trim(),
    }
    if (next.lastName || next.firstName || next.login || next.phone) {
      setFieldErrors(next)
      setShakeEpoch((x) => x + 1)
      return
    }
    setFieldErrors(emptyErrors())
    const id = initialCourier?.id ?? newCourierId()
    const now = Date.now()
    const displayName = `${ln} ${fn}`
    const courierType = initialCourier?.type ?? 'pedestrian'
    const payload: Courier = initialCourier
      ? {
          ...initialCourier,
          name: displayName,
          lastName: ln,
          firstName: fn,
          gender,
          login: login.trim().toLowerCase(),
          phone: phone.trim(),
          type: courierType,
        }
      : {
          id,
          name: displayName,
          lastName: ln,
          firstName: fn,
          gender,
          login: login.trim().toLowerCase(),
          phone: phone.trim(),
          type: courierType,
          status: 'free',
          freeSince: now,
          coords: defaultNewCourierCoords(),
        }
    onSubmit(payload)
    setActive(false)
  }

  const title = initialCourier
    ? `${lastName.trim()} ${firstName.trim()}`.trim() || initialCourier.name
    : 'Новый курьер'

  if (!rendered) {
    return null
  }

  const labelKey = (field: FieldKey) =>
    fieldErrors[field] ? `cf-${field}-${shakeEpoch}` : `cf-${field}-ok`

  return createPortal(
    <div
      className={`restaurant-add-modal${active ? ' restaurant-add-modal--active' : ''}`}
      role="presentation"
    >
      <div
        className="restaurant-add-modal__backdrop"
        onClick={onRequestClose}
        onTransitionEnd={handleBackdropTransitionEnd}
        aria-hidden={!active}
      />
      <div className="restaurant-add-modal__wrap">
        <div
          className="restaurant-add-modal__dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="restaurant-add-modal__title" id={titleId}>
            {title}
          </p>

          <form ref={formRef} className="restaurant-add-modal__form" onSubmit={handleSubmit} noValidate>
            <div className="restaurant-add-modal__row">
              <TextField
                className="restaurant-add-modal__field"
                labelKey={labelKey('lastName')}
                label="Фамилия"
                labelError={fieldErrors.lastName}
                name="lastName"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value)
                  clearFieldError('lastName')
                }}
                placeholder="Иванов"
                autoComplete="family-name"
              />
              <TextField
                className="restaurant-add-modal__field"
                labelKey={labelKey('firstName')}
                label="Имя"
                labelError={fieldErrors.firstName}
                name="firstName"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value)
                  clearFieldError('firstName')
                }}
                placeholder="Иван"
                autoComplete="given-name"
              />
            </div>

            <label className="restaurant-add-modal__field text-field__field">
              <span className="text-field__label">Пол</span>
              <div className="restaurant-add-modal__select-wrap">
                <select
                  className="restaurant-add-modal__select"
                  name="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as CourierGender)}
                  aria-label="Пол курьера"
                >
                  {GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span
                  className="restaurant-add-modal__select-chevron"
                  style={{ ['--icon-src' as string]: `url(${arrowDownIcon})` }}
                  aria-hidden
                />
              </div>
            </label>

            <TextField
              className="restaurant-add-modal__field"
              labelKey={labelKey('login')}
              label="Логин"
              labelError={fieldErrors.login}
              name="login"
              value={login}
              onChange={(e) => {
                const v = e.target.value
                setLogin(v)
                setLoginAuto(v === '')
                clearFieldError('login')
              }}
              placeholder="ivanovivan"
              autoComplete="username"
            />

            <TextField
              className="restaurant-add-modal__field"
              labelKey={labelKey('phone')}
              label="Телефон"
              labelError={fieldErrors.phone}
              name="phone"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                clearFieldError('phone')
              }}
              placeholder="+7 900 000 00 00"
              autoComplete="tel"
              inputMode="tel"
            />

            <div className="restaurant-add-modal__actions">
              <button type="submit" className="restaurant-add-modal__btn-primary">
                <span
                  className="restaurant-add-modal__btn-icon"
                  style={{ ['--icon-src' as string]: `url(${doneIcon})` }}
                  aria-hidden
                />
                Сохранить
              </button>
              <button type="button" className="restaurant-add-modal__btn-secondary" onClick={onRequestClose}>
                <span
                  className="restaurant-add-modal__btn-icon restaurant-add-modal__btn-icon--on-dark"
                  style={{ ['--icon-src' as string]: `url(${crossIcon})` }}
                  aria-hidden
                />
                Отменить
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  )
}
