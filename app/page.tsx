"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Megaphone, MessageSquare, Clock, User, Shield, 
  ChevronRight, BarChart3, Bell, Calendar, MapPin, 
  UserPlus, Home, Users, Wrench, CalendarDays, Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// --- 인터페이스 정의 ---
interface Profile { id: string; name: string; student_id: string; session: string; role: string; profile_image_url?: string; }
interface Notice { id: number; title: string; created_at: string; is_important: boolean; icon: 'calendar' | 'wrench'; time_ago: string; author: string; }
// 🚨 만약 Supabase 테이블의 날짜 컬럼명이 'date'가 아니라면 아래와 밑의 코드들을 수정해야 합니다. (예: reservation_date)
interface Upcoming { id: number; team_name: string; date: string; time: string; location: string; image_url: string; }
interface Feed { id: number; type: 'new_member' | 'new_post'; title: string; description: string; time_ago: string; target: string; }

// --- D-Day 계산 함수 ---
const calculateDday = (targetDate: string) => {
  if (!targetDate) return 'D-?'; // 날짜 데이터가 없을 때 표시됩니다.
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 시간 제외 날짜만 비교
  
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'D-DAY';
  if (diffDays > 0) return `D-${diffDays}`;
  return `D+${Math.abs(diffDays)}`; // 지난 일정의 경우
};

