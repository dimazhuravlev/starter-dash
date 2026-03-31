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
        <Tooltip title="Настройки">
          <button type="button" className="route-draft__action route-draft__action--icon" aria-label="Настройки">
            <span className="app-header__icon" style={{ ['--icon-src' as string]: `url(${settingsIcon})` }} aria-hidden />
          </button>
        </Tooltip>
        <button
          type="button"
          className={`route-draft__action app-header__user-btn${theme === 'light' ? ' app-header__user-btn--active' : ''}`}
          onClick={onThemeToggle}
          aria-pressed={theme === 'light'}
          aria-label="Переключить тему"
        >
          Тема
        </button>
        <button
          type="button"
          className={`route-draft__action app-header__user-btn${isDebug ? ' app-header__user-btn--active' : ''}`}
          onClick={onDebugClick}
        >
          Дебаг
        </button>
        <Tooltip title="Выход">
          <button type="button" className="route-draft__action app-header__user-btn" aria-label="Выход">
            <span className="app-header__user-icon" style={{ ['--icon-src' as string]: `url(${exitIcon})` }} aria-hidden />
            <span className="app-header__user-name">Попова И.</span>
          </button>
        </Tooltip>
      </div>
    </header>
  )
}
