// components/NotificationBell.tsx
"use client";
import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
// 🌟 파일 경로 주의: components 폴더 안에서 lib을 찾으려면 ../lib/supabase 가 맞습니다!
import { supabase } from '../lib/supabase'; 

export default function NotificationBell({ currentUser }: { currentUser: any }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // 안 읽은 알림 갯수
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!currentUser) return;

    // 1. 처음 화면을 켤 때 기존 알림 불러오기
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setNotifications(data);
    };
    fetchNotifications();

    // 2. 실시간 마법! DB에 알림이 추가되면 즉시 빨간 불 켜기
    const subscription = supabase
      .channel('realtime_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, 
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [currentUser]);

  // 알림 읽음 처리
  const markAsRead = async (id: number, link: string | null) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    if (link) window.location.href = link; 
  };

  // 알림 전체 삭제
  const clearAll = async () => {
    if (!confirm('모든 알림을 삭제하시겠습니까?')) return;
    await supabase.from('notifications').delete().eq('user_id', currentUser.id);
    setNotifications([]);
  };

  return (
    <div className="relative">
      {/* 🔔 종 모양 버튼 */}
      <button onClick={() => setIsOpen(!isOpen)} className="relative p-2 text-text-muted hover:text-primary transition rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
        <Bell className="w-6 h-6" />
        {/* 빨간색 안읽음 뱃지 */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-bg-surface">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* 팝업 창 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-bg-surface border border-border-base shadow-2xl rounded-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-4 border-b border-border-base flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
            <h3 className="font-bold text-text-base">알림</h3>
            {notifications.length > 0 && (
              <button onClick={clearAll} className="text-[10px] text-text-muted hover:text-rose-500 flex items-center gap-1 transition">
                <Trash2 className="w-3 h-3" /> 모두 지우기
              </button>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-muted">새로운 알림이 없습니다.</div>
            ) : (
              notifications.map((noti) => (
                <div 
                  key={noti.id} 
                  onClick={() => markAsRead(noti.id, noti.link)}
                  className={`p-4 border-b border-border-base last:border-0 cursor-pointer transition flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 ${!noti.is_read ? 'bg-primary/5' : ''}`}
                >
                  {!noti.is_read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                  <div className="flex-1">
                    <p className={`text-sm ${!noti.is_read ? 'text-text-base font-bold' : 'text-text-muted font-medium'}`}>
                      <span className="text-primary mr-1">{noti.sender_name}</span>님이 {noti.message}
                    </p>
                    <p className="text-[10px] text-text-muted mt-1">{new Date(noti.created_at).toLocaleString('ko-KR')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}