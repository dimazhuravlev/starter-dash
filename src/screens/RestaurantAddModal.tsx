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
import infoIcon from '../assets/Info.svg'
import minusIcon from '../assets/Minus.svg'
import plusIcon from '../assets/Plus.svg'
import type { Restaurant } from '../model/types'
import { TextField } from '../shared/ui/TextField'
import { Tooltip } from '../shared/ui/Tooltip'
import {
  handoffColumnTooltipContent,
  pickupColumnTooltipContent,
} from './restaurantsColumnTooltips'

const TIMEZONE_OPTIONS = [
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
] as const

type FieldKey = 'name' | 'address' | 'latitude' | 'longitude'

function resolveTimezoneValue(saved?: string): string {
  if (!saved) {
    return TIMEZONE_OPTIONS[0].value
  }
  const byLabel = TIMEZONE_OPTIONS.find((o) => o.label === saved)
  if (byLabel) {
    return byLabel.value
  }
  const byValue = TIMEZONE_OPTIONS.find((o) => o.value === saved)
  if (byValue) {
    return byValue.value
  }
  return TIMEZONE_OPTIONS[0].value
}

const emptyErrors = (): Record<FieldKey, boolean> => ({
  name: false,
  address: false,
  latitude: false,
  longitude: false,
})

export type RestaurantAddModalProps = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (restaurant: Restaurant) => void
  /** Если задан — форма в режиме редактирования */
  initialRestaurant?: Restaurant | null
}

const DEFAULT_PICKUP = 5
const DEFAULT_HANDOFF = 3

