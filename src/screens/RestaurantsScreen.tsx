import { useRef, useState } from 'react'
import plusIcon from '../assets/Plus.svg'
import minusIcon from '../assets/Minus.svg'
import deleteIcon from '../assets/Delete.svg'
import editIcon from '../assets/Edit.svg'
import infoIcon from '../assets/Info.svg'
import type { Restaurant } from '../model/types'
import { RouteModeSelector } from '../shared/ui/RouteModeSelector'
import { TextField } from '../shared/ui/TextField'
import { Tooltip } from '../shared/ui/Tooltip'
import {
  handoffColumnTooltipContent,
  pickupColumnTooltipContent,
} from './restaurantsColumnTooltips'
import { RestaurantAddModal } from './RestaurantAddModal'
import { RestaurantDeleteConfirmModal } from './RestaurantDeleteConfirmModal'

export type { Restaurant }

type RestaurantsScreenProps = {
  restaurants: Restaurant[]
  onRestaurantsChange: (restaurants: Restaurant[]) => void
}

const routeModeColumnTooltipContent = (
  <div className="tooltip-rich">
    <div className="tooltip-rich__section">
      <div className="tooltip-rich__title tooltip-rich__title--auto-mode">
        <span className="route-mode-auto-text">Автомат</span>
      </div>
      <p className="tooltip-rich__desc">
        Система сама формирует маршруты: подбирает курьеров и оптимально объединяет заказы
      </p>
    </div>
    <div className="tooltip-rich__section">
      <div className="tooltip-rich__title">Ручной</div>
      <p className="tooltip-rich__desc">
        Собираете маршрут сами — выбираете курьера и назначаете на него заказы
      </p>
    </div>
  </div>
)

