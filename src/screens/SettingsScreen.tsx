import { useEffect, useState } from 'react'
import infoIcon from '../assets/Info.svg'
import plusIcon from '../assets/Plus.svg'
import minusIcon from '../assets/Minus.svg'
import doneIcon from '../assets/Done.svg'
import { AppSubheader } from '../shared/ui/AppSubheader'
import { Tooltip } from '../shared/ui/Tooltip'
import { PrimaryButton } from '../shared/ui/PrimaryButton'
import { TextField } from '../shared/ui/TextField'
import { DebugPanelScreen, type DebugPanelScreenProps } from './DebugPanelScreen'
import {
  DELIVERY_MAX_ORDERS_STORAGE_KEY,
  readDeliveryMaxOrdersFromStorage,
} from '../utils/deliveryMaxOrders'

const settingsTabs = [
  { label: 'Интерфейс' },
  { label: 'Доставка' },
  { label: 'Профиль' },
  { label: 'О сервисе' },
  { label: 'Дебаг' },
]

const maxOrdersInRouteTooltipContent = (
  <div className="tooltip-rich">
    <p className="tooltip-rich__desc">
      Ограничение для автоназначения: система не добавит курьеру больше заказов в один маршрут, чем
      указано
    </p>
  </div>
)

export type SettingsScreenProps = Omit<DebugPanelScreenProps, 'embedded'> & {
  theme: 'dark' | 'light'
  onThemeChange: (theme: 'dark' | 'light') => void
  profileLogin: string
  onProfileLoginChange: (login: string) => void
  /** Активная вкладка подзаголовка настроек (синхронизация с App) */
  activeTab: number
  onActiveTabChange: (index: number) => void
}

