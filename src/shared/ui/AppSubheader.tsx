type TabItem = { label: string }

type AppSubheaderProps = {
  tabs: TabItem[]
  activeIndex: number
  onTabChange: (index: number) => void
}

export function AppSubheader({ tabs, activeIndex, onTabChange }: AppSubheaderProps) {
  return (
    <div className="app-subheader">
      <div className="app-subheader__tabs">
        {tabs.map(({ label }, index) => (
          <button
            key={label}
            type="button"
            className={`app-subheader__tab${index === activeIndex ? ' app-subheader__tab--active' : ''}`}
            onClick={() => onTabChange(index)}
          >
            <span className="app-subheader__tab-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