export function RestaurantsScreen({ restaurants, onRestaurantsChange }: RestaurantsScreenProps) {
  const [search, setSearch] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null)
  const [restaurantToDelete, setRestaurantToDelete] = useState<Restaurant | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Global settings — independent state
  const [globalPickup, setGlobalPickup] = useState(3)
  const [globalHandoff, setGlobalHandoff] = useState(3)
  const [globalMode, setGlobalMode] = useState<'auto' | 'manual'>('manual')

  const filtered = search
    ? restaurants.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.address.toLowerCase().includes(search.toLowerCase()),
      )
    : restaurants

  function updateAllPickup(delta: number) {
    const newVal = Math.max(1, globalPickup + delta)
    setGlobalPickup(newVal)
    onRestaurantsChange(restaurants.map((r) => ({ ...r, pickupMin: newVal })))
  }

  function updateAllHandoff(delta: number) {
    const newVal = Math.max(1, globalHandoff + delta)
    setGlobalHandoff(newVal)
    onRestaurantsChange(restaurants.map((r) => ({ ...r, handoffMin: newVal })))
  }

  function updateAllMode(mode: 'auto' | 'manual') {
    setGlobalMode(mode)
    onRestaurantsChange(restaurants.map((r) => ({ ...r, routeMode: mode })))
  }

  function updateRestaurant(id: string, field: 'pickupMin' | 'handoffMin', delta: number) {
    onRestaurantsChange(
      restaurants.map((r) => (r.id === id ? { ...r, [field]: Math.max(1, r[field] + delta) } : r)),
    )
  }

  function toggleMode(id: string, mode: 'auto' | 'manual') {
    onRestaurantsChange(
      restaurants.map((r) => (r.id === id ? { ...r, routeMode: mode } : r)),
    )
  }

  const pickupSynced = restaurants.every((r) => r.pickupMin === globalPickup)
  const handoffSynced = restaurants.every((r) => r.handoffMin === globalHandoff)
  const modeSynced = restaurants.every((r) => r.routeMode === globalMode)

  return (
    <div className="restaurants">
      <div className="restaurants__table">
        {/* Header */}
        <div className="restaurants__table-header">
          <div className="restaurants__title">
            <span>Рестораны</span>
            <span className="restaurants__title-count">{restaurants.length}</span>
          </div>
          <div className="restaurants__actions">
            <TextField
              ref={searchInputRef}
              className="restaurants__search-wrap"
              variant="search"
              type="text"
              placeholder="Поиск ресторана"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Поиск ресторана"
              clearAriaLabel="Очистить поиск"
              onClear={() => {
                setSearch('')
                searchInputRef.current?.focus()
              }}
            />
            <button
              type="button"
              className="restaurants__add-btn"
              onClick={() => {
                setEditingRestaurant(null)
                setAddModalOpen(true)
              }}
            >
              <span className="icon" style={{ ['--icon-src' as string]: `url(${plusIcon})` }} />
              Добавить ресторан
            </button>
          </div>
        </div>

        <div className="restaurants__table-divider" aria-hidden />

        {/* Table */}
        <div className="restaurants__columns">
          {/* Column headers */}
          <div className="restaurants__col-header">
            <span className="restaurants__col--name">Название</span>
            <span className="restaurants__col--address">Адрес ресторана</span>
            <span className="restaurants__col--pickup">
              <Tooltip
                content={pickupColumnTooltipContent}
                offsetX={4}
                offsetY={12}
                portalClassName="tooltip--w230"
              >
                <span className="restaurants__col-mode-trigger">
                  Получение заказа
                  <br />
                  <span className="restaurants__col-mode-line2">
                    в ресторане, мин
                    <span
                      className="restaurants__col-mode-info"
                      style={{ ['--info-icon' as string]: `url(${infoIcon})` }}
                      aria-hidden
                    />
                  </span>
                </span>
              </Tooltip>
            </span>
            <span className="restaurants__col--handoff">
              <Tooltip
                content={handoffColumnTooltipContent}
                offsetX={4}
                offsetY={12}
                portalClassName="tooltip--w230"
              >
                <span className="restaurants__col-mode-trigger">
                  Выдача заказа
                  <br />
                  <span className="restaurants__col-mode-line2">
                    клиенту, мин
                    <span
                      className="restaurants__col-mode-info"
                      style={{ ['--info-icon' as string]: `url(${infoIcon})` }}
                      aria-hidden
                    />
                  </span>
                </span>
              </Tooltip>
            </span>
            <span className="restaurants__col--mode">
              <Tooltip content={routeModeColumnTooltipContent} offsetX={4} offsetY={12}>
                <span className="restaurants__col-mode-trigger">
                  Режим создания
                  <br />
                  <span className="restaurants__col-mode-line2">
                    маршрутов
                    <span
                      className="restaurants__col-mode-info"
                      style={{ ['--info-icon' as string]: `url(${infoIcon})` }}
                      aria-hidden
                    />
                  </span>
                </span>
              </Tooltip>
            </span>
            <span className="restaurants__col--actions" aria-hidden />
          </div>

          {/* Global settings row */}
          <div className="restaurants__row restaurants__row--global">
            <div className="restaurants__row-inner">
              <div className="restaurants__cell--name">
                Общие настройки
                <br />
                для всех ресторанов
              </div>
              <div className="restaurants__cell--address" />
              <TimePicker
                value={globalPickup}
                synced={pickupSynced}
                onDecrement={() => updateAllPickup(-1)}
                onIncrement={() => updateAllPickup(1)}
              />
              <TimePicker
                value={globalHandoff}
                synced={handoffSynced}
                onDecrement={() => updateAllHandoff(-1)}
                onIncrement={() => updateAllHandoff(1)}
              />
              <RouteModeSelector
                className="route-mode-selector--table"
                mode={globalMode}
                synced={modeSynced}
                onModeChange={updateAllMode}
              />
              <div className="restaurants__row-actions" aria-hidden />
            </div>
          </div>

          {/* Restaurant list */}
          <div className="restaurants__list">
            {filtered.map((r) => (
              <div key={r.id} className="restaurants__row">
                <div className="restaurants__row-inner">
                  <div className="restaurants__cell--name">{r.name}</div>
                  <div className="restaurants__cell--address">{r.address}</div>
                  <TimePicker
                    value={r.pickupMin}
                    onDecrement={() => updateRestaurant(r.id, 'pickupMin', -1)}
                    onIncrement={() => updateRestaurant(r.id, 'pickupMin', 1)}
                  />
                  <TimePicker
                    value={r.handoffMin}
                    onDecrement={() => updateRestaurant(r.id, 'handoffMin', -1)}
                    onIncrement={() => updateRestaurant(r.id, 'handoffMin', 1)}
                  />
                  <RouteModeSelector
                    className="route-mode-selector--table"
                    mode={r.routeMode}
                    onModeChange={(mode) => toggleMode(r.id, mode)}
                  />
                  <div className="restaurants__row-actions">
                    <button
                      type="button"
                      className="restaurants__edit-btn"
                      aria-label={`Редактировать ${r.name}`}
                      onClick={() => {
                        setEditingRestaurant(r)
                        setAddModalOpen(true)
                      }}
                    >
                      <span
                        className="restaurants__edit-icon-graphic"
                        style={{ ['--icon-src' as string]: `url(${editIcon})` }}
                        aria-hidden
                      />
                    </button>
                    <button
                      type="button"
                      className="restaurants__delete-btn"
                      aria-label={`Удалить ${r.name}`}
                      onClick={() => setRestaurantToDelete(r)}
                    >
                      <span
                        className="restaurants__delete-icon-graphic"
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

      <RestaurantAddModal
        isOpen={addModalOpen}
        initialRestaurant={editingRestaurant}
        onClose={() => {
          setAddModalOpen(false)
          setEditingRestaurant(null)
        }}
        onSubmit={(restaurant) => {
          if (editingRestaurant) {
            onRestaurantsChange(restaurants.map((x) => (x.id === restaurant.id ? restaurant : x)))
          } else {
            onRestaurantsChange([restaurant, ...restaurants])
          }
        }}
      />

      <RestaurantDeleteConfirmModal
        isOpen={restaurantToDelete !== null}
        onClose={() => setRestaurantToDelete(null)}
        onConfirm={() => {
          if (!restaurantToDelete) {
            return
          }
          onRestaurantsChange(restaurants.filter((x) => x.id !== restaurantToDelete.id))
          setRestaurantToDelete(null)
        }}
      />
    </div>
  )
}

function TimePicker({
  value,
  synced,
  onDecrement,
  onIncrement,
}: {
  value: number
  synced?: boolean
  onDecrement: () => void
  onIncrement: () => void
}) {
  return (
    <div className="restaurants__time-picker">
      <button type="button" className="restaurants__time-btn" onClick={onDecrement}>
        <span className="icon" style={{ ['--icon-src' as string]: `url(${minusIcon})` }} />
      </button>
      <span className={`restaurants__time-value${synced === false ? ' restaurants__time-value--desynced' : ''}`}>{value}</span>
      <button type="button" className="restaurants__time-btn" onClick={onIncrement}>
        <span className="icon" style={{ ['--icon-src' as string]: `url(${plusIcon})` }} />
      </button>
    </div>
  )
}
