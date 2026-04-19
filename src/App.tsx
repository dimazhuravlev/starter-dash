import { useCallback, useEffect, useState } from 'react'
import { useDashboardStore } from './store/useDashboardStore'
import { DashboardScreen } from './screens/DashboardScreen'
import type { Restaurant } from './model/types'
import { RestaurantsScreen } from './screens/RestaurantsScreen'
import { CouriersScreen } from './screens/CouriersScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { AppHeader } from './shared/ui/AppHeader'
import { AppSubheader } from './shared/ui/AppSubheader'
import initialRestaurantsData from './data/restaurants.json'

const tabItems = ['Заказы', 'Рестораны', 'Курьеры']

const PROFILE_LOGIN_STORAGE_KEY = 'profileLogin'

function readStoredProfileLogin(): string {
  if (typeof localStorage === 'undefined') return 'orlovoleg'
  try {
    const raw = localStorage.getItem(PROFILE_LOGIN_STORAGE_KEY)
    if (raw === null) return 'orlovoleg'
    return raw
  } catch {
    return 'orlovoleg'
  }
}

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
  const resetRouteDraft = useDashboardStore((state) => state.resetRouteDraft)
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
  const setRouteMode = useDashboardStore((state) => state.setRouteMode)
  const routeMode = useDashboardStore((state) => state.routeMode)

  const [restaurants, setRestaurants] = useState<Restaurant[]>(initialRestaurantsData as Restaurant[])
  const [screen, setScreen] = useState<'dashboard' | 'restaurants' | 'couriers' | 'settings'>('dashboard')
  const [activeTab, setActiveTab] = useState(0)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeRestaurantTab, setActiveRestaurantTab] = useState(0)

  const restaurantTabs = restaurants.map((r) => ({
    label: r.name,
  }))
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof localStorage === 'undefined') return 'dark'
    const saved = localStorage.getItem('theme')
    return saved === 'light' ? 'light' : 'dark'
  })
  const [profileLogin, setProfileLogin] = useState(readStoredProfileLogin)
  /** Вкладка экрана настроек (0…4), синхронизируется с AppSubheader внутри SettingsScreen */
  const [settingsTab, setSettingsTab] = useState(0)

  // Пустой шаблон только в ручном режиме
  useEffect(() => {
    const { routes, routeMode } = useDashboardStore.getState()
    const hasDraft = Object.values(routes).some((r) => r.status === 'draft')
    if (!hasDraft && routeMode === 'manual') {
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

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(PROFILE_LOGIN_STORAGE_KEY, profileLogin)
    } catch {
      /* ignore quota / private mode */
    }
  }, [profileLogin])

  // Синхронизация routeMode и времён pickup/handoff из активного ресторана
  useEffect(() => {
    const restaurant = restaurants[activeRestaurantTab]
    if (!restaurant) return
    setRouteMode(restaurant.routeMode)
    setRouteStageMin('pickup', restaurant.pickupMin)
    setRouteStageMin('handoff', restaurant.handoffMin)
  }, [activeRestaurantTab, restaurants, setRouteMode, setRouteStageMin])

  /** После удаления ресторана из списка не выходим за пределы индексов вкладок */
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- кламп индекса вкладки при изменении длины списка */
    if (restaurants.length === 0) {
      setActiveRestaurantTab(0)
      return
    }
    setActiveRestaurantTab((i) => Math.min(i, restaurants.length - 1))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [restaurants.length])

  const handleRouteModeChange = useCallback(
    (mode: 'auto' | 'manual') => {
      setRouteMode(mode)
      setRestaurants((prev) => {
        const i = activeRestaurantTab
        if (i < 0 || i >= prev.length) return prev
        const next = [...prev]
        next[i] = { ...next[i], routeMode: mode }
        return next
      })
    },
    [activeRestaurantTab, setRouteMode],
  )

  // Сброс классов body при переключении экрана/таба (если остались is-dragging/is-resizing после днд или ресайза)
  useEffect(() => {
    document.body.classList.remove('is-dragging', 'is-resizing')
  }, [screen, activeRestaurantTab])

  const isSettings = screen === 'settings'

  return (
    <div className="app-shell">
      <AppHeader
        tabItems={tabItems}
        activeTab={screen === 'settings' ? -1 : activeTab}
        isMenuOpen={isMenuOpen}
        onMenuToggle={() => setIsMenuOpen((open) => !open)}
        onTabClick={(index) => {
          setIsMenuOpen(false)
          setActiveTab(index)
          if (index === 0) setScreen('dashboard')
          else if (index === 1) setScreen('restaurants')
          else if (index === 2) setScreen('couriers')
          else setScreen('dashboard')
        }}
        isSettingsActive={screen === 'settings'}
        onSettingsClick={() => {
          setIsMenuOpen(false)
          setSettingsTab(0)
          setScreen('settings')
        }}
        onProfileClick={() => {
          setIsMenuOpen(false)
          setSettingsTab(2)
          setScreen('settings')
        }}
        profileLogin={profileLogin}
      />

      {screen === 'dashboard' && activeTab === 0 && (
        <AppSubheader
          tabs={restaurantTabs}
          activeIndex={activeRestaurantTab}
          onTabChange={setActiveRestaurantTab}
        />
      )}

      <main className="app-content">
        {/* Не размонтируем экраны — переключаем видимость, чтобы карта и дашборд не вызывали cleanup при переходе в настройки/табы */}
        <div
          className={`app-content__pane${screen === 'dashboard' && activeRestaurantTab === 0 ? '' : ' app-content__pane--hidden'}`}
          aria-hidden={screen !== 'dashboard' || activeRestaurantTab !== 0}
        >
          <DashboardScreen
            key="dashboard"
            routeMode={routeMode}
            onRouteModeChange={handleRouteModeChange}
            theme={theme}
            orders={orders}
            couriers={couriers}
            routes={routes}
            createRouteDraft={createRouteDraft}
            resetRouteDraft={resetRouteDraft}
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
            Заказы {restaurantTabs[activeRestaurantTab].label}
          </div>
        </div>
        <div
          className={`app-content__pane${screen === 'restaurants' ? '' : ' app-content__pane--hidden'}`}
          aria-hidden={screen !== 'restaurants'}
        >
          <RestaurantsScreen restaurants={restaurants} onRestaurantsChange={setRestaurants} />
        </div>
        <div
          className={`app-content__pane${screen === 'couriers' ? '' : ' app-content__pane--hidden'}`}
          aria-hidden={screen !== 'couriers'}
        >
          <CouriersScreen />
        </div>
        <div
          className={`app-content__pane${isSettings ? '' : ' app-content__pane--hidden'}`}
          aria-hidden={!isSettings}
        >
          <SettingsScreen
            theme={theme}
            onThemeChange={setTheme}
            profileLogin={profileLogin}
            onProfileLoginChange={setProfileLogin}
            activeTab={settingsTab}
            onActiveTabChange={setSettingsTab}
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
