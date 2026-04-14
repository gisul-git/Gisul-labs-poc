'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar';

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isConsole = pathname.startsWith('/console');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;
  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      {!isConsole && <Sidebar />}
      <main className={`flex-1 overflow-y-auto bg-gray-950 ${isConsole ? 'flex flex-col p-0' : 'p-6'}`}>
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <AuthProvider>
      <ProtectedLayout>{children}</ProtectedLayout>
    </AuthProvider>
  );
}
