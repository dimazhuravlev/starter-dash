import { type OrderStageMin, type RouteStageMin } from '../model/rules'

type DebugPanelScreenProps = {
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

export function DebugPanelScreen({
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
  const setOrderStageValue = (stage: keyof OrderStageMin, value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    setOrderStageMin(stage, Math.max(parsed, 0))
  }

  const setRouteStageValue = (stage: keyof RouteStageMin, value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    setRouteStageMin(stage, Math.max(parsed, 0))
  }

  const setOrderIntervalValue = (value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    setOrderCreateIntervalMin(Math.max(parsed, 0))
  }

  const setOrderSlaValue = (index: number, value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    setOrderSlaOption(index, Math.max(parsed, 0))
  }

  return (
    <div className="debug">
      <header className="debug__header">
        <div>
          <h1>Симулятор доставки</h1>
        </div>
        <div className="debug__clock">{new Date(now).toLocaleTimeString()}</div>
      </header>

      <section className="debug__controls">
        <button type="button" className="btn" onClick={toggleRun}>
          {isRunning ? 'Пауза' : 'Старт'}
        </button>
        <div className="btn-group">
          {[1, 3, 5, 20].map((value) => (
            <button
              key={value}
              type="button"
              className={value === speed ? 'btn btn--active' : 'btn btn--ghost'}
              onClick={() => setSpeed(value as 1 | 3 | 5 | 20)}
            >
              x{value}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => tick(60_000)}>
          Шаг +1 мин
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => tick(600_000)}>
          Шаг +10 мин
        </button>
        <button type="button" className="btn btn--ghost" onClick={resetSeed}>
          Сбросить сид
        </button>
      </section>

      <section className="debug__grid">
        <div className="panel panel--stage">
          <h2>Длительности этапов</h2>
          <div className="stage-editor">
            <div className="stage-editor__group">
              <label className="stage-editor__row">
                <span>Интервал новых заказов</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={orderCreateIntervalMin}
                  onChange={(event) => setOrderIntervalValue(event.target.value)}
                />
              </label>
              <div className="stage-editor__title">SLA заказа</div>
              {orderSlaOptionsMin.map((value, index) => (
                <label key={`sla_${index}`} className="stage-editor__row">
                  <span>Опция {index + 1}</span>
                  <input
                    className="stage-editor__input"
                    type="number"
                    min="0"
                    step="1"
                    value={value}
                    onChange={(event) => setOrderSlaValue(index, event.target.value)}
                  />
                </label>
              ))}
              <div className="stage-editor__title">Заказы</div>
              <label className="stage-editor__row">
                <span>Ожидают готовки</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={orderStageMin.waiting_cook}
                  onChange={(event) => setOrderStageValue('waiting_cook', event.target.value)}
                />
              </label>
              <label className="stage-editor__row">
                <span>Готовятся</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={orderStageMin.cooking}
                  onChange={(event) => setOrderStageValue('cooking', event.target.value)}
                />
              </label>
              <label className="stage-editor__row">
                <span>Готовы</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={orderStageMin.ready}
                  onChange={(event) => setOrderStageValue('ready', event.target.value)}
                />
              </label>
            </div>
            <div className="stage-editor__group">
              <div className="stage-editor__title">Доставка</div>
              <label className="stage-editor__row">
                <span>Забор</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={routeStageMin.pickup}
                  onChange={(event) => setRouteStageValue('pickup', event.target.value)}
                />
              </label>
              <label className="stage-editor__row">
                <span>В пути</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={routeStageMin.enroute}
                  onChange={(event) => setRouteStageValue('enroute', event.target.value)}
                />
              </label>
              <label className="stage-editor__row">
                <span>Выдача</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={routeStageMin.handoff}
                  onChange={(event) => setRouteStageValue('handoff', event.target.value)}
                />
              </label>
              <label className="stage-editor__row">
                <span>Возврат</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={routeStageMin.returning}
                  onChange={(event) => setRouteStageValue('returning', event.target.value)}
                />
              </label>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
