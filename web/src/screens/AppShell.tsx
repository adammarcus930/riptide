import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Today', end: true },
  { to: '/program', label: 'Program', end: false },
  { to: '/more', label: 'More', end: false },
];

export function AppShell() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <div className="flex-1"><Outlet /></div>
      <nav className="sticky bottom-0 flex border-t border-stroke bg-base pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-[12px] font-bold ${isActive ? 'text-accent' : 'text-ink-faint'}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
