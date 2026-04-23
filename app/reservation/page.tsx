"use client";
import React, { useState, useEffect, Fragment, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, ChevronLeft, ChevronRight, X, Trash2, Clock, Calendar as CalendarIcon, AlertCircle, Edit2 } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../lib/supabase';

interface Team { id: number; name: string; }
interface Booking {
  id: number;
  dayIndex: number;
  start: number;
  duration: number;
  team: string;
  team_id: number;
  teamColor: string; 
  fullDate: string;
  series_id: string | null;
}

function TimetableContent() {
  const searchParams = useSearchParams();
  const queryDate = searchParams.get('date');

  const [isOpen, setIsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeamIds, setMyTeamIds] = useState<number[]>([]); 
  const [isAdmin, setIsAdmin] = useState(false); 
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null); // 🌟 스크롤 제어를 위한 Ref
  
  const [currentViewDate, setCurrentViewDate] = useState(() => {
    return queryDate ? new Date(queryDate) : new Date();
  });
  
  const [teamId, setTeamId] = useState('');
  const [date, setDate] = useState(''); 
  const [startTime, setStartTime] = useState<number>(8);
  const [endTime, setEndTime] = useState<number>(10);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [dragState, setDragState] = useState<{ isDragging: boolean, date: string | null, start: number | null, end: number | null }>({
    isDragging: false, date: null, start: null, end: null,
  });

  const hours = Array.from({ length: 15 }, (_, i) => i + 8); 
  const timeSlots = Array.from({ length: 29 }, (_, i) => 8 + i * 0.5);

  const formatDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeToString = (time: number) => {
    const h = Math.floor(time).toString().padStart(2, '0');
    const m = time % 1 === 0 ? '00' : '30';
    return `${h}:${m}`;
  };

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      setIsAdmin(profile?.role === 'admin' || profile?.role === 'president');
      const { data: myTeamsData } = await supabase.from('team_members').select('team_id').eq('user_id', session.user.id);
      if (myTeamsData) setMyTeamIds(myTeamsData.map(t => t.team_id));
      const { data: myTeamsDetail } = await supabase.from('team_members').select('teams(id, name)').eq('user_id', session.user.id);
      if (myTeamsDetail) {
        const uniqueTeams = Array.from(new Map(myTeamsDetail.map((item: any) => item.teams).filter(Boolean).map((t: any) => [t.id, t])).values());
        setTeams(uniqueTeams as Team[]);
      }
    }
    const { data: resData } = await supabase.from('reservations').select('*, teams(name, team_color)');
    if (resData) {
      const formatted = resData.map((res: any) => {
        const start = new Date(res.start_time);
        const end = new Date(res.end_time);
        return {
          id: res.id,
          dayIndex: start.getDay() === 0 ? 6 : start.getDay() - 1,
          start: start.getHours() + start.getMinutes() / 60,
          duration: (end.getTime() - start.getTime()) / (1000 * 60 * 60),
          team: res.teams?.name || '삭제된 팀',
          team_id: res.team_id,
          teamColor: res.teams?.team_color || '#3B82F6', 
          fullDate: res.reservation_date,
          series_id: res.series_id
        };
      });
      setBookings(formatted);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // 🌟 [핵심] 가장 앞선 일정 시간대로 자동 스크롤 로직
  useEffect(() => {
    if (bookings.length > 0 && scrollContainerRef.current) {
      const weekRange = weekDays.map(wd => wd.fullDate);
      const currentWeekBookings = bookings.filter(b => weekRange.includes(b.fullDate));
      
      let targetHour = 12; // 예약이 없을 때 기본값 (낮 12시)
      
      if (currentWeekBookings.length > 0) {
        // 이번 주 일정 중 가장 숫자가 작은(빠른) 시간을 찾음
        targetHour = Math.min(...currentWeekBookings.map(b => b.start));
      }

      // 시간당 높이 5rem (80px) 기준으로 스크롤 이동
      const scrollOffset = (targetHour - 8) * 80;
      scrollContainerRef.current.scrollTo({ top: scrollOffset, behavior: 'smooth' });
    }
  }, [bookings, currentViewDate]);

  const resetForm = () => {
    setTeamId(''); setStartTime(8); setEndTime(10); setIsRecurring(false); setRecurringEndDate(''); setIsEditing(false); setEditId(null);
  };

  const handleOpenEdit = () => {
    if (!selectedBooking) return;
    setTeamId(selectedBooking.team_id.toString());
    setDate(selectedBooking.fullDate);
    setStartTime(selectedBooking.start);
    setEndTime(selectedBooking.start + selectedBooking.duration);
    setIsEditing(true); setEditId(selectedBooking.id); setIsDetailOpen(false); setIsOpen(true);
  };

  const handleDeleteBooking = async (type: 'single' | 'series') => {
    if (!selectedBooking) return;
    const confirmMsg = type === 'series' ? '이 정기 예약의 모든 일정을 취소하시겠습니까?' : '이 일정만 취소하시겠습니까?';
    if (!confirm(confirmMsg)) return;
    let query = supabase.from('reservations').delete();
    if (type === 'series' && selectedBooking.series_id) query = query.eq('series_id', selectedBooking.series_id);
    else query = query.eq('id', selectedBooking.id);
    const { error } = await query;
    if (error) alert('취소 실패: ' + error.message);
    else { alert('취소가 완료되었습니다.'); setIsDetailOpen(false); fetchData(); }
  };

  const handleReservation = async () => {
    if (!teamId || !date) return alert('팀과 날짜를 선택해주세요!');
    if (startTime >= endTime) return alert('종료 시간은 시작 시간보다 늦어야 합니다.');
    setIsSubmitting(true);
    try {
      const datesToBook = [];
      let curr = new Date(date + "T00:00:00");
      const end = isRecurring ? new Date(recurringEndDate + "T23:59:59") : new Date(date + "T23:59:59");
      while (curr <= end) { datesToBook.push(formatDateString(curr)); curr.setDate(curr.getDate() + 7); }

      let overlapQuery = supabase.from('reservations').select('*').in('reservation_date', datesToBook);
      if (isEditing && editId) overlapQuery = overlapQuery.neq('id', editId);
      const { data: existing } = await overlapQuery;
      const overlap = existing?.some((res: any) => {
        const s = new Date(res.start_time).getHours() + new Date(res.start_time).getMinutes() / 60;
        const e = new Date(res.end_time).getHours() + new Date(res.end_time).getMinutes() / 60;
        return startTime < e && endTime > s;
      });
      if (overlap) { alert('❌ 겹치는 예약이 있습니다.'); setIsSubmitting(false); return; }

      if (isEditing && editId) {
        await supabase.from('reservations').update({
          team_id: parseInt(teamId), reservation_date: date,
          start_time: new Date(`${date}T${formatTimeToString(startTime)}:00+09:00`).toISOString(),
          end_time: new Date(`${date}T${formatTimeToString(endTime)}:00+09:00`).toISOString(),
        }).eq('id', editId);
        alert('성공적으로 수정되었습니다!');
      } else {
        const series_id = isRecurring ? crypto.randomUUID() : null;
        const payload = datesToBook.map(d => ({
          team_id: parseInt(teamId), reservation_date: d,
          start_time: new Date(`${d}T${formatTimeToString(startTime)}:00+09:00`).toISOString(),
          end_time: new Date(`${d}T${formatTimeToString(endTime)}:00+09:00`).toISOString(),
          is_recurring: isRecurring, recurring_end_date: isRecurring ? recurringEndDate : null, series_id: series_id
        }));
        await supabase.from('reservations').insert(payload);
        alert('예약이 완료되었습니다!');
      }
      setIsOpen(false); resetForm(); fetchData();
    } catch (e: any) { alert('오류: ' + e.message); } finally { setIsSubmitting(false); }
  };

  const weekDays = (() => {
    const day = currentViewDate.getDay() === 0 ? 6 : currentViewDate.getDay() - 1;
    const start = new Date(currentViewDate);
    start.setDate(currentViewDate.getDate() - day);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const fullDate = formatDateString(d);
      days.push({ day: ['월','화','수','목','금','토','일'][i], dateNum: d.getDate(), fullDate: fullDate, isToday: fullDate === formatDateString(new Date()) });
    }
    return days;
  })();

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full bg-bg-base text-text-base overflow-hidden relative transition-colors duration-300">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="pt-8 pb-4 px-4 lg:px-8 border-b border-border-base flex justify-between items-center bg-bg-surface/80 backdrop-blur-md z-30 transition-colors">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold">{currentViewDate.getFullYear()}년 {currentViewDate.getMonth()+1}월</h2>
            <div className="flex bg-bg-base p-1 rounded-lg border border-border-base transition-colors">
              <button onClick={() => {const d = new Date(currentViewDate); d.setDate(d.getDate()-7); setCurrentViewDate(d);}} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800/50 text-text-muted rounded transition"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setCurrentViewDate(new Date())} className="px-3 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800/50 text-sm font-medium rounded transition">오늘</button>
              <button onClick={() => {const d = new Date(currentViewDate); d.setDate(d.getDate()+7); setCurrentViewDate(d);}} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800/50 text-text-muted rounded transition"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <button onClick={() => { resetForm(); setDate(formatDateString(new Date())); setIsOpen(true); }} className="hidden lg:flex px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:brightness-110 shadow-lg transition items-center gap-2">
            <Plus className="w-4 h-4" /> 신규 예약
          </button>
        </header>

        {/* 🌟 날짜 헤더 고정을 위해 구조 개선 */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4 lg:p-8 pb-32 lg:pb-8 custom-scrollbar relative">
          <div className="w-full min-w-max bg-bg-surface rounded-xl border border-border-base overflow-hidden shadow-sm dark:shadow-2xl transition-colors relative">
            
            {/* 🌟 Sticky Header: 스크롤해도 날짜는 위에 고정됩니다. */}
            <div className="grid grid-cols-8 border-b border-border-base bg-bg-surface text-center transition-colors sticky top-0 z-20">
              <div className="p-4 border-r border-border-base text-xs font-bold text-text-muted bg-bg-base/90 backdrop-blur-sm uppercase">Time</div>
              {weekDays.map((d, i) => (
                <div key={i} className="py-3 border-r border-border-base last:border-0 flex flex-col items-center justify-center bg-bg-base/90 backdrop-blur-sm transition-colors">
                  <span className={`text-[10px] font-bold mb-1 uppercase ${d.isToday ? 'text-primary' : 'text-text-muted'}`}>{d.day}</span>
                  <span className={`text-sm font-bold ${d.isToday ? 'text-primary' : 'text-text-base'}`}>{d.dateNum}</span>
                </div>
              ))}
            </div>
            
            <div className="relative grid grid-cols-8">
              <div className="border-r border-border-base col-span-1 bg-bg-surface transition-colors">
                {hours.map(h => <div key={h} className="h-20 border-b border-border-base flex items-start justify-center pt-2 text-[10px] font-bold text-text-muted">{formatTimeToString(h)}</div>)}
              </div>
              
              <div className="col-span-7 grid grid-cols-7 relative bg-bg-base transition-colors select-none" onMouseUp={() => setDragState({ isDragging: false, date: null, start: null, end: null })}>
                {weekDays.map((wd, di) => (
                  <div key={di} className="border-r border-border-base last:border-0 relative">
                    {hours.map(h => (
                      <div key={h} onMouseDown={() => { resetForm(); setDragState({ isDragging: true, date: wd.fullDate, start: h, end: h }); }} 
                           onMouseEnter={() => { if (dragState.isDragging && dragState.date === wd.fullDate) setDragState(prev => ({ ...prev, end: h })); }}
                           className={`h-20 border-b border-border-base cursor-pointer transition-colors hover:bg-slate-200/30 dark:hover:bg-slate-800/30`} />
                    ))}
                  </div>
                ))}
                
                {bookings.filter(b => weekDays.some(wd => wd.fullDate === b.fullDate)).map(b => (
                  <div key={b.id} onClick={(e) => { e.stopPropagation(); setSelectedBooking(b); setIsDetailOpen(true); }} 
                       className="absolute inset-x-1 rounded p-2 md:p-2.5 z-10 shadow-md hover:brightness-110 transition cursor-pointer flex flex-col"
                       style={{ top: `${(b.start - 8) * 5}rem`, left: `calc((100% / 7) * ${b.dayIndex})`, width: `calc(100% / 7 - 8px)`, height: `calc(${b.duration * 5}rem - 4px)`, marginLeft: '4px', marginTop: '2px', backgroundColor: b.teamColor, color: '#ffffff', }}>
                    <p className="text-xs sm:text-sm md:text-base font-black uppercase truncate leading-tight mb-0.5 drop-shadow-sm">{b.team}</p>
                    <p className="text-[10px] sm:text-xs font-semibold opacity-90 tracking-tight drop-shadow-sm">{formatTimeToString(b.start)} - {formatTimeToString(b.start+b.duration)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isOpen && (
        <aside className="hidden lg:block w-80 bg-bg-surface border-l border-border-base p-6 overflow-y-auto shrink-0 z-40 shadow-2xl transition-colors">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold border-l-4 border-primary pl-2 uppercase">{isEditing ? 'Edit Booking' : 'New Booking'}</h3>
            <button onClick={() => { setIsOpen(false); resetForm(); }} className="text-text-muted hover:text-text-base p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/50"><X className="w-5 h-5" /></button>
          </div>
          <ReservationForm teamId={teamId} setTeamId={setTeamId} date={date} setDate={setDate} startTime={startTime} setStartTime={setStartTime} endTime={endTime} setEndTime={setEndTime} isRecurring={isRecurring} setIsRecurring={setIsRecurring} recurringEndDate={recurringEndDate} setRecurringEndDate={setRecurringEndDate} isSubmitting={isSubmitting} handleReservation={handleReservation} teams={teams} formatTimeToString={formatTimeToString} timeSlots={timeSlots} isEditing={isEditing} />
        </aside>
      )}

      <button onClick={() => { resetForm(); setDate(formatDateString(new Date())); setIsOpen(true); }} className="lg:hidden fixed bottom-28 right-6 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg z-40 hover:scale-105 transition-transform">
        <Plus className="w-8 h-8 text-white" />
      </button>

      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden flex items-end justify-center">
          <div className="relative w-full max-h-[90vh] overflow-y-auto custom-scrollbar bg-bg-surface border-t border-border-base p-6 pb-32 rounded-t-3xl shadow-2xl transition-colors">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold uppercase">{isEditing ? 'Edit Booking' : 'New Booking'}</h3>
              <button onClick={() => { setIsOpen(false); resetForm(); }} className="text-text-muted hover:text-text-base"><X className="w-6 h-6" /></button>
            </div>
            <ReservationForm teamId={teamId} setTeamId={setTeamId} date={date} setDate={setDate} startTime={startTime} setStartTime={setStartTime} endTime={endTime} setEndTime={setEndTime} isRecurring={isRecurring} setIsRecurring={setIsRecurring} recurringEndDate={recurringEndDate} setRecurringEndDate={setRecurringEndDate} isSubmitting={isSubmitting} handleReservation={handleReservation} teams={teams} formatTimeToString={formatTimeToString} timeSlots={timeSlots} isEditing={isEditing} />
          </div>
        </div>
      )}

      <Transition appear show={isDetailOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsDetailOpen(false)}>
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-8 text-left shadow-2xl transition-all">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black text-text-base mb-1" style={{ color: selectedBooking?.teamColor }}>{selectedBooking?.team}</h3>
                  <p className="text-primary text-sm font-bold uppercase tracking-wider">Booking Detail</p>
                </div>
                <button onClick={() => setIsDetailOpen(false)} className="text-text-muted hover:text-text-base transition"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-text-muted"><CalendarIcon className="w-5 h-5" /><span className="font-medium text-text-base">{selectedBooking?.fullDate}</span></div>
                <div className="flex items-center gap-3 text-text-muted"><Clock className="w-5 h-5" /><span className="font-medium text-text-base">{selectedBooking && formatTimeToString(selectedBooking.start)} ~ {selectedBooking && formatTimeToString(selectedBooking.start + selectedBooking.duration)}</span></div>
              </div>
              <div className="flex flex-col gap-2">
                {(isAdmin || (selectedBooking && myTeamIds.includes(selectedBooking.team_id))) ? (
                  <>
                    <button onClick={handleOpenEdit} className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-text-base border border-border-base rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2">
                      <Edit2 className="w-4 h-4" /> 현재 일정 수정
                    </button>
                    <div className="h-px bg-border-base my-2" />
                    <button onClick={() => handleDeleteBooking('single')} className="w-full py-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500 border border-rose-200 dark:border-rose-500/20 rounded-xl font-bold hover:bg-rose-500 hover:text-white transition flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> 현재 일정만 취소</button>
                    {selectedBooking?.series_id && (
                      <button onClick={() => handleDeleteBooking('series')} className="w-full py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition flex items-center justify-center gap-2 shadow-md"><AlertCircle className="w-4 h-4" /> 전체 일정 취소 (정기)</button>
                    )}
                  </>
                ) : (
                  <div className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-text-muted rounded-xl font-bold text-center text-sm border border-border-base">본인 팀의 예약만 관리할 수 있습니다.</div>
                )}
                <button onClick={() => setIsDetailOpen(false)} className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-text-muted hover:text-text-base rounded-xl font-bold mt-2 hover:bg-slate-200 transition">닫기</button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

function ReservationForm({ teamId, setTeamId, date, setDate, startTime, setStartTime, endTime, setEndTime, isRecurring, setIsRecurring, recurringEndDate, setRecurringEndDate, isSubmitting, handleReservation, teams, formatTimeToString, timeSlots, isEditing }: any) {
  const handleSetWeeks = (weeks: number) => {
    if (!date) return alert('시작 날짜를 먼저 선택해주세요!');
    const startDate = new Date(date); startDate.setDate(startDate.getDate() + (weeks - 1) * 7);
    const year = startDate.getFullYear(); const month = String(startDate.getMonth() + 1).padStart(2, '0'); const day = String(startDate.getDate()).padStart(2, '0');
    setRecurringEndDate(`${year}-${month}-${day}`);
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block tracking-widest">Team</label>
        <select value={teamId} onChange={e => setTeamId(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-lg p-3 text-text-base outline-none focus:border-primary transition-colors">
          <option value="">팀 선택</option>
          {teams.map((t:any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block tracking-widest">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="scheme-light dark:scheme-dark w-full bg-bg-base border border-border-base rounded-lg p-3 text-text-base outline-none focus:border-primary transition-colors" />
        </div>
        {!isEditing && (
          <label className="flex items-center gap-3 cursor-pointer group bg-bg-base/50 p-3 rounded-lg border border-border-base hover:border-slate-300 transition-colors">
            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-primary bg-bg-surface focus:ring-primary" />
            <span className="text-sm font-bold text-text-muted group-hover:text-text-base">정기 스케줄로 등록</span>
          </label>
        )}
        {isRecurring && !isEditing && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2">
            <label className="text-[10px] font-bold text-primary uppercase block tracking-widest">Until (End Date)</label>
            <input type="date" value={recurringEndDate} onChange={e => setRecurringEndDate(e.target.value)} className="scheme-light dark:scheme-dark w-full bg-bg-surface border border-primary/30 rounded-lg p-3 text-text-base focus:border-primary outline-none" />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => handleSetWeeks(4)} className="flex-1 py-2 text-xs font-bold bg-bg-surface border border-primary/20 rounded-lg hover:bg-primary/10 text-primary/70 hover:text-primary">4주 동안</button>
              <button type="button" onClick={() => handleSetWeeks(8)} className="flex-1 py-2 text-xs font-bold bg-bg-surface border border-primary/20 rounded-lg hover:bg-primary/10 text-primary/70 hover:text-primary">8주 동안</button>
              <button type="button" onClick={() => handleSetWeeks(12)} className="flex-1 py-2 text-xs font-bold bg-bg-surface border border-primary/20 rounded-lg hover:bg-primary/10 text-primary/70 hover:text-primary">12주 동안</button>
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">From</label><select value={startTime} onChange={e => setStartTime(parseFloat(e.target.value))} className="w-full bg-bg-base border border-border-base rounded-lg p-3 text-sm text-text-base outline-none">{timeSlots.slice(0,-1).map((t:any) => <option key={t} value={t}>{formatTimeToString(t)}</option>)}</select></div>
        <div><label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">To</label><select value={endTime} onChange={e => setEndTime(parseFloat(e.target.value))} className="w-full bg-bg-base border border-border-base rounded-lg p-3 text-sm text-text-base outline-none">{timeSlots.filter((t:any)=>t>startTime).map((t:any) => <option key={t} value={t}>{formatTimeToString(t)}</option>)}</select></div>
      </div>
      <button onClick={handleReservation} disabled={isSubmitting || teams.length === 0} className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:brightness-110 disabled:opacity-50 transition shadow-lg shadow-primary/20 mt-4">
        {isSubmitting ? '처리 중...' : (isEditing ? '예약 수정하기' : '예약 확정하기')}
      </button>
    </div>
  );
}

export default function TimetablePageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-slate-500">예약 일정을 불러오는 중입니다...</div>}>
      <TimetableContent />
    </Suspense>
  );
}