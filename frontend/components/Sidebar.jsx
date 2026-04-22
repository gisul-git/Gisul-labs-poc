'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { href: '/',       label: 'Dashboard', icon: '⊞' },
  { href: '/create', label: 'Create VM',  icon: '+' },
  { href: '/labs',   label: 'Labs',       icon: '🧪' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="px-5 py-4 border-b border-gray-800">
        <span className="text-lg font-bold text-brand-500">VM Manager</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(item => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-brand-500/20 text-brand-500 font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`}>
              <span>{item.icon}</span>{item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-500 mb-2 truncate">{user?.username}</p>
        <button onClick={handleLogout} className="btn-ghost w-full justify-center text-xs">Logout</button>
      </div>
    </aside>
  );
}
