"use client";
import React, { useState, useEffect, useRef, Fragment } from 'react';
import { supabase } from '../../lib/supabase';
import { MessageSquare, Hash, Users, User as UserIcon, Send, ChevronLeft, Menu, Loader2, Search, Plus, X, UserPlus } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';

// 🌟 Profile 인터페이스에 generation 추가
interface Profile { id: string; name: string; profile_image_url?: string; session?: string; generation?: string; }
interface Team { id: number; name: string; }
interface CustomRoom { id: string; name: string; }
interface Message {
  id: string;
  room_type: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles: { name: string; profile_image_url: string; generation?: string; }; // 🌟 메시지 보낸 사람의 기수 추가
}
interface Room { type: 'global' | 'team' | 'direct' | 'custom'; id: string; name: string; }

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [myCustomRooms, setMyCustomRooms] = useState<CustomRoom[]>([]);
  
  const [activeRoom, setActiveRoom] = useState<Room>({ type: 'global', id: 'all', name: '동아리 전체 광장' });
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchCustomRooms = async (userId: string) => {
    const { data } = await supabase
      .from('custom_chat_members')
      .select('custom_chat_rooms(id, name)')
      .eq('user_id', userId);
    
    if (data) {
      setMyCustomRooms(data.map((d: any) => d.custom_chat_rooms).filter(Boolean));
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setCurrentUser(session.user);

      const { data: teamData } = await supabase.from('team_members').select('teams(id, name)').eq('user_id', session.user.id);
      if (teamData) setMyTeams(teamData.map((t: any) => t.teams).filter(Boolean));

      // 🌟 부원 목록 가져올 때 generation(기수)도 함께 가져옴
      const { data: usersData } = await supabase.from('profiles').select('id, name, profile_image_url, session, generation').order('name');
      if (usersData) setAllUsers(usersData.filter(u => u.id !== session.user.id));

      await fetchCustomRooms(session.user.id);
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!activeRoom || !currentUser) return;
    setIsLoading(true);

    const fetchMessages = async () => {
      // 🌟 메시지 가져올 때 작성자의 generation(기수)도 함께 가져옴
      const { data } = await supabase.from('chat_messages').select('*, profiles(name, profile_image_url, generation)').eq('room_id', activeRoom.id).order('created_at', { ascending: true });
      setMessages(data || []); setIsLoading(false); setTimeout(scrollToBottom, 100);
    };
    fetchMessages();

    const channel = supabase.channel(`room_${activeRoom.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${activeRoom.id}` }, async (payload) => {
          const { data: msgData } = await supabase.from('chat_messages').select('*, profiles(name, profile_image_url, generation)').eq('id', payload.new.id).single();
          if (msgData) { setMessages((prev) => [...prev, msgData]); setTimeout(scrollToBottom, 100); }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeRoom, currentUser]);

  const getDirectRoomId = (uid1: string, uid2: string) => [uid1, uid2].sort().join('_');

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;
    const messageText = newMessage; setNewMessage('');
    await supabase.from('chat_messages').insert([{ room_type: activeRoom.type, room_id: activeRoom.id, sender_id: currentUser.id, content: messageText }]);
  };

  const changeRoom = (room: Room) => { setActiveRoom(room); setIsSidebarOpen(false); };

  const handleCreateCustomRoom = async () => {
    if (!newRoomName.trim()) return alert('채팅방 이름을 입력해주세요.');
    if (selectedUsers.length === 0) return alert('초대할 사람을 1명 이상 선택해주세요.');

    const { data: roomData, error: roomError } = await supabase.from('custom_chat_rooms').insert([{ name: newRoomName, created_by: currentUser.id }]).select().single();
    if (roomError) return alert('방 생성 실패: ' + roomError.message);

    const membersToInsert = [...selectedUsers, currentUser.id].map(userId => ({
      room_id: roomData.id,
      user_id: userId
    }));

    const { error: memberError } = await supabase.from('custom_chat_members').insert(membersToInsert);
    if (memberError) return alert('멤버 추가 실패: ' + memberError.message);

    alert('단체방이 생성되었습니다!'); // 🌟 단체방으로 변경
    setIsCreateRoomOpen(false);
    setNewRoomName('');
    setSelectedUsers([]);
    await fetchCustomRooms(currentUser.id);
    changeRoom({ type: 'custom', id: roomData.id, name: roomData.name });
  };

  const formatTime = (isoString: string) => new Date(isoString).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const filteredUsers = allUsers.filter(u => 
    u.name.includes(searchTerm) || 
    (u.session && u.session.includes(searchTerm)) || 
    (u.generation && u.generation.includes(searchTerm)) // 기수로도 검색 가능하게 추가
  );

  return (
    <div className="flex-1 flex h-dvh overflow-hidden bg-bg-base text-text-base transition-colors duration-300">
      
      <aside className={`w-full lg:w-80 shrink-0 bg-bg-surface border-r border-border-base flex flex-col h-full transition-all duration-300 absolute lg:relative z-20 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b border-border-base flex items-center justify-between">
          <h2 className="text-xl font-black text-text-base flex items-center gap-2"><MessageSquare className="w-5 h-5 text-primary" /> 메신저</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-text-muted"><ChevronLeft className="w-6 h-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6 pb-20">
          <div>
            <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 ml-2">광장</div>
            <button onClick={() => changeRoom({ type: 'global', id: 'all', name: '동아리 전체 광장' })} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${activeRoom.id === 'all' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-text-base'}`}>
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary"><Hash className="w-5 h-5" /></div>
              <span>동아리 전체 광장</span>
            </button>
          </div>

          {myTeams.length > 0 && (
            <div>
              <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 ml-2">나의 팀 채팅</div>
              <div className="space-y-1">
                {myTeams.map(team => (
                  <button key={team.id} onClick={() => changeRoom({ type: 'team', id: `team_${team.id}`, name: team.name })} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${activeRoom.id === `team_${team.id}` ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-text-base'}`}>
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center"><Users className="w-5 h-5 text-slate-500" /></div>
                    <span className="truncate">{team.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2 ml-2 mr-1">
              <div className="text-xs font-bold text-text-muted uppercase tracking-wider">참여 중인 단체방</div> {/* 🌟 단체방으로 변경 */}
              <button onClick={() => setIsCreateRoomOpen(true)} className="p-1 text-primary hover:bg-primary/10 rounded-md transition"><Plus className="w-4 h-4" /></button>
            </div>
            {myCustomRooms.length === 0 ? (
              <div className="text-center text-xs text-text-muted bg-bg-base py-3 rounded-xl border border-dashed border-border-base mx-1">참여 중인 단체방이 없습니다.</div>
            ) : (
              <div className="space-y-1">
                {myCustomRooms.map(room => (
                  <button key={room.id} onClick={() => changeRoom({ type: 'custom', id: room.id, name: room.name })} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${activeRoom.id === room.id ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-text-base'}`}>
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center"><MessageSquare className="w-5 h-5 text-slate-500" /></div>
                    <span className="truncate">{room.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 ml-2">1:1 다이렉트 메시지</div>
            <div className="px-1 mb-3">
              <div className="flex items-center bg-bg-base border border-border-base rounded-xl px-3 py-2 focus-within:border-primary transition-colors">
                <Search className="w-4 h-4 text-text-muted mr-2 shrink-0" />
                <input type="text" placeholder="이름, 기수, 세션 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent text-sm text-text-base w-full outline-none" />
              </div>
            </div>

            <div className="space-y-1">
              {filteredUsers.length === 0 ? (
                <div className="text-center text-xs text-text-muted py-4">검색 결과가 없습니다.</div>
              ) : (
                filteredUsers.map(user => {
                  const dmRoomId = currentUser ? getDirectRoomId(currentUser.id, user.id) : '';
                  return (
                    <button key={user.id} onClick={() => changeRoom({ type: 'direct', id: dmRoomId, name: user.name })} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${activeRoom.id === dmRoomId ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-text-base'}`}>
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-border-base shrink-0">
                        {user.profile_image_url ? <img src={user.profile_image_url} alt={user.name} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-slate-500" />}
                      </div>
                      <div className="text-left truncate">
                        {/* 🌟 이름 앞에 기수 추가 */}
                        <div className="text-sm font-medium">{user.generation ? `[${user.generation}] ` : ''}{user.name}</div>
                        <div className="text-[10px] text-text-muted">{user.session || '세션 미정'}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-dvh relative bg-[#F8F9FA] dark:bg-[#0B0F19] transition-colors">
        <header className="h-16 shrink-0 bg-bg-surface/90 backdrop-blur-md border-b border-border-base flex items-center px-4 gap-3 z-10">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-text-muted hover:text-primary transition"><Menu className="w-6 h-6" /></button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-text-base flex items-center gap-2">
              {activeRoom.type === 'global' ? <Hash className="w-4 h-4 text-text-muted" /> : activeRoom.type === 'direct' ? <UserIcon className="w-4 h-4 text-text-muted" /> : <Users className="w-4 h-4 text-text-muted" />}
              {activeRoom.name}
            </h2>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" />
              <p className="text-sm">메시지를 불러오는 중...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-muted opacity-50">
              <MessageSquare className="w-12 h-12 mb-3" />
              <p>아직 대화가 없습니다. 첫 인사를 건네보세요!</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.sender_id === currentUser?.id;
              const showProfile = !isMe && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id);
              return (
                <div key={msg.id} className={`flex gap-2 w-full max-w-2xl ${isMe ? 'self-end justify-end' : 'self-start'}`}>
                  {!isMe && (
                    <div className="w-9 h-9 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0 overflow-hidden mt-1 border border-border-base">
                      {showProfile && (msg.profiles?.profile_image_url ? <img src={msg.profiles.profile_image_url} alt="Profile" className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-slate-500 m-2" />)}
                    </div>
                  )}
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* 🌟 메시지 보낸 사람 위에도 기수 추가 */}
                    {!isMe && showProfile && <span className="text-xs text-text-muted mb-1 ml-1">{msg.profiles?.generation ? `[${msg.profiles.generation}] ` : ''}{msg.profiles?.name}</span>}
                    <div className="flex items-end gap-1.5">
                      {isMe && <span className="text-[10px] text-text-muted mb-1">{formatTime(msg.created_at)}</span>}
                      <div className={`px-4 py-2.5 rounded-2xl max-w-60 md:max-w-md text-wrap text-sm shadow-sm ${isMe ? 'bg-primary text-white rounded-tr-sm' : 'bg-white dark:bg-slate-800 text-text-base border border-border-base rounded-tl-sm'}`}>
                        {msg.content}
                      </div>
                      {!isMe && <span className="text-[10px] text-text-muted mb-1">{formatTime(msg.created_at)}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} className="h-2" />
        </div>

        <div className="p-4 bg-bg-surface border-t border-border-base shrink-0 safe-area-bottom">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-end gap-2 bg-bg-base border border-border-base p-1.5 rounded-3xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <textarea rows={1} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }} placeholder="메시지를 입력하세요... (Enter로 전송)" className="flex-1 bg-transparent px-4 py-2.5 outline-none resize-none max-h-32 text-sm text-text-base placeholder:text-text-muted custom-scrollbar" />
            <button type="submit" disabled={!newMessage.trim()} className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shrink-0 disabled:opacity-50 transition-all hover:scale-105 active:scale-95 mb-0.5 mr-0.5"><Send className="w-4 h-4 ml-0.5" /></button>
          </form>
        </div>
      </main>

      <Transition appear show={isCreateRoomOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsCreateRoomOpen(false)}>
          <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm transition-opacity" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-6 text-left shadow-2xl transition-colors">
              <div className="flex justify-between items-center mb-6">
                <Dialog.Title className="text-lg font-bold text-text-base flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" /> 새 단체방 만들기</Dialog.Title>
                <button onClick={() => setIsCreateRoomOpen(false)} className="text-text-muted hover:text-text-base"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block tracking-wider">채팅방 이름</label>
                  <input type="text" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="예: 건반 세션 모임" className="w-full bg-bg-base border border-border-base rounded-xl p-3 text-text-base focus:border-primary outline-none transition-colors" />
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block tracking-wider">초대할 사람 선택 ({selectedUsers.length}명)</label>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar border border-border-base rounded-xl p-2 bg-bg-base">
                    {allUsers.map(user => (
                      <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-bg-surface rounded-lg cursor-pointer transition">
                        <input 
                          type="checkbox" 
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedUsers([...selectedUsers, user.id]);
                            else setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                          }}
                          className="w-4 h-4 accent-primary"
                        />
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                          {user.profile_image_url ? <img src={user.profile_image_url} className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 text-slate-500" />}
                        </div>
                        {/* 🌟 단체방 초대 목록에도 기수 추가 */}
                        <span className="text-sm font-medium">{user.generation ? `[${user.generation}] ` : ''}{user.name} <span className="text-[10px] text-text-muted ml-1">{user.session}</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={handleCreateCustomRoom} className="w-full mt-6 py-3.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 transition">
                채팅방 개설하기
              </button>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}