import { useCallback, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'

export type RestaurantDeleteConfirmModalProps = {
  isOpen: boolean
  onClose: () => void
  /** Вызывается после подтверждения, до закрытия анимации — удаление в родителе */
  onConfirm: () => void
  /** Заголовок диалога (по умолчанию — удаление ресторана) */
  title?: string
}

export function RestaurantDeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Точно хотите удалить ресторан?',
}: RestaurantDeleteConfirmModalProps) {
  const titleId = useId()
  const [rendered, setRendered] = useState(false)
  const [active, setActive] = useState(false)

  const handleCloseComplete = useCallback(() => {
    onClose()
  }, [onClose])

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
        handleCloseComplete()
      }
    },
    [active, handleCloseComplete],
  )

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRendered(true)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setActive(true))
      })
      return () => cancelAnimationFrame(id)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen && rendered) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActive(false)
    }
  }, [isOpen, rendered])

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

  const handleConfirm = () => {
    onConfirm()
    setActive(false)
  }

  if (!rendered) {
    return null
  }

  return createPortal(
    <div
      className={`restaurant-delete-modal${active ? ' restaurant-delete-modal--active' : ''}`}
      role="presentation"
    >
      <div
        className="restaurant-delete-modal__backdrop"
        onClick={onRequestClose}
        onTransitionEnd={handleBackdropTransitionEnd}
        aria-hidden={!active}
      />
      <div className="restaurant-delete-modal__wrap">
        <div
          className="restaurant-delete-modal__dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="restaurant-delete-modal__title" id={titleId}>
            {title}
          </p>
          <div className="restaurant-delete-modal__actions">
            <button type="button" className="restaurant-delete-modal__btn-danger" onClick={handleConfirm}>
              Да, удалить
            </button>
            <button type="button" className="restaurant-delete-modal__btn-back" onClick={onRequestClose}>
              Назад
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
