"use client";
import React, { useState, useEffect, Fragment } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Trash2, AlignLeft, Clock } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../lib/supabase';

interface ClubEvent {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  color: string;
  description: string | null;
  created_by: string;
  profiles?: { name: string; session: string; };
}

const EVENT_COLORS = [
  { name: '기본 (파랑)', hex: '#3B82F6' },
  { name: '중요/공연 (빨강)', hex: '#F43F5E' },
  { name: '정기 회의 (초록)', hex: '#10B981' },
  { name: '행사/MT (노랑)', hex: '#F59E0B' },
  { name: '팀 합주 (보라)', hex: '#8B5CF6' }
];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ClubEvent | null>(null);

  // 폼 상태
  const [newTitle, setNewTitle] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newColor, setNewColor] = useState(EVENT_COLORS[0].hex);
  const [newDesc, setNewDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        setIsAdmin(profile?.role === 'admin' || profile?.role === 'president');
      }
      fetchEvents();
    };
    init();
  }, []);

  const fetchEvents = async () => {
    // 🌟 에러가 났을 때 원인을 파악하기 쉽도록 에러 핸들링 추가
    const { data, error } = await supabase
      .from('club_events')
      .select('*, profiles(name, session)')
      .order('start_date', { ascending: true });
      
    if (error) {
      console.error('일정 불러오기 실패:', error.message);
    } else if (data) {
      setEvents(data as ClubEvent[]);
    }
  };

  // 날짜 계산 헬퍼 함수
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const days = [];
  const prevMonthDays = getDaysInMonth(year, month - 1);
  
  // 이전 달 날짜 채우기
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month - 1, prevMonthDays - i), isCurrentMonth: false });
  }
  // 이번 달 날짜 채우기
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }
  // 다음 달 날짜 채우기 (총 42칸 유지)
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }

  const formatDateString = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleAddEvent = async () => {
    if (!newTitle.trim() || !newStartDate || !newEndDate) return alert('제목과 날짜를 입력해주세요.');
    if (newStartDate > newEndDate) return alert('종료일은 시작일보다 빠를 수 없습니다.');

    setIsSubmitting(true);
    const { error } = await supabase.from('club_events').insert([{
      title: newTitle,
      start_date: newStartDate,
      end_date: newEndDate,
      color: newColor,
      description: newDesc,
      created_by: currentUser.id
    }]);

    setIsSubmitting(false);
    if (error) alert('일정 등록 실패: ' + error.message);
    else {
      setIsAddModalOpen(false);
      setNewTitle(''); setNewDesc('');
      setNewStartDate(''); setNewEndDate('');
      fetchEvents();
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    await supabase.from('club_events').delete().eq('id', id);
    setIsDetailModalOpen(false);
    fetchEvents();
  };

  const handleDayClick = (dateStr: string) => {
    setNewStartDate(dateStr);
    setNewEndDate(dateStr);
    setIsAddModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base text-text-base font-sans overflow-hidden transition-colors duration-300">
      
      <header className="h-16 shrink-0 border-b border-border-base flex items-center justify-between px-6 lg:px-8 bg-bg-surface/80 backdrop-blur-md z-10 transition-colors">
        <h2 className="text-xl font-bold flex items-center gap-2 text-text-base">
          <CalendarIcon className="w-5 h-5 text-primary" /> 동아리 일정
        </h2>
        <button onClick={() => { 
          setNewStartDate(formatDateString(new Date())); 
          setNewEndDate(formatDateString(new Date())); 
          setIsAddModalOpen(true); 
        }} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:brightness-110 text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 transition shrink-0">
          <Plus className="w-4 h-4" /> 신규 일정
        </button>
      </header>

      <main className="flex-1 overflow-auto custom-scrollbar p-4 lg:p-8">
        <div className="max-w-6xl mx-auto bg-bg-surface border border-border-base rounded-2xl shadow-sm dark:shadow-xl overflow-hidden transition-colors flex flex-col h-[80vh] min-h-150">
          
          <div className="flex items-center justify-between p-4 lg:p-6 border-b border-border-base shrink-0">
            <h3 className="text-2xl font-black text-text-base">{year}년 {month + 1}월</h3>
            <div className="flex bg-bg-base p-1 rounded-xl border border-border-base transition-colors shadow-sm">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800/50 text-text-muted rounded-lg transition"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 hover:bg-slate-200 dark:hover:bg-slate-800/50 text-sm font-bold text-text-base rounded-lg transition">오늘</button>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800/50 text-text-muted rounded-lg transition"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border-base shrink-0">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
              <div key={day} className={`py-3 text-center text-xs font-bold uppercase tracking-wider ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-text-muted'}`}>
                {day}
              </div>
            ))}
          </div>

          <div className="flex-1 grid grid-cols-7 grid-rows-6">
            {days.map((dayObj, idx) => {
              const dateStr = formatDateString(dayObj.date);
              const isToday = dateStr === formatDateString(new Date());
              
              // 🌟 현재 칸의 날짜가 일정이 포함되는 기간인지 체크
              const dayEvents = events.filter(e => dateStr >= e.start_date && dateStr <= e.end_date);

              return (
                <div 
                  key={idx} 
                  onClick={() => handleDayClick(dateStr)}
                  className={`border-b border-r border-border-base p-1.5 lg:p-2 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition cursor-pointer flex flex-col
                    ${idx % 7 === 6 ? 'border-r-0' : ''} 
                    ${idx >= 35 ? 'border-b-0' : ''} 
                    ${!dayObj.isCurrentMonth ? 'bg-slate-50/50 dark:bg-bg-base/30' : 'bg-bg-surface'}
                  `}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-xs lg:text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-primary text-white shadow-sm' : 
                        !dayObj.isCurrentMonth ? 'text-text-muted opacity-40' : 
                        idx % 7 === 0 ? 'text-rose-500' : 
                        idx % 7 === 6 ? 'text-blue-500' : 'text-text-base'}
                    `}>
                      {dayObj.date.getDate()}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                    {dayEvents.map(e => {
                      const isStart = dateStr === e.start_date;
                      const isEnd = dateStr === e.end_date;
                      return (
                        <div 
                          key={e.id} 
                          onClick={(ev) => { ev.stopPropagation(); setSelectedEvent(e); setIsDetailModalOpen(true); }}
                          className={`text-[10px] lg:text-xs font-bold px-1.5 py-0.5 truncate transition hover:brightness-110 shadow-sm
                            ${isStart ? 'rounded-l-md ml-1' : '-ml-1.5 lg:-ml-2'} 
                            ${isEnd ? 'rounded-r-md mr-1' : '-mr-1.5 lg:-mr-2'}
                          `}
                          style={{ backgroundColor: e.color, color: '#fff' }}
                        >
                          {e.title}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </main>

      {/* 🌟 일정 등록 모달 */}
      <Transition appear show={isAddModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsAddModalOpen(false)}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl transition-colors">
              <div className="flex justify-between items-center mb-6">
                <Dialog.Title className="text-xl font-bold text-text-base flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-primary" /> 일정 등록</Dialog.Title>
                <button onClick={() => setIsAddModalOpen(false)} className="text-text-muted hover:text-text-base"><X className="w-5 h-5"/></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1.5">일정 제목</label>
                  <input type="text" placeholder="예: 2학기 개강 총회" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full bg-bg-base border border-border-base p-3.5 rounded-xl text-sm outline-none focus:border-primary" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-muted block mb-1.5">시작일</label>
                    <input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} className="w-full bg-bg-base border border-border-base p-3.5 rounded-xl text-sm outline-none focus:border-primary scheme-light dark:scheme-dark" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted block mb-1.5">종료일</label>
                    <input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} className="w-full bg-bg-base border border-border-base p-3.5 rounded-xl text-sm outline-none focus:border-primary scheme-light dark:scheme-dark" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-2">색상 태그</label>
                  <div className="flex flex-wrap gap-2">
                    {EVENT_COLORS.map(color => (
                      <button
                        key={color.hex}
                        onClick={() => setNewColor(color.hex)}
                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 shadow-sm ${newColor === color.hex ? 'border-text-base scale-110 shadow-md' : 'border-transparent'}`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1.5">상세 내용 (선택)</label>
                  <textarea rows={3} placeholder="장소, 준비물 등..." value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full bg-bg-base border border-border-base p-3.5 rounded-xl text-sm outline-none focus:border-primary resize-none custom-scrollbar" />
                </div>
              </div>

              <button onClick={handleAddEvent} disabled={isSubmitting} className="w-full py-4 mt-8 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 transition">
                {isSubmitting ? '저장 중...' : '일정 등록하기'}
              </button>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      {/* 🌟 일정 상세/삭제 모달 */}
      <Transition appear show={isDetailModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsDetailModalOpen(false)}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-8 shadow-2xl transition-colors">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black text-text-base mb-1" style={{ color: selectedEvent?.color }}>{selectedEvent?.title}</h3>
                  <p className="text-text-muted text-xs font-bold uppercase tracking-wider">Event Detail</p>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="text-text-muted hover:text-text-base"><X className="w-6 h-6"/></button>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-text-muted">
                  <Clock className="w-5 h-5 text-text-muted shrink-0" />
                  <span className="font-medium text-sm text-text-base">{selectedEvent?.start_date} {selectedEvent?.start_date !== selectedEvent?.end_date && `~ ${selectedEvent?.end_date}`}</span>
                </div>
                
                {selectedEvent?.description && (
                  <div className="flex items-start gap-3 text-text-muted bg-bg-base p-4 rounded-xl border border-border-base">
                    <AlignLeft className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
                    <span className="text-sm text-text-base whitespace-pre-wrap">{selectedEvent.description}</span>
                  </div>
                )}

                <div className="text-xs text-text-muted border-t border-border-base pt-4 mt-4">
                  등록자: <span className="font-bold">{selectedEvent?.profiles?.name} ({selectedEvent?.profiles?.session})</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {(isAdmin || selectedEvent?.created_by === currentUser?.id) ? (
                  <button onClick={() => selectedEvent && handleDeleteEvent(selectedEvent.id)} className="w-full py-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500 border border-rose-200 dark:border-rose-500/20 rounded-xl font-bold hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500 transition flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" /> 일정 삭제
                  </button>
                ) : (
                  <div className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-text-muted rounded-xl font-bold text-center text-sm border border-border-base">
                    관리자 또는 작성자만 삭제할 수 있습니다.
                  </div>
                )}
                <button onClick={() => setIsDetailModalOpen(false)} className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-text-muted hover:text-text-base rounded-xl font-bold mt-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition">닫기</button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

    </div>
  );
}