"use client";
import React, { useState, useEffect } from 'react';
import { Inter } from 'next/font/google';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeProvider } from 'next-themes';
import { LayoutDashboard, Users, CalendarDays, MessageSquare, MessageCircle, Shield, LogOut, User, Music, ChevronLeft, Hash, Home, Calendar, Menu, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import NotificationBell from '@/components/NotificationBell';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const MenuIcon = ({ name }: { name: string }) => {
  const iconMap: { [key: string]: React.ReactNode } = {
    dashboard: <LayoutDashboard className="w-5 h-5" />,
    calendar: <Calendar className="w-5 h-5" />,
    team: <Users className="w-5 h-5" />,
    reservation: <CalendarDays className="w-5 h-5" />,
    community: <MessageSquare className="w-5 h-5" />,
    chat: <MessageCircle className="w-5 h-5" />, 
    admin: <Shield className="w-5 h-5" />,
  };
  return iconMap[name] || <Hash className="w-5 h-5" />;
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userTeams, setUserTeams] = useState<any[]>([]);
  
  // 🌟 모바일 사이드바 메뉴 열림/닫힘 상태
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const savedColor = localStorage.getItem('theme-primary');
    if (savedColor) {
      document.documentElement.style.setProperty('--primary', savedColor);
    }

    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (pathname !== '/login' && pathname !== '/signup') router.push('/login');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile) {
        setUserProfile(profile);
        const { data: teams } = await supabase.from('team_members').select('teams(*)').eq('user_id', profile.id);
        if (teams) setUserTeams(teams.map((t: any) => t.teams));
      }
    };

    fetchData();

    const profileSubscription = supabase.channel('layout_profile_channel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        if (userProfile && payload.new.id === userProfile.id) {
          setUserProfile(payload.new);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profileSubscription);
    };
  }, [pathname, userProfile?.id]);

  // 🌟 페이지 이동 시 모바일 메뉴 자동 닫기
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    await supabase.auth.signOut();
    setUserProfile(null); router.push('/login');
  };

  if (pathname === '/login' || pathname === '/signup') { 
    return (
      <html lang="ko" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            {children}
          </ThemeProvider>
        </body>
      </html>
    ); 
  }

  const getPageTitle = () => {
    const navItems = [
      { path: '/', name: '홈' }, 
      { path: '/calendar', name: '동아리 일정' }, 
      { path: '/team', name: '팀 목록' }, 
      { path: '/reservation', name: '합주실 예약' }, 
      { path: '/community', name: '커뮤니티' }, 
      { path: '/chat', name: '메신저' }, 
      { path: '/admin', name: '관리자 데스크' }, 
      { path: '/mypage', name: '마이페이지' }
    ];
    const match = navItems.find(item => item.path === pathname);
    return match ? match.name : 'Blacksaint';
  };

  const isPresident = userProfile?.role === 'president' || userProfile?.role === 'admin'; 

  const navItems = [
    { path: '/', name: '홈', icon: 'dashboard' }, 
    { path: '/calendar', name: '동아리 일정', icon: 'calendar' }, 
    { path: '/team', name: '팀 목록', icon: 'team' }, 
    { path: '/reservation', name: '합주실 예약', icon: 'reservation' }, 
    { path: '/community', name: '커뮤니티', icon: 'community' },
    { path: '/chat', name: '메신저', icon: 'chat' } 
  ];
  if (isPresident) {
    navItems.push({ path: '/admin', name: '관리자 데스크', icon: 'admin' });
  }

  if (pathname === '/admin' && userProfile && !isPresident) {
    router.push('/');
    return null;
  }

  return (
    <html lang="ko" className="h-full" suppressHydrationWarning>
      <body className={`${inter.className} flex h-full overflow-hidden transition-colors duration-300`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          
          {/* PC 사이드바 */}
          <aside className="hidden md:flex w-64 shrink-0 bg-bg-surface border-r border-border-base p-6 flex-col h-full z-20 transition-colors duration-300">
            <div onClick={() => router.push('/')} className="cursor-pointer mb-8 group">
              <h1 className="text-3xl font-black text-primary mb-1 group-hover:brightness-110 transition flex items-center gap-2">
                <Music className="w-7 h-7" /> Blacksaint
              </h1>
              <p className="text-xs text-text-muted">동아리 매니지먼트 데스크</p>
            </div>

            <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
              {navItems.map(item => (
                <button key={item.path} onClick={() => router.push(item.path)} className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition group ${pathname === item.path ? 'bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 shadow-sm' : 'text-text-muted hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-text-base'}`}>
                  <MenuIcon name={item.icon} />
                  {item.name}
                </button>
              ))}
              
              {userTeams.length > 0 && (
                <div className="pt-6 mt-6 border-t border-border-base space-y-2.5 transition-colors">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest pl-2 mb-3">내 소속 팀</h3>
                  {userTeams.map(team => (
                    <button key={team.id} onClick={() => router.push(`/team?id=${team.id}`)} className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-text-muted hover:text-text-base hover:bg-slate-100 dark:hover:bg-slate-800/50 group transition">
                      <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-800 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 flex items-center justify-center overflow-hidden font-bold text-text-muted text-[11px] border border-border-base transition-colors">
                        {team.image_url ? <img src={team.image_url} alt="team" className="w-full h-full object-cover" /> : team.name[0]}
                      </div>
                      <span className="text-sm font-medium line-clamp-1">{team.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </nav>
          </aside>

          {/* 🌟 모바일 사이드바 (햄버거 메뉴 오버레이) */}
          {isMobileMenuOpen && (
            <div className="md:hidden fixed inset-0 z-60 flex">
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
              <aside className="relative w-64 max-w-[80%] bg-bg-surface border-r border-border-base p-6 flex flex-col h-full shadow-2xl animate-in slide-in-from-left duration-300 transition-colors">
                <div className="flex items-center justify-between mb-8">
                  <h1 className="text-2xl font-black text-primary flex items-center gap-2">
                    <Music className="w-6 h-6" /> Blacksaint
                  </h1>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 text-text-muted hover:text-text-base bg-slate-100 dark:bg-slate-800 rounded-lg"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="flex items-center gap-3 mb-6 p-3 bg-bg-base rounded-xl border border-border-base">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold shrink-0">
                    {userProfile?.profile_image_url ? <img src={userProfile.profile_image_url} className="w-full h-full rounded-full object-cover" /> : userProfile?.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-base truncate">{userProfile?.name}</p>
                    <p className="text-[10px] text-text-muted truncate">{userProfile?.session || '세션 미정'}</p>
                  </div>
                </div>

                <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
                  {navItems.map(item => (
                    <button key={item.path} onClick={() => router.push(item.path)} className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition group ${pathname === item.path ? 'bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 shadow-sm' : 'text-text-muted hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-text-base'}`}>
                      <MenuIcon name={item.icon} />
                      {item.name}
                    </button>
                  ))}
                </nav>
                
                <button onClick={handleSignOut} className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-rose-50 dark:bg-rose-500/10 text-rose-500 font-bold rounded-xl border border-rose-100 dark:border-rose-500/20 hover:bg-rose-500 hover:text-white transition">
                  <LogOut className="w-4 h-4" /> 로그아웃
                </button>
              </aside>
            </div>
          )}

          <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-bg-base transition-colors duration-300">
            
            <header className="hidden md:flex h-16 shrink-0 border-b border-border-base items-center justify-between px-6 lg:px-8 bg-bg-surface/80 backdrop-blur-md z-40 relative transition-colors duration-300">
              <div className="flex items-center gap-2">
                {pathname.startsWith('/team/') && pathname.length > 6 && (
                  <button onClick={() => router.push('/team')} className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 text-text-muted hover:text-text-base transition"><ChevronLeft className="w-5 h-5"/></button>
                )}
                <h2 className="text-xl font-bold flex items-center gap-2 text-text-base">
                  {getPageTitle()}
                </h2>
              </div>

              {userProfile ? (
                <div className="flex items-center gap-4">
                  <NotificationBell currentUser={userProfile} />
                  
                  <Link href="/mypage" className="flex items-center gap-3.5 bg-bg-base border border-border-base rounded-full p-1.5 pl-4 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800/50 transition cursor-pointer group">
                    <div className="text-right">
                      <p className="text-sm font-bold text-text-base leading-tight group-hover:text-primary transition">{userProfile.name}</p>
                      <p className="text-[11px] text-text-muted font-medium">{userProfile.session || '세션 미정'}</p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center overflow-hidden font-black text-lg text-white shadow-md group-hover:scale-105 transition-transform border-2 border-transparent group-hover:border-primary/20">
                      {userProfile.profile_image_url ? (
                         <img src={userProfile.profile_image_url} alt="profile" className="w-full h-full object-cover" />
                      ) : (
                         userProfile.name[0]
                      )}
                    </div>
                  </Link>

                  <button onClick={handleSignOut} className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-500 rounded-lg text-xs font-bold text-rose-500 hover:text-white transition">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button onClick={() => router.push('/login')} className="flex items-center gap-2 px-4 py-2 bg-primary rounded-xl text-sm font-bold text-white"><User className="w-4 h-4"/> 로그인</button>
              )}
            </header>

            {/* 🌟 모바일 헤더: 햄버거 메뉴 아이콘 추가됨 */}
            <header className="md:hidden h-14 shrink-0 border-b border-border-base flex items-center justify-between px-4 bg-bg-surface/80 backdrop-blur-md z-40 sticky top-0 transition-colors duration-300">
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsMobileMenuOpen(true)} className="p-1.5 -ml-1 text-text-base hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
                    <Menu className="w-6 h-6" />
                  </button>
                  <h2 className="text-lg font-bold flex items-center gap-2 text-text-base">
                    {getPageTitle()}
                  </h2>
                </div>
                
                {userProfile && (
                  <div className="flex items-center gap-2">
                    <NotificationBell currentUser={userProfile} />
                  </div>
                )}
            </header>

            <main className="flex-1 overflow-auto custom-scrollbar pb-16 md:pb-0">
              {children}
            </main>

            {/* 🌟 모바일 하단 메뉴: 가장 중요한 5개 메뉴만 남겨서 넓고 쾌적하게! */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-bg-surface/95 backdrop-blur-md border-t border-border-base z-50 flex items-center justify-between px-2 pb-safe transition-colors duration-300">
              <Link href="/" className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${pathname === '/' ? 'text-primary' : 'text-text-muted hover:text-text-base'}`}>
                <Home className={`w-5 h-5 ${pathname === '/' ? 'fill-current' : ''}`} />
                <span className="text-[10px] font-bold mt-0.5">홈</span>
              </Link>
              <Link href="/reservation" className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${pathname.startsWith('/reservation') ? 'text-primary' : 'text-text-muted hover:text-text-base'}`}>
                <CalendarDays className={`w-5 h-5 ${pathname.startsWith('/reservation') ? 'fill-current' : ''}`} />
                <span className="text-[10px] font-bold mt-0.5">예약</span>
              </Link>
              <Link href="/community" className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${pathname.startsWith('/community') ? 'text-primary' : 'text-text-muted hover:text-text-base'}`}>
                <MessageSquare className={`w-5 h-5 ${pathname.startsWith('/community') ? 'fill-current' : ''}`} />
                <span className="text-[10px] font-bold mt-0.5">게시판</span>
              </Link>
              <Link href="/chat" className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${pathname.startsWith('/chat') ? 'text-primary' : 'text-text-muted hover:text-text-base'}`}>
                <MessageCircle className={`w-5 h-5 ${pathname.startsWith('/chat') ? 'fill-current' : ''}`} />
                <span className="text-[10px] font-bold mt-0.5">채팅</span>
              </Link>
              <Link href="/mypage" className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${pathname.startsWith('/mypage') ? 'text-primary' : 'text-text-muted hover:text-text-base'}`}>
                <User className={`w-5 h-5 ${pathname.startsWith('/mypage') ? 'fill-current' : ''}`} />
                <span className="text-[10px] font-bold mt-0.5">프로필</span>
              </Link>
            </nav>

          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}