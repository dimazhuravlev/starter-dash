import { useEffect, useState } from 'react'
import { useDashboardStore } from './store/useDashboardStore'
import { DashboardScreen } from './screens/DashboardScreen'
import { DebugPanelScreen } from './screens/DebugPanelScreen'
import { AppHeader } from './shared/ui/AppHeader'
import { AppSubheader } from './shared/ui/AppSubheader'
const tabItems = ['Заказы', 'Смены', 'Курьеры', 'Статистика']

const restaurantTabs = [
  { label: 'Большой', count: 5 },
  { label: 'Пошехонское', count: 82 },
  { label: 'Некрасова', count: 11 },
  { label: 'Мира', count: 12 },
  { label: 'Ярославская', count: 21 },
]

function App() {
  const now = useDashboardStore((state) => state.now)
  const isRunning = useDashboardStore((state) => state.isRunning)
  const speed = useDashboardStore((state) => state.speed)
  const orders = useDashboardStore((state) => state.orders)
  const couriers = useDashboardStore((state) => state.couriers)
  const routes = useDashboardStore((state) => state.routes)
  const orderCreateIntervalMin = useDashboardStore((state) => state.orderCreateIntervalMin)
  const orderStageMin = useDashboardStore((state) => state.orderStageMin)
  const orderSlaOptionsMin = useDashboardStore((state) => state.orderSlaOptionsMin)
  const routeStageMin = useDashboardStore((state) => state.routeStageMin)
  const tick = useDashboardStore((state) => state.tick)
  const toggleRun = useDashboardStore((state) => state.toggleRun)
  const setSpeed = useDashboardStore((state) => state.setSpeed)
  const resetSeed = useDashboardStore((state) => state.resetSeed)
  const createRouteDraft = useDashboardStore((state) => state.createRouteDraft)
  const deleteRouteDraft = useDashboardStore((state) => state.deleteRouteDraft)
  const detachCourierFromRoute = useDashboardStore((state) => state.detachCourierFromRoute)
  const attachCourierToRoute = useDashboardStore((state) => state.attachCourierToRoute)
  const detachOrderFromRoute = useDashboardStore((state) => state.detachOrderFromRoute)
  const attachOrderToRoute = useDashboardStore((state) => state.attachOrderToRoute)
  const reorderRouteOrders = useDashboardStore((state) => state.reorderRouteOrders)
  const sendRoute = useDashboardStore((state) => state.sendRoute)
  const revertRouteToDraft = useDashboardStore((state) => state.revertRouteToDraft)
  const setOrderCreateIntervalMin = useDashboardStore((state) => state.setOrderCreateIntervalMin)
  const setOrderStageMin = useDashboardStore((state) => state.setOrderStageMin)
  const setOrderSlaOption = useDashboardStore((state) => state.setOrderSlaOption)
  const setRouteStageMin = useDashboardStore((state) => state.setRouteStageMin)
  const routeMode = useDashboardStore((state) => state.routeMode)
  const setRouteMode = useDashboardStore((state) => state.setRouteMode)

  const [screen, setScreen] = useState<'dashboard' | 'debug'>('dashboard')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeRestaurantTab, setActiveRestaurantTab] = useState(0)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof localStorage === 'undefined') return 'dark'
    const saved = localStorage.getItem('theme')
    return saved === 'light' ? 'light' : 'dark'
  })

  // При перезагрузке страницы создаём пустой шаблон маршрута, если нет ни одного черновика
  useEffect(() => {
    const { routes } = useDashboardStore.getState()
    const hasDraft = Object.values(routes).some((r) => r.status === 'draft')
    if (!hasDraft) {
      useDashboardStore.getState().createRouteDraft()
    }
  }, [])

  useEffect(() => {
    if (!isRunning) {
      return
    }
    const interval = window.setInterval(() => {
      tick(1000 * speed)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [isRunning, speed, tick])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (typeof localStorage !== 'undefined') localStorage.setItem('theme', theme)
  }, [theme])

  // Сброс классов body при переключении экрана/таба (если остались is-dragging/is-resizing после днд или ресайза)
  useEffect(() => {
    document.body.classList.remove('is-dragging', 'is-resizing')
  }, [screen, activeRestaurantTab])

  const isDebug = screen === 'debug'

  return (
    <div className="app-shell">
      <AppHeader
        tabItems={tabItems}
        isMenuOpen={isMenuOpen}
        onMenuToggle={() => setIsMenuOpen((open) => !open)}
        onTabClick={() => setIsMenuOpen(false)}
        isDebug={isDebug}
        onDebugClick={() => setScreen(isDebug ? 'dashboard' : 'debug')}
        theme={theme}
        onThemeToggle={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        routeMode={routeMode}
        onRouteModeChange={setRouteMode}
      />

      {screen === 'dashboard' && (
        <AppSubheader
          tabs={restaurantTabs}
          activeIndex={activeRestaurantTab}
          onTabChange={setActiveRestaurantTab}
        />
      )}

      <main className="app-content">
        {/* Не размонтируем экраны — переключаем видимость, чтобы карта и дашборд не вызывали cleanup при переходе в дебаг/табы */}
        <div
          className={`app-content__pane${screen === 'dashboard' && activeRestaurantTab === 0 ? '' : ' app-content__pane--hidden'}`}
          aria-hidden={screen !== 'dashboard' || activeRestaurantTab !== 0}
        >
          <DashboardScreen
            key="dashboard"
            theme={theme}
            orders={orders}
            couriers={couriers}
            routes={routes}
            createRouteDraft={createRouteDraft}
            deleteRouteDraft={deleteRouteDraft}
            detachCourierFromRoute={detachCourierFromRoute}
            attachCourierToRoute={attachCourierToRoute}
            detachOrderFromRoute={detachOrderFromRoute}
            attachOrderToRoute={attachOrderToRoute}
            reorderRouteOrders={reorderRouteOrders}
            sendRoute={sendRoute}
            revertRouteToDraft={revertRouteToDraft}
            now={now}
            orderStageMin={orderStageMin}
            routeStageMin={routeStageMin}
          />
        </div>
        <div
          className={`app-content__pane${screen === 'dashboard' && activeRestaurantTab !== 0 ? '' : ' app-content__pane--hidden'}`}
          aria-hidden={screen !== 'dashboard' || activeRestaurantTab === 0}
        >
          <div key={`tab-${activeRestaurantTab}`} className="app-content__empty">
            Заказы {restaurantTabs[activeRestaurantTab].label}, {restaurantTabs[activeRestaurantTab].count}
          </div>
        </div>
        <div
          className={`app-content__pane${screen === 'debug' ? '' : ' app-content__pane--hidden'}`}
          aria-hidden={screen !== 'debug'}
        >
          <DebugPanelScreen
            key="debug"
            now={now}
            isRunning={isRunning}
            speed={speed}
            orderStageMin={orderStageMin}
            orderSlaOptionsMin={orderSlaOptionsMin}
            routeStageMin={routeStageMin}
            orderCreateIntervalMin={orderCreateIntervalMin}
            toggleRun={toggleRun}
            setSpeed={setSpeed}
            tick={tick}
            resetSeed={resetSeed}
            setOrderCreateIntervalMin={setOrderCreateIntervalMin}
            setOrderStageMin={setOrderStageMin}
            setOrderSlaOption={setOrderSlaOption}
            setRouteStageMin={setRouteStageMin}
          />
        </div>
      </main>
    </div>
  )
}

export default App