export function SettingsScreen({
  theme,
  onThemeChange,
  profileLogin,
  onProfileLoginChange,
  activeTab,
  onActiveTabChange,
  ...debugProps
}: SettingsScreenProps) {
  const [maxOrders, setMaxOrders] = useState(readDeliveryMaxOrdersFromStorage)
  const [phone, setPhone] = useState('+7 960 238 0943')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(DELIVERY_MAX_ORDERS_STORAGE_KEY, JSON.stringify(maxOrders))
    } catch {
      /* ignore quota / private mode */
    }
  }, [maxOrders])

  return (
    <div className="settings-screen">
      <div className="settings-screen__scroll">
        <div className="settings-screen__max">
          <div className="settings-screen__header-block">
            <h1 className="settings-screen__title">Настройки</h1>
            <div className="settings-screen__subheader">
              <AppSubheader tabs={settingsTabs} activeIndex={activeTab} onTabChange={onActiveTabChange} />
            </div>
          </div>

          {activeTab === 0 ? (
            <section className="settings-screen__card settings-screen__card--interface" aria-labelledby="settings-interface-heading">
              <h2 id="settings-interface-heading" className="visually-hidden">
                Интерфейс
              </h2>
              <div className="settings-screen__theme-row settings-screen__theme-row--solo">
                <span className="settings-screen__row-label">Цветовая тема</span>
                <div className="settings-screen__theme-toggle" role="group" aria-label="Цветовая тема">
                  <button
                    type="button"
                    className={`settings-screen__theme-option${theme === 'dark' ? ' settings-screen__theme-option--active' : ''}`}
                    onClick={() => onThemeChange('dark')}
                  >
                    Тёмная
                  </button>
                  <button
                    type="button"
                    className={`settings-screen__theme-option${theme === 'light' ? ' settings-screen__theme-option--active' : ''}`}
                    onClick={() => onThemeChange('light')}
                  >
                    Светлая
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === 1 ? (
            <section className="settings-screen__card" aria-labelledby="settings-delivery-heading">
              <h2
                id="settings-delivery-heading"
                className="settings-screen__card-title settings-screen__card-title--headline-2 settings-screen__card-title--row"
              >
                <Tooltip
                  content={maxOrdersInRouteTooltipContent}
                  offsetX={4}
                  offsetY={12}
                  portalClassName="tooltip--w280"
                >
                  <>
                    <span className="settings-screen__card-title-text">Максимум заказов в маршруте</span>
                    <span
                      className="settings-screen__title-info-icon"
                      style={{ ['--info-icon' as string]: `url(${infoIcon})` }}
                      aria-hidden
                    />
                  </>
                </Tooltip>
              </h2>

              <div className="settings-screen__stepper-table">
                <SettingsStepperRow
                  label="Пеший курьера"
                  value={maxOrders.walk}
                  onDecrement={() =>
                    setMaxOrders((m) => ({ ...m, walk: Math.max(1, m.walk - 1) }))
                  }
                  onIncrement={() => setMaxOrders((m) => ({ ...m, walk: m.walk + 1 }))}
                />
                <SettingsStepperRow
                  label="Курьера на велосипеде или мопеде"
                  value={maxOrders.bike}
                  onDecrement={() =>
                    setMaxOrders((m) => ({ ...m, bike: Math.max(1, m.bike - 1) }))
                  }
                  onIncrement={() => setMaxOrders((m) => ({ ...m, bike: m.bike + 1 }))}
                />
                <SettingsStepperRow
                  label="Курьер на машине"
                  value={maxOrders.car}
                  onDecrement={() =>
                    setMaxOrders((m) => ({ ...m, car: Math.max(1, m.car - 1) }))
                  }
                  onIncrement={() => setMaxOrders((m) => ({ ...m, car: m.car + 1 }))}
                />
              </div>
            </section>
          ) : null}

          {activeTab === 2 ? (
            <section className="settings-screen__card" aria-labelledby="settings-profile-heading">
              <h2 id="settings-profile-heading" className="visually-hidden">
                Профиль
              </h2>
              <TextField
                className="settings-screen__profile-field"
                label="Логин"
                type="text"
                value={profileLogin}
                onChange={(e) => onProfileLoginChange(e.target.value)}
                autoComplete="username"
              />
              <TextField
                className="settings-screen__profile-field"
                label="Телефон"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
              <TextField
                className="settings-screen__profile-field"
                label="Новый пароль"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••"
              />

              <PrimaryButton variant="default" className="settings-screen__save" iconStart={doneIcon}>
                Сохранить
              </PrimaryButton>
            </section>
          ) : null}

          {activeTab === 3 ? (
            <section
              className="settings-screen__card settings-screen__card--about"
              aria-labelledby="settings-documents-heading"
            >
              <h2 id="settings-documents-heading" className="settings-screen__documents-title">
                Документы
              </h2>
              <a
                className="settings-screen__documents-link"
                href="https://starterapp.ru/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="settings-screen__documents-link-text">Политика конфиденциальности</span>
                <ExternalLinkIcon className="settings-screen__documents-link-icon" />
              </a>
            </section>
          ) : null}

          {activeTab === 4 ? (
            <section className="settings-screen__debug" aria-labelledby="settings-debug-heading">
              <h2 id="settings-debug-heading" className="visually-hidden">
                Дебаг
              </h2>
              <DebugPanelScreen {...debugProps} embedded />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M11.884 4.51303L4.45941 11.9377"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.2377 9.81633V4.15948H6.58081"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SettingsStepperRow({
  label,
  value,
  onDecrement,
  onIncrement,
}: {
  label: string
  value: number
  onDecrement: () => void
  onIncrement: () => void
}) {
  return (
    <div className="settings-screen__stepper-row">
      <span className="settings-screen__row-label">{label}</span>
      <div className="settings-screen__stepper">
        <button type="button" className="settings-screen__stepper-btn" onClick={onDecrement} aria-label="Уменьшить">
          <span className="icon" style={{ ['--icon-src' as string]: `url(${minusIcon})` }} />
        </button>
        <span className="settings-screen__stepper-value">{value}</span>
        <button type="button" className="settings-screen__stepper-btn" onClick={onIncrement} aria-label="Увеличить">
          <span className="icon" style={{ ['--icon-src' as string]: `url(${plusIcon})` }} />
        </button>
      </div>
    </div>
  )
}