export default function DashboardPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) setUserProfile(profile);

        // 2. 다가오는 합주 일정 가져오기
        const { data: upcomingData } = await supabase
          .from('reservations') 
          .select('*')
          .limit(1);
        
        // 🚨 디버깅을 위한 로그 출력 (F12 개발자 도구 콘솔에서 확인하세요!)
        console.log("👉 [Supabase 합주 일정 데이터]:", upcomingData);
        
        if (upcomingData) setUpcoming(upcomingData);

        // 3. 내 팀 소식 가져오기
        const { data: feedsData } = await supabase
          .from('feeds') 
          .select('*')
          .order('id', { ascending: false })
          .limit(5);

        if (feedsData) setFeeds(feedsData);

        // 4. 주요 공지사항 가져오기
        const { data: noticesData } = await supabase
          .from('notices') 
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        if (noticesData) setNotices(noticesData);

      } catch (error) {
        console.error("데이터를 불러오는 중 오류가 발생했습니다:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [router]);

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center bg-bg-base text-text-muted min-h-screen transition-colors duration-300">데이터를 불러오는 중...</div>
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-bg-base text-text-base font-sans pb-24 md:pb-0 overflow-x-hidden transition-colors duration-300">
      
      <header className="md:hidden flex items-center justify-between p-4 sticky top-0 z-30 bg-bg-surface/90 backdrop-blur-md border-b border-border-base transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Link href="/mypage" className="size-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
              {userProfile?.profile_image_url ? (
                <img src={userProfile.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-primary" />
              )}
            </Link>
            <div className="absolute -top-1 -right-1 size-3 bg-emerald-500 rounded-full border-2 border-white dark:border-background-dark transition-colors"></div>
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted">반가워요!</p>
            <h1 className="text-lg font-bold leading-tight text-text-base">안녕하세요, {userProfile?.name || '부원'}님!</h1>
          </div>
        </div>
        <button className="flex size-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 relative transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 size-2 bg-primary rounded-full ring-2 ring-white dark:ring-slate-800 transition-colors"></span>
        </button>
      </header>

      <main className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Section 1: 다가오는 합주 일정 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold tracking-tight text-text-base">다가오는 합주 일정</h3>
            <Link href="/reservation" className="text-primary text-sm font-semibold flex items-center hover:brightness-110 transition">
              전체보기 <ChevronRight className="w-4 h-4 ml-0.5" />
            </Link>
          </div>
          
          {upcoming.length === 0 ? (
            <div className="p-12 text-center bg-bg-surface border border-border-base rounded-4xl text-text-muted flex flex-col items-center justify-center min-h-35 transition-colors shadow-sm dark:shadow-none">
              <CalendarDays className="size-12 mb-4 opacity-30" />
              <p className="font-bold">다가오는 합주 일정이 없습니다.</p>
              <Link href="/reservation" className="text-xs text-primary mt-2 hover:underline">일정 예약하기</Link>
            </div>
          ) : (
            upcoming.map(item => {
              const dDayStr = calculateDday(item.date);
              
              return (
              <div key={item.id} className="relative overflow-hidden rounded-4xl bg-bg-surface border border-border-base shadow-sm dark:shadow-none transition-colors duration-300">
                <div className="h-48 w-full bg-cover bg-center relative" style={{ backgroundImage: `url("${item.image_url}")` }}>
                  <div className="absolute inset-0 bg-linear-to-t from-slate-950/90 dark:from-black/80 to-transparent transition-colors"></div>
                  <div className="absolute bottom-4 left-5 flex items-center gap-2.5">
                    {/* 동적 D-Day 뱃지 */}
                    <span className="px-2.5 py-1 rounded-md bg-primary text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5 shadow-lg">
                        {dDayStr === 'D-DAY' && <span className="size-1.5 bg-white rounded-full animate-pulse"></span>}
                        {dDayStr}
                    </span>
                    <p className="text-xl font-black text-white drop-shadow-md tracking-tight">{item.team_name} 합주</p>
                  </div>
                </div>
                <div className="p-5 lg:p-6">
                  <div className="flex flex-col gap-3">
                    
                    <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-400 font-medium">
                      <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-1.5 rounded-full transition-colors text-sm">
                        <Clock className="w-4 h-4 text-primary" /> 
                        {/* D-DAY 여부에 따라 '오늘' 또는 '날짜' 표시 */}
                        {dDayStr === 'D-DAY' ? '오늘' : item.date || '날짜미상'} {item.time}
                      </div>
                      <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-1.5 rounded-full transition-colors text-sm">
                        <MapPin className="w-4 h-4 text-primary" /> {item.location}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-5 border-t border-border-base transition-colors">
                      <p className="text-xs text-text-muted">합주 시작 10분 전까지 도착해주세요.</p>
                      
                      {/* 👇 쿼리 파라미터로 날짜를 함께 넘겨줍니다. */}
                      <Link href={item.date ? `/reservation?date=${item.date}` : "/reservation"}>
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
          
          {/* ⬅️ 좌측 컬럼: 내 팀 소식 */}
          <div className="lg:col-span-8 space-y-6">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold tracking-tight text-text-base">내 팀 소식</h3>
                <Link href="/team" className="text-text-muted hover:text-primary text-sm font-medium flex items-center gap-0.5 transition-colors">
                  전체보기 <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              
              <div className="space-y-3">
                {feeds.length === 0 ? (
                  <div className="p-8 text-center bg-bg-surface border border-border-base rounded-2xl text-text-muted text-sm flex flex-col items-center transition-colors shadow-sm dark:shadow-none">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                    <p>최근 업데이트된 팀 소식이 없습니다.</p>
                  </div>
                ) : (
                  feeds.map(feed => (
                    <div key={feed.id} className="p-5 rounded-xl bg-bg-surface border border-border-base transition-colors shadow-sm dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer">
                      <div className="flex items-start gap-4">
                        {feed.type === 'new_member' ? (
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center transition-colors border border-slate-200 dark:border-slate-700">
                               <User className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                            </div>
                            <div className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-background-dark flex items-center justify-center transition-colors">
                              <Plus className="w-3 h-3 text-white font-bold" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-12 h-12 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 transition-colors">
                            <MessageSquare className="w-6 h-6" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed text-text-base">
                            <span className="font-bold text-primary">[{feed.title}] </span> 
                            {feed.description}
                          </p>
                          <p className="text-xs text-text-muted mt-1">{feed.time_ago}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 mt-2 shrink-0"/>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* ➡️ 우측 컬럼: 주요 공지사항 */}
          <div className="lg:col-span-4 space-y-6">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold tracking-tight text-text-base">주요 공지사항</h3>
                <Megaphone className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              </div>
              
              <div className="space-y-3">
                {notices.length === 0 ? (
                  <div className="w-full p-6 text-center bg-bg-surface border border-border-base rounded-xl text-text-muted text-sm transition-colors shadow-sm dark:shadow-none">
                    새로운 공지사항이 없습니다.
                  </div>
                ) : (
                  notices.map(notice => (
                    <div key={notice.id} className={`flex items-center gap-4 p-4 rounded-xl bg-bg-surface border ${notice.is_important ? 'border-primary/20 dark:border-primary/30' : 'border-border-base'} shadow-sm dark:shadow-none hover:brightness-105 transition-all cursor-pointer`}>
                      <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${notice.is_important ? 'bg-primary/10 text-primary' : 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500'}`}>
                        {notice.icon === 'calendar' ? <CalendarDays className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${notice.is_important ? 'text-primary' : 'text-text-base'}`}>{notice.title}</p>
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