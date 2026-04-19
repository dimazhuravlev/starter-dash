import { useState } from 'react'
import plusIcon from '../assets/Plus.svg'
import minusIcon from '../assets/Minus.svg'
import { type OrderStageMin, type RouteStageMin } from '../model/rules'
import { PrimaryButton } from '../shared/ui/PrimaryButton'

export type DebugPanelScreenProps = {
  /** Внутри настроек — без дублирующего крупного заголовка страницы */
  embedded?: boolean
  now: number
  isRunning: boolean
  speed: 1 | 3 | 5 | 20
  orderStageMin: OrderStageMin
  orderSlaOptionsMin: number[]
  routeStageMin: RouteStageMin
  orderCreateIntervalMin: number
  toggleRun: () => void
  setSpeed: (speed: 1 | 3 | 5 | 20) => void
  tick: (deltaMs: number) => void
  resetSeed: () => void
  setOrderCreateIntervalMin: (value: number) => void
  setOrderStageMin: (stage: keyof OrderStageMin, value: number) => void
  setOrderSlaOption: (index: number, value: number) => void
  setRouteStageMin: (stage: keyof RouteStageMin, value: number) => void
}

const SPEEDS = [1, 3, 5, 20] as const
const STEP_MINUTES_OPTIONS = [1, 10] as const

