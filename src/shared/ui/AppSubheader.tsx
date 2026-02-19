type TabItem = { label: string; count: number }

type AppSubheaderProps = {
  tabs: TabItem[]
  activeIndex: number
  onTabChange: (index: number) => void
}

export function AppSubheader({ tabs, activeIndex, onTabChange }: AppSubheaderProps) {
  return (
    <div className="app-subheader">
      <div className="app-subheader__tabs">
        {tabs.map(({ label, count }, index) => (
          <button
            key={`${label}-${count}`}
            type="button"
            className={`app-subheader__tab${index === activeIndex ? ' app-subheader__tab--active' : ''}`}
            onClick={() => onTabChange(index)}
          >
            <span className="app-subheader__tab-label">{label}, {count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
