import burgerMenuIcon from '../../assets/burger-menu.svg'
import settingsIcon from '../../assets/Settings.svg'
import exitIcon from '../../assets/Exit.svg'

type AppHeaderProps = {
  tabItems: string[]
  isMenuOpen: boolean
  onMenuToggle: () => void
  onTabClick: () => void
  isDebug: boolean
  onDebugClick: () => void
}

export function AppHeader({
  tabItems,
  isMenuOpen,
  onMenuToggle,
  onTabClick,
  isDebug,
  onDebugClick,
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
            className={index === 0 ? 'tab tab--active' : 'tab'}
            onClick={onTabClick}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="app-header__right">
        <button type="button" className="route-draft__action route-draft__action--icon" aria-label="Настройки">
          <img src={settingsIcon} alt="" aria-hidden />
        </button>
        <button
          type="button"
          className={`route-draft__action app-header__user-btn${isDebug ? ' app-header__user-btn--active' : ''}`}
          onClick={onDebugClick}
        >
          Дебаг
        </button>
        <button type="button" className="route-draft__action app-header__user-btn" aria-label="Выход">
          <img src={exitIcon} alt="" className="app-header__user-icon" width={16} height={16} aria-hidden />
          <span className="app-header__user-name">Попова И.</span>
        </button>
      </div>
    </header>
  )
}
