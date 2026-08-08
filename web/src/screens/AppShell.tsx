import { NavLink, Outlet } from 'react-router-dom';
import { IconBolt, IconList, IconMore } from '../ui/icons';

const tabs = [
  { to: '/', label: 'Today', end: true, Icon: IconBolt },
  { to: '/program', label: 'Program', end: false, Icon: IconList },
  { to: '/more', label: 'More', end: false, Icon: IconMore },
];

export function AppShell() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <div className="flex-1"><Outlet /></div>
      <nav className="sticky bottom-0 flex border-t border-stroke bg-base pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 pb-2 pt-2.5 text-center text-[10px] font-bold ${isActive ? 'text-accent' : 'text-ink-faint'}`
            }
          >
            <Icon className="mx-auto mb-1 h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