export function RestaurantAddModal({
  isOpen,
  onClose,
  onSubmit,
  initialRestaurant = null,
}: RestaurantAddModalProps) {
  const titleId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [rendered, setRendered] = useState(false)
  const [active, setActive] = useState(false)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [timezone, setTimezone] = useState<string>(TIMEZONE_OPTIONS[0].value)
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [pickupMin, setPickupMin] = useState(DEFAULT_PICKUP)
  const [handoffMin, setHandoffMin] = useState(DEFAULT_HANDOFF)

  const [fieldErrors, setFieldErrors] = useState<Record<FieldKey, boolean>>(emptyErrors)
  const [shakeEpoch, setShakeEpoch] = useState(0)

  const resetForm = useCallback(() => {
    setName('')
    setAddress('')
    setTimezone(TIMEZONE_OPTIONS[0].value)
    setLatitude('')
    setLongitude('')
    setPickupMin(DEFAULT_PICKUP)
    setHandoffMin(DEFAULT_HANDOFF)
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
    /* eslint-disable react-hooks/set-state-in-effect -- поля формы и ошибки при открытии (новый / редактирование) */
    if (initialRestaurant) {
      setName(initialRestaurant.name)
      setAddress(initialRestaurant.address)
      setTimezone(resolveTimezoneValue(initialRestaurant.timezone))
      setLatitude(initialRestaurant.latitude ?? '')
      setLongitude(initialRestaurant.longitude ?? '')
      setPickupMin(initialRestaurant.pickupMin)
      setHandoffMin(initialRestaurant.handoffMin)
    } else {
      resetForm()
    }
    setFieldErrors(emptyErrors())
    setShakeEpoch(0)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, initialRestaurant, resetForm])

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
    const next: Record<FieldKey, boolean> = {
      name: !name.trim(),
      address: !address.trim(),
      latitude: !latitude.trim(),
      longitude: !longitude.trim(),
    }
    if (next.name || next.address || next.latitude || next.longitude) {
      setFieldErrors(next)
      setShakeEpoch((x) => x + 1)
      return
    }
    setFieldErrors(emptyErrors())
    const tzLabel = TIMEZONE_OPTIONS.find((o) => o.value === timezone)?.label ?? TIMEZONE_OPTIONS[0].label
    const newId =
      initialRestaurant?.id ??
      (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}`)
    const newRestaurant: Restaurant = {
      id: newId,
      name: name.trim(),
      address: address.trim(),
      pickupMin,
      handoffMin,
      routeMode: initialRestaurant?.routeMode ?? 'manual',
      timezone: tzLabel,
      latitude: latitude.trim(),
      longitude: longitude.trim(),
    }
    onSubmit(newRestaurant)
    setActive(false)
  }

  const bump = (field: 'pickupMin' | 'handoffMin', delta: number) => {
    const set = field === 'pickupMin' ? setPickupMin : setHandoffMin
    set((v) => Math.max(1, v + delta))
  }

  const title = initialRestaurant ? name.trim() || initialRestaurant.name : 'Новый ресторан'

  if (!rendered) {
    return null
  }

  const labelKey = (field: FieldKey) =>
    fieldErrors[field] ? `f-${field}-${shakeEpoch}` : `f-${field}-ok`

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
            <TextField
              className="restaurant-add-modal__field"
              labelKey={labelKey('name')}
              label="Название ресторана"
              labelError={fieldErrors.name}
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                clearFieldError('name')
              }}
              placeholder="Пушкина 38"
              autoComplete="organization"
            />

            <TextField
              className="restaurant-add-modal__field"
              labelKey={labelKey('address')}
              label="Адрес"
              labelError={fieldErrors.address}
              name="address"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value)
                clearFieldError('address')
              }}
              placeholder="Москва, ул. Пушкина, 38"
              autoComplete="street-address"
            />

            <label className="restaurant-add-modal__field text-field__field">
              <span className="text-field__label">Часовой пояс</span>
              <div className="restaurant-add-modal__select-wrap">
                <select
                  className="restaurant-add-modal__select"
                  name="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  aria-label="Часовой пояс"
                >
                  {TIMEZONE_OPTIONS.map((o) => (
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

            <div className="restaurant-add-modal__row">
              <TextField
                className="restaurant-add-modal__field"
                labelKey={labelKey('latitude')}
                label="Широта"
                labelError={fieldErrors.latitude}
                name="latitude"
                value={latitude}
                onChange={(e) => {
                  setLatitude(e.target.value)
                  clearFieldError('latitude')
                }}
                placeholder="00,0000"
                inputMode="decimal"
              />
              <TextField
                className="restaurant-add-modal__field"
                labelKey={labelKey('longitude')}
                label="Долгота"
                labelError={fieldErrors.longitude}
                name="longitude"
                value={longitude}
                onChange={(e) => {
                  setLongitude(e.target.value)
                  clearFieldError('longitude')
                }}
                placeholder="00,0000"
                inputMode="decimal"
              />
            </div>

            <div className="restaurant-add-modal__steppers">
              <div className="restaurant-add-modal__stepper-row">
                <Tooltip
                  content={pickupColumnTooltipContent}
                  offsetX={4}
                  offsetY={12}
                  portalClassName="tooltip--w230"
                >
                  <span className="restaurant-add-modal__stepper-tooltip-trigger">
                    Получение заказа в ресторане, мин
                    <span
                      className="restaurants__col-mode-info"
                      style={{ ['--info-icon' as string]: `url(${infoIcon})` }}
                      aria-hidden
                    />
                  </span>
                </Tooltip>
                <div className="restaurant-add-modal__time-picker">
                  <button
                    type="button"
                    className="restaurant-add-modal__time-btn"
                    onClick={() => bump('pickupMin', -1)}
                    aria-label="Уменьшить время получения заказа"
                  >
                    <span className="icon" style={{ ['--icon-src' as string]: `url(${minusIcon})` }} />
                  </button>
                  <span className="restaurant-add-modal__time-value">{pickupMin}</span>
                  <button
                    type="button"
                    className="restaurant-add-modal__time-btn"
                    onClick={() => bump('pickupMin', 1)}
                    aria-label="Увеличить время получения заказа"
                  >
                    <span className="icon" style={{ ['--icon-src' as string]: `url(${plusIcon})` }} />
                  </button>
                </div>
              </div>
              <div className="restaurant-add-modal__stepper-row">
                <Tooltip
                  content={handoffColumnTooltipContent}
                  offsetX={4}
                  offsetY={12}
                  portalClassName="tooltip--w230"
                >
                  <span className="restaurant-add-modal__stepper-tooltip-trigger">
                    Выдачи заказа клиенту, мин
                    <span
                      className="restaurants__col-mode-info"
                      style={{ ['--info-icon' as string]: `url(${infoIcon})` }}
                      aria-hidden
                    />
                  </span>
                </Tooltip>
                <div className="restaurant-add-modal__time-picker">
                  <button
                    type="button"
                    className="restaurant-add-modal__time-btn"
                    onClick={() => bump('handoffMin', -1)}
                    aria-label="Уменьшить время выдачи заказа"
                  >
                    <span className="icon" style={{ ['--icon-src' as string]: `url(${minusIcon})` }} />
                  </button>
                  <span className="restaurant-add-modal__time-value">{handoffMin}</span>
                  <button
                    type="button"
                    className="restaurant-add-modal__time-btn"
                    onClick={() => bump('handoffMin', 1)}
                    aria-label="Увеличить время выдачи заказа"
                  >
                    <span className="icon" style={{ ['--icon-src' as string]: `url(${plusIcon})` }} />
                  </button>
                </div>
              </div>
            </div>

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
