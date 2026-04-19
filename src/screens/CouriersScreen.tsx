import { useMemo, useRef, useState } from 'react'
import plusIcon from '../assets/Plus.svg'
import deleteIcon from '../assets/Delete.svg'
import editIcon from '../assets/Edit.svg'
import walkingCourierIcon from '../assets/Walking courier.svg'
import bikeCourierIcon from '../assets/Bike courier.svg'
import carCourierIcon from '../assets/Car courier 2.svg'
import type { Courier, CourierType } from '../model/types'
import { useDashboardStore } from '../store/useDashboardStore'
import { TextField } from '../shared/ui/TextField'
import { CourierAddModal } from './CourierAddModal'
import { RestaurantDeleteConfirmModal } from './RestaurantDeleteConfirmModal'

const courierTypeIcons = {
  pedestrian: walkingCourierIcon,
  bike: bikeCourierIcon,
  car: carCourierIcon,
} as const

const courierTypeLabels: Record<CourierType, string> = {
  pedestrian: 'Пешком',
  bike: 'Вело',
  car: 'Авто',
}

export function CouriersScreen() {
  const couriersRecord = useDashboardStore((s) => s.couriers)
  const upsertCourier = useDashboardStore((s) => s.upsertCourier)
  const removeCourier = useDashboardStore((s) => s.removeCourier)

  const couriers = useMemo(
    () =>
      Object.values(couriersRecord).sort((a, b) =>
        a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }),
      ),
    [couriersRecord],
  )

  const [search, setSearch] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null)
  const [courierToDelete, setCourierToDelete] = useState<Courier | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const filtered = search
    ? couriers.filter((c) => {
        const q = search.toLowerCase()
        return (
          c.name.toLowerCase().includes(q) ||
          c.login.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
        )
      })
    : couriers

  return (
    <div className="couriers">
      <div className="couriers__table">
        <div className="couriers__table-header">
          <div className="couriers__title">
            <span>Курьеры</span>
            <span className="couriers__title-count">{couriers.length}</span>
          </div>
          <div className="couriers__actions">
            <TextField
              ref={searchInputRef}
              variant="search"
              className="couriers__search-wrap"
              type="text"
              placeholder="Поиск курьера"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Поиск курьера"
              clearAriaLabel="Очистить поиск"
              onClear={() => {
                setSearch('')
                searchInputRef.current?.focus()
              }}
            />
            <button
              type="button"
              className="couriers__add-btn"
              onClick={() => {
                setEditingCourier(null)
                setAddModalOpen(true)
              }}
            >
              <span className="icon" style={{ ['--icon-src' as string]: `url(${plusIcon})` }} />
              Добавить курьера
            </button>
          </div>
        </div>

        <div className="couriers__table-divider" aria-hidden />

        <div className="couriers__columns">
          <div className="couriers__col-header">
            <span className="couriers__col--name">Имя курьера</span>
            <span className="couriers__col--login">Логин</span>
            <span className="couriers__col--phone">Телефон</span>
            <span className="couriers__col--type">Тип</span>
            <span className="couriers__col--actions" aria-hidden />
          </div>

          <div className="couriers__list">
            {filtered.map((c) => (
              <div key={c.id} className="couriers__row">
                <div className="couriers__row-inner">
                  <div className="couriers__cell--name">{c.name}</div>
                  <div className="couriers__cell--login">{c.login}</div>
                  <div className="couriers__cell--phone">{c.phone}</div>
                  <div className="couriers__cell--type">
                    <span className="couriers__type-pill">
                      <span
                        className="couriers__type-icon"
                        style={{ ['--icon-src' as string]: `url("${courierTypeIcons[c.type]}")` }}
                        aria-hidden
                      />
                      {courierTypeLabels[c.type]}
                    </span>
                  </div>
                  <div className="couriers__row-actions">
                    <button
                      type="button"
                      className="couriers__edit-btn"
                      aria-label={`Редактировать ${c.name}`}
                      onClick={() => {
                        setEditingCourier(c)
                        setAddModalOpen(true)
                      }}
                    >
                      <span
                        className="couriers__edit-icon-graphic"
                        style={{ ['--icon-src' as string]: `url(${editIcon})` }}
                        aria-hidden
                      />
                    </button>
                    <button
                      type="button"
                      className="couriers__delete-btn"
                      aria-label={`Удалить ${c.name}`}
                      onClick={() => setCourierToDelete(c)}
                    >
                      <span
                        className="couriers__delete-icon-graphic"
                        style={{ ['--icon-src' as string]: `url(${deleteIcon})` }}
                        aria-hidden
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CourierAddModal
        isOpen={addModalOpen}
        initialCourier={editingCourier}
        onClose={() => {
          setAddModalOpen(false)
          setEditingCourier(null)
        }}
        onSubmit={(courier) => {
          upsertCourier(courier)
        }}
      />

      <RestaurantDeleteConfirmModal
        isOpen={courierToDelete !== null}
        title="Точно хотите удалить курьера?"
        onClose={() => setCourierToDelete(null)}
        onConfirm={() => {
          if (!courierToDelete) {
            return
          }
          removeCourier(courierToDelete.id)
          setCourierToDelete(null)
        }}
      />
    </div>
  )
}