export function DebugPanelScreen({
  embedded = false,
  now,
  isRunning,
  speed,
  orderStageMin,
  orderSlaOptionsMin,
  routeStageMin,
  orderCreateIntervalMin,
  toggleRun,
  setSpeed,
  tick,
  resetSeed,
  setOrderCreateIntervalMin,
  setOrderStageMin,
  setOrderSlaOption,
  setRouteStageMin,
}: DebugPanelScreenProps) {
  const [stepMinutesIdx, setStepMinutesIdx] = useState(0)
  const stepMinutes = STEP_MINUTES_OPTIONS[stepMinutesIdx]

  const rawSpeedIdx = SPEEDS.indexOf(speed)
  const speedIdx = rawSpeedIdx >= 0 ? rawSpeedIdx : 0
  const decSpeed = () => {
    const i = speedIdx <= 0 ? SPEEDS.length - 1 : speedIdx - 1
    setSpeed(SPEEDS[i])
  }
  const incSpeed = () => {
    const i = speedIdx >= SPEEDS.length - 1 ? 0 : speedIdx + 1
    setSpeed(SPEEDS[i])
  }

  const decStepMinutes = () =>
    setStepMinutesIdx((i) => (i <= 0 ? STEP_MINUTES_OPTIONS.length - 1 : i - 1))
  const incStepMinutes = () =>
    setStepMinutesIdx((i) => (i >= STEP_MINUTES_OPTIONS.length - 1 ? 0 : i + 1))

  return (
    <div className={`settings-screen__debug-panel${embedded ? ' settings-screen__debug-panel--embedded' : ''}`}>
      {!embedded ? (
        <h1 className="settings-screen__title">Симулятор доставки</h1>
      ) : null}

      <div className="settings-screen__debug-stack">
        <section className="settings-screen__card settings-screen__card--debug-toolbar" aria-label="Управление симуляцией">
          <div className="settings-screen__debug-clock-row">
            <span className="settings-screen__debug-time">{new Date(now).toLocaleTimeString()}</span>
          </div>

          <div className="settings-screen__stepper-table">
            <div className="settings-screen__stepper-row">
              <span className="settings-screen__row-label">Скорость</span>
              <div className="restaurants__time-picker">
                <button
                  type="button"
                  className="restaurants__time-btn"
                  onClick={decSpeed}
                  aria-label="Уменьшить скорость"
                >
                  <span className="icon" style={{ ['--icon-src' as string]: `url(${minusIcon})` }} />
                </button>
                <span className="restaurants__time-value restaurants__time-value--wide">×{speed}</span>
                <button
                  type="button"
                  className="restaurants__time-btn"
                  onClick={incSpeed}
                  aria-label="Увеличить скорость"
                >
                  <span className="icon" style={{ ['--icon-src' as string]: `url(${plusIcon})` }} />
                </button>
              </div>
            </div>
            <div className="settings-screen__stepper-row">
              <span className="settings-screen__row-label">Шаг симуляции, мин</span>
              <div className="restaurants__time-picker">
                <button
                  type="button"
                  className="restaurants__time-btn"
                  onClick={decStepMinutes}
                  aria-label="Уменьшить шаг"
                >
                  <span className="icon" style={{ ['--icon-src' as string]: `url(${minusIcon})` }} />
                </button>
                <span className="restaurants__time-value">{stepMinutes}</span>
                <button
                  type="button"
                  className="restaurants__time-btn"
                  onClick={incStepMinutes}
                  aria-label="Увеличить шаг"
                >
                  <span className="icon" style={{ ['--icon-src' as string]: `url(${plusIcon})` }} />
                </button>
              </div>
            </div>
          </div>

          <div className="settings-screen__debug-primary-actions">
            <PrimaryButton variant="default" active={isRunning} onClick={toggleRun}>
              {isRunning ? 'Пауза' : 'Старт'}
            </PrimaryButton>
            <PrimaryButton variant="default" onClick={() => tick(stepMinutes * 60_000)}>
              Шаг
            </PrimaryButton>
            <PrimaryButton variant="default" onClick={resetSeed}>
              Сбросить сид
            </PrimaryButton>
          </div>
        </section>

        <section className="settings-screen__card" aria-labelledby="debug-stage-duration-heading">
          <h2 id="debug-stage-duration-heading" className="settings-screen__card-title">
            Длительности этапов
          </h2>

          <div className="settings-screen__stepper-table">
            <DebugNumRow
              label="Интервал новых заказов"
              value={orderCreateIntervalMin}
              onChange={(next) => setOrderCreateIntervalMin(Math.max(0, next))}
            />
          </div>

          <h3 className="settings-screen__card-title settings-screen__card-title--section">SLA заказа</h3>
          <div className="settings-screen__stepper-table">
            {orderSlaOptionsMin.map((value, index) => (
              <DebugNumRow
                key={`sla_${index}`}
                label={`Опция ${index + 1}`}
                value={value}
                onChange={(next) => setOrderSlaOption(index, Math.max(0, next))}
              />
            ))}
          </div>

          <h3 className="settings-screen__card-title settings-screen__card-title--section">Заказы</h3>
          <div className="settings-screen__stepper-table">
            <DebugNumRow
              label="Ожидают готовки"
              value={orderStageMin.waiting_cook}
              onChange={(next) => setOrderStageMin('waiting_cook', Math.max(0, next))}
            />
            <DebugNumRow
              label="Готовятся"
              value={orderStageMin.cooking}
              onChange={(next) => setOrderStageMin('cooking', Math.max(0, next))}
            />
            <DebugNumRow
              label="Готовы"
              value={orderStageMin.ready}
              onChange={(next) => setOrderStageMin('ready', Math.max(0, next))}
            />
          </div>

          <h3 className="settings-screen__card-title settings-screen__card-title--section">Доставка</h3>
          <div className="settings-screen__stepper-table">
            <DebugNumRow
              label="В пути"
              value={routeStageMin.enroute}
              onChange={(next) => setRouteStageMin('enroute', Math.max(0, next))}
            />
            <DebugNumRow
              label="Возврат"
              value={routeStageMin.returning}
              onChange={(next) => setRouteStageMin('returning', Math.max(0, next))}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function DebugNumRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="settings-screen__stepper-row">
      <span className="settings-screen__row-label">{label}</span>
      <div className="restaurants__time-picker">
        <button
          type="button"
          className="restaurants__time-btn"
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`Уменьшить: ${label}`}
        >
          <span className="icon" style={{ ['--icon-src' as string]: `url(${minusIcon})` }} />
        </button>
        <span className="restaurants__time-value restaurants__time-value--wide">{value}</span>
        <button
          type="button"
          className="restaurants__time-btn"
          onClick={() => onChange(value + 1)}
          aria-label={`Увеличить: ${label}`}
        >
          <span className="icon" style={{ ['--icon-src' as string]: `url(${plusIcon})` }} />
        </button>
      </div>
    </div>
  )
}
