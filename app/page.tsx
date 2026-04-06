"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Megaphone, MessageSquare, Clock, User, Shield, 
  ChevronRight, BarChart3, Bell, Calendar, MapPin, 
  UserPlus, Home, Users, Wrench, CalendarDays, Plus, Mic, Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Profile { id: string; name: string; student_id: string; session: string; role: string; profile_image_url?: string; }
interface Notice { id: number; title: string; created_at: string; is_important: boolean; icon: 'calendar' | 'wrench'; time_ago: string; author: string; }
interface Feed { id: number; type: string; title: string; description: string; time_ago: string; target: string; }

interface Upcoming { 
  id: number; 
  reservation_date: string; 
  start_time: string; 
  end_time: string;
  teams?: { name: string; team_color?: string }; 
}

const calculateDday = (targetDate: string) => {
  if (!targetDate) return 'D-?';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'D-DAY';
  if (diffDays > 0) return `D-${diffDays}`;
  return `D+${Math.abs(diffDays)}`;
};

export default function DashboardPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [currentLive, setCurrentLive] = useState<Upcoming | null>(null);
  const [remainingMinutes, setRemainingMinutes] = useState<number>(0);

  const [upcoming, setUpcoming] = useState<Upcoming[]>([]); 
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/login');
        return;
      }

      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (profile) setUserProfile(profile);

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        const { data: liveData } = await supabase
          .from('reservations')
          .select('*, teams(name, team_color)')
          .eq('reservation_date', todayStr);

        if (liveData) {
          const active = liveData.find((res: any) => {
            const start = new Date(res.start_time);
            const end = new Date(res.end_time);
            return now >= start && now < end;
          });

          if (active) {
            setCurrentLive(active);
            const end = new Date(active.end_time);
            setRemainingMinutes(Math.floor((end.getTime() - now.getTime()) / 60000));
          } else {
            setCurrentLive(null);
          }
        }

        const { data: myTeamsData } = await supabase.from('team_members').select('team_id').eq('user_id', session.user.id);
        const myTeamIds = myTeamsData ? myTeamsData.map(t => t.team_id) : [];

        if (myTeamIds.length > 0) {
          const { data: upcomingData } = await supabase
            .from('reservations') 
            .select('*, teams(name)')
            .in('team_id', myTeamIds)
            .gte('reservation_date', todayStr)
            .order('reservation_date', { ascending: true })
            .order('start_time', { ascending: true })
            .limit(1);
          
          if (upcomingData && upcomingData.length > 0) {
             const nextUpcoming = upcomingData.filter(u => u.id !== currentLive?.id);
             setUpcoming(nextUpcoming.length > 0 ? nextUpcoming : upcomingData);
          } else {
             setUpcoming([]);
          }

          const { data: teamPostsData } = await supabase
            .from('posts')
            .select('*, teams(name)')
            .in('team_id', myTeamIds)
            .order('created_at', { ascending: false })
            .limit(5);

          if (teamPostsData) {
            const mappedFeeds = teamPostsData.map(post => ({
              id: post.id,
              type: 'new_post',
              title: post.title,
              // 🌟 띄어쓰기(&nbsp;) 정화 로직 적용
              description: post.content.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').substring(0, 40) + '...',
              time_ago: new Date(post.created_at).toLocaleDateString(),
              target: post.teams?.name || '내 팀'
            }));
            setFeeds(mappedFeeds);
          }

        } else {
          setUpcoming([]);
          setFeeds([]);
        }

        const { data: noticesData } = await supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(5);
        if (noticesData) setNotices(noticesData);

      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [router, currentLive?.id]);

  useEffect(() => {
    if (!currentLive) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const end = new Date(currentLive.end_time);
      const diff = Math.floor((end.getTime() - now.getTime()) / 60000);
      
      if (diff < 0) {
         setCurrentLive(null); 
      } else {
         setRemainingMinutes(diff);
      }
    }, 60000);
    
    return () => clearInterval(interval);
  }, [currentLive]);

  if (isLoading) return <div className="flex-1 flex items-center justify-center bg-bg-base text-text-muted min-h-screen">데이터를 불러오는 중...</div>

  const defaultImage = "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?q=80&w=1000&auto=format&fit=crop";
  const defaultLocation = "제 1 합주실";

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-bg-base text-text-base font-sans pb-24 md:pb-0 overflow-x-hidden">
      
      <header className="md:hidden flex items-center justify-between p-4 sticky top-0 z-30 bg-bg-surface/90 backdrop-blur-md border-b border-border-base">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Link href="/mypage" className="size-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
              {userProfile?.profile_image_url ? (
                <img src={userProfile.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-primary" />
              )}
            </Link>
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted">반가워요!</p>
            <h1 className="text-lg font-bold leading-tight">안녕하세요, {userProfile?.name || '부원'}님!</h1>
          </div>
        </div>
        <button className="flex size-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 relative">
          <Bell className="w-5 h-5" />
        </button>
      </header>

      <main className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto w-full space-y-8">
        
        {currentLive && (
          <div className="relative overflow-hidden rounded-3xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 shadow-sm transition-colors">
            <div className="p-5 md:p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 animate-pulse shrink-0">
                  <Mic className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500 text-white uppercase tracking-widest">Live</span>
                    <h3 className="text-lg md:text-xl font-black text-emerald-700 dark:text-emerald-400 leading-tight">
                      {currentLive.teams?.name} 합주 중! 🔥
                    </h3>
                  </div>
                  <p className="text-xs md:text-sm text-emerald-600 dark:text-emerald-400/80 font-medium">
                    📍 {defaultLocation} &nbsp;|&nbsp; ⏰ {new Date(currentLive.start_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} ~ {new Date(currentLive.end_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} 
                    <span className="ml-1.5 font-bold text-emerald-500">(종료까지 {remainingMinutes}분 남음)</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold tracking-tight">다가오는 내 합주 일정</h3>
            <Link href="/reservation" className="text-primary text-sm font-semibold flex items-center hover:brightness-110">
              전체보기 <ChevronRight className="w-4 h-4 ml-0.5" />
            </Link>
          </div>
          
          {upcoming.length === 0 ? (
            <div className="p-12 text-center bg-bg-surface border border-border-base rounded-4xl text-text-muted flex flex-col items-center justify-center min-h-35 shadow-sm">
              <CalendarDays className="size-12 mb-4 opacity-30" />
              <p className="font-bold">다가오는 합주 일정이 없습니다.</p>
              <Link href="/reservation" className="text-xs text-primary mt-2 hover:underline">일정 예약하기</Link>
            </div>
          ) : (
            upcoming.map(item => {
              const dDayStr = calculateDday(item.reservation_date);
              const teamName = item.teams?.name || '알 수 없는';
              
              const timeStr = item.start_time 
                ? new Date(item.start_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) 
                : '시간미상';

              return (
              <div key={item.id} className="relative overflow-hidden rounded-4xl bg-bg-surface border border-border-base shadow-sm">
                <div className="h-48 w-full bg-cover bg-center relative" style={{ backgroundImage: `url("${defaultImage}")` }}>
                  <div className="absolute inset-0 bg-linear-to-t from-slate-950/90 dark:from-black/80 to-transparent"></div>
                  <div className="absolute bottom-4 left-5 flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-md bg-primary text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5 shadow-lg">
                        {dDayStr === 'D-DAY' && <span className="size-1.5 bg-white rounded-full animate-pulse"></span>}
                        {dDayStr}
                    </span>
                    <p className="text-xl font-black text-white drop-shadow-md tracking-tight">{teamName} 합주</p>
                  </div>
                </div>
                <div className="p-5 lg:p-6">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-400 font-medium">
                      <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-1.5 rounded-full text-sm">
                        <Clock className="w-4 h-4 text-primary" /> 
                        {dDayStr === 'D-DAY' ? '오늘' : item.reservation_date} {timeStr}
                      </div>
                      <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-1.5 rounded-full text-sm">
                        <MapPin className="w-4 h-4 text-primary" /> {defaultLocation}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-5 border-t border-border-base">
                      <p className="text-xs text-text-muted">합주 시작 10분 전까지 도착해주세요.</p>
                      <Link href={`/reservation?date=${item.reservation_date}`}>
                        <button className="bg-primary hover:brightness-110 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all text-sm">
                          상세보기
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )})
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10 pt-4">
          <div className="lg:col-span-8 space-y-6">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold tracking-tight">내 팀 소식 </h3>
                <Link href="/community" className="text-text-muted hover:text-primary text-sm font-medium flex items-center gap-0.5">커뮤니티 가기 <ChevronRight className="w-4 h-4" /></Link>
              </div>
              <div className="space-y-3">
                {feeds.length === 0 ? (
                  <div className="p-8 text-center bg-bg-surface border border-border-base rounded-2xl text-text-muted text-sm flex flex-col items-center">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-30" /><p>최근 올라온 팀 전용 게시글이 없습니다.</p>
                  </div>
                ) : (
                  feeds.map(feed => (
                    <Link key={feed.id} href="/community" className="block p-5 rounded-xl bg-bg-surface border border-border-base shadow-sm hover:border-emerald-500/50 cursor-pointer transition-colors group">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 transition-colors">
                          <Lock className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed text-text-base">
                            <span className="font-bold text-emerald-500">[{feed.target}]</span> <span className="font-bold ml-1">{feed.title}</span> 
                            <span className="block mt-1 text-text-muted text-xs truncate">{feed.description}</span>
                          </p>
                          <p className="text-[10px] text-text-muted mt-1.5 font-medium">{feed.time_ago}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 mt-3 shrink-0 group-hover:text-emerald-500 transition-colors"/>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold tracking-tight">주요 공지사항</h3>
                <Megaphone className="w-5 h-5 text-slate-400" />
              </div>
              <div className="space-y-3">
                {notices.length === 0 ? (
                  <div className="w-full p-6 text-center bg-bg-surface border border-border-base rounded-xl text-text-muted text-sm">새로운 공지사항이 없습니다.</div>
                ) : (
                  notices.map(notice => (
                    <div key={notice.id} className={`flex items-center gap-4 p-4 rounded-xl bg-bg-surface border ${notice.is_important ? 'border-primary/20' : 'border-border-base'} shadow-sm cursor-pointer`}>
                      <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${notice.is_important ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-600'}`}>
                        {notice.icon === 'calendar' ? <CalendarDays className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${notice.is_important ? 'text-primary' : ''}`}>{notice.title}</p>
                        <p className="text-xs text-text-muted mt-0.5">{notice.time_ago} • {notice.author}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}