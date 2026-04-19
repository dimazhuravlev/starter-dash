import { useEffect, useRef } from 'react'
import burgerMenuIcon from '../../assets/burger-menu.svg'
import crossIcon from '../../assets/Cross.svg'
import settingsIcon from '../../assets/Settings.svg'
import exitIcon from '../../assets/Exit.svg'
import { Tooltip } from './Tooltip'

type AppHeaderProps = {
  tabItems: string[]
  /** Индекс активной вкладки; `-1` — ни один пункт не подсвечен (например, открыты настройки) */
  activeTab: number
  isMenuOpen: boolean
  onMenuToggle: () => void
  onTabClick: (index: number) => void
  isSettingsActive: boolean
  onSettingsClick: () => void
  /** Открыть настройки на вкладке «Профиль» */
  onProfileClick: () => void
  /** Логин из настроек профиля */
  profileLogin: string
}

export function AppHeader({
  tabItems,
  activeTab,
  isMenuOpen,
  onMenuToggle,
  onTabClick,
  isSettingsActive,
  onSettingsClick,
  onProfileClick,
  profileLogin,
}: AppHeaderProps) {
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isMenuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (headerRef.current?.contains(e.target as Node)) return
      onMenuToggle()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isMenuOpen, onMenuToggle])

  return (
    <>
      <header ref={headerRef} className={`app-header${isMenuOpen ? ' app-header--menu-open' : ''}`}>
        <div className={`app-header__overlay${isMenuOpen ? ' app-header__overlay--visible' : ''}`} aria-hidden />
        <button
          type="button"
          className="app-header__burger"
          aria-label={isMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={isMenuOpen}
          onClick={onMenuToggle}
        >
          <img src={isMenuOpen ? crossIcon : burgerMenuIcon} alt="" />
        </button>
        <div className="app-header__tabs">
          {tabItems.map((label, index) => (
            <button
              key={label}
              type="button"
              className={index === activeTab ? 'tab tab--active' : 'tab'}
              onClick={() => onTabClick(index)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="app-header__right">
          <div className="app-header__user-actions">
            <button
              type="button"
              className="app-header__user-name app-header__user-name--clickable"
              onClick={onProfileClick}
              aria-label="Профиль: открыть настройки"
            >
              {profileLogin.trim() || '—'}
            </button>
            <div className="app-header__icon-actions">
              <Tooltip title="Настройки">
                <button
                  type="button"
                  className={`app-header__circle-btn${isSettingsActive ? ' app-header__circle-btn--active' : ''}`}
                  aria-label="Настройки"
                  aria-pressed={isSettingsActive}
                  onClick={onSettingsClick}
                >
                  <span
                    className="app-header__circle-btn-icon"
                    style={{ ['--icon-src' as string]: `url(${settingsIcon})` }}
                    aria-hidden
                  />
                </button>
              </Tooltip>
              <Tooltip title="Выход">
                <button
                  type="button"
                  className="route-draft__action route-draft__action--icon app-header__exit-btn"
                  aria-label="Выход"
                >
                  <span
                    className="route-draft__action-icon"
                    style={{ ['--icon-src' as string]: `url(${exitIcon})` }}
                    aria-hidden
                  />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
