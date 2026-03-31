import { useEffect, useRef, useState } from 'react'
import burgerMenuIcon from '../../assets/burger-menu.svg'
import settingsIcon from '../../assets/Settings.svg'
import exitIcon from '../../assets/Exit.svg'
import { Tooltip } from './Tooltip'

type AppHeaderProps = {
  tabItems: string[]
  activeTab: number
  isMenuOpen: boolean
  onMenuToggle: () => void
  onTabClick: (index: number) => void
  isDebug: boolean
  onDebugClick: () => void
  theme: 'dark' | 'light'
  onThemeToggle: () => void
}

export function AppHeader({
  tabItems,
  activeTab,
  isMenuOpen,
  onMenuToggle,
  onTabClick,
  isDebug,
  onDebugClick,
  theme,
  onThemeToggle,
}: AppHeaderProps) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!profileMenuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (profileWrapRef.current?.contains(e.target as Node)) return
      setProfileMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [profileMenuOpen])

  return (
    <header className={`app-header${isMenuOpen ? ' app-header--menu-open' : ''}`}>
      <button
        type="button"
        className="app-header__burger"
        aria-label="Открыть меню"
        aria-expanded={isMenuOpen}
        onClick={onMenuToggle}
      >
        <img src={burgerMenuIcon} alt="" />
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
        <button
          type="button"
          className={`route-draft__action app-header__user-btn${isDebug ? ' app-header__user-btn--active' : ''}`}
          onClick={onDebugClick}
        >
          Дебаг
        </button>
        <div className="app-header__profile-wrap" ref={profileWrapRef}>
          <button
            type="button"
            className={`route-draft__action app-header__user-btn${profileMenuOpen ? ' app-header__user-btn--active' : ''}`}
            aria-label="Профиль"
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
            onClick={() => setProfileMenuOpen((open) => !open)}
          >
            <span className="app-header__icon" style={{ ['--icon-src' as string]: `url(${settingsIcon})` }} aria-hidden />
            <span className="app-header__user-name">Попова И.</span>
          </button>
          {profileMenuOpen ? (
            <div className="app-header__dropdown" role="menu">
              <button
                type="button"
                className={`app-header__dropdown-item${theme === 'light' ? ' app-header__dropdown-item--active' : ''}`}
                role="menuitem"
                aria-pressed={theme === 'light'}
                onClick={() => {
                  onThemeToggle()
                  setProfileMenuOpen(false)
                }}
              >
                Тема
              </button>
            </div>
          ) : null}
        </div>
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
    </header>
  )
}
