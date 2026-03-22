"use client";
import React, { useState, useEffect, useRef, Fragment } from 'react';
import { supabase } from '../../lib/supabase';
import { MessageSquare, Hash, Users, User as UserIcon, Send, ChevronLeft, Menu, Loader2, Search, Plus, X, UserPlus, Star, ImageIcon, Info, LogOut, Trash2, Download, MessageCirclePlus } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';

interface Profile { id: string; name: string; profile_image_url?: string; session?: string; generation?: string; }
interface Team { id: number; name: string; }
interface CustomRoom { id: string; name: string; }
interface Message {
  id: string; room_type: string; room_id: string; sender_id: string; content: string; created_at: string;
  media_url?: string; media_type?: string;
  profiles: { name: string; profile_image_url: string; generation?: string; }; 
}
interface Room { type: 'global' | 'team' | 'direct' | 'custom'; id: string; name: string; }

// 채팅방 목록을 위한 인터페이스 (카톡 스타일)
interface ChatListRoom {
  type: 'direct' | 'custom';
  id: string;
  name: string;
  image_url?: string;
  lastMessage: string;
  lastMessageTime: string;
  timestamp: number; // 정렬용
  isFav?: boolean;
}

// 🌟 이름과 기수를 합쳐서 보여주는 헬퍼 함수
const formatNameWithGen = (name: string, gen?: string | null) => {
  return gen && gen.trim() !== '' ? `${name}(${gen})` : name;
};

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  
  // 카톡 스타일 채팅방 목록
  const [activeChatRooms, setActiveChatRooms] = useState<ChatListRoom[]>([]);
  
  const [activeRoom, setActiveRoom] = useState<Room>({ type: 'global', id: 'all', name: '동아리 전체 광장' });
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  
  // 새 1:1 대화 시작 모달
  const [isNewDirectModalOpen, setIsNewDirectModalOpen] = useState(false);
  const [directSearchTerm, setDirectSearchTerm] = useState('');

  // 새 단체방 만들기 모달
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [newRoomSearchTerm, setNewRoomSearchTerm] = useState(''); 
  
  // 단체방 정보 (참여자 및 나가기)
  const [isRoomInfoOpen, setIsRoomInfoOpen] = useState(false);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);

  // 미디어 업로드 관련
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 컨텍스트 메뉴 (메시지 취소 및 미디어 저장)
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'message' | 'media', msg: Message } | null>(null);
  let pressTimer = useRef<NodeJS.Timeout | null>(null);

  const [favorites, setFavorites] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // 화면 밖 클릭 시 컨텍스트 메뉴 닫기
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    const savedFavs = localStorage.getItem('chat_favorites');
    if (savedFavs) setFavorites(JSON.parse(savedFavs));
  }, []);

  const toggleFavorite = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation(); 
    const newFavs = favorites.includes(roomId) ? favorites.filter(id => id !== roomId) : [...favorites, roomId];
    setFavorites(newFavs);
    localStorage.setItem('chat_favorites', JSON.stringify(newFavs)); 
  };

  const getDirectRoomId = (uid1: string, uid2: string) => [uid1, uid2].sort().join('_');

  // 대화 기록이 있는 방 목록(1:1, 단체)을 가져와서 조립하는 함수
  const fetchActiveChatRooms = async (userId: string, profiles: Profile[]) => {
    try {
      const { data: myCustomRoomsData } = await supabase.from('custom_chat_members').select('custom_chat_rooms(id, name)').eq('user_id', userId);
      const customRooms = myCustomRoomsData?.map((d: any) => d.custom_chat_rooms).filter(Boolean) || [];

      const { data: recentMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .neq('room_type', 'global')
        .order('created_at', { ascending: false });

      if (!recentMessages) return;

      const roomMap = new Map<string, ChatListRoom>();

      recentMessages.forEach(msg => {
        if (roomMap.has(msg.room_id)) return;

        if (msg.room_type === 'direct' && msg.room_id.includes(userId)) {
          const otherUserId = msg.room_id.split('_').find((id: string) => id !== userId);
          const otherUser = profiles.find(p => p.id === otherUserId);
          
          if (otherUser) {
            roomMap.set(msg.room_id, {
              type: 'direct',
              id: msg.room_id,
              name: formatNameWithGen(otherUser.name, otherUser.generation), // 🌟 1:1 대화방 이름에 기수 추가
              image_url: otherUser.profile_image_url,
              lastMessage: msg.content === '미디어를 보냈습니다.' ? '사진/동영상' : msg.content,
              lastMessageTime: new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
              timestamp: new Date(msg.created_at).getTime()
            });
          }
        }
        
        if (msg.room_type === 'custom' && customRooms.some(cr => cr.id === msg.room_id)) {
          const roomInfo = customRooms.find(cr => cr.id === msg.room_id);
          roomMap.set(msg.room_id, {
            type: 'custom',
            id: msg.room_id,
            name: roomInfo.name,
            lastMessage: msg.content === '미디어를 보냈습니다.' ? '사진/동영상' : msg.content,
            lastMessageTime: new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date(msg.created_at).getTime()
          });
        }
      });

      customRooms.forEach(cr => {
        if (!roomMap.has(cr.id)) {
          roomMap.set(cr.id, {
            type: 'custom',
            id: cr.id,
            name: cr.name,
            lastMessage: '대화 기록이 없습니다.',
            lastMessageTime: '',
            timestamp: 0 
          });
        }
      });

      const sortedRooms = Array.from(roomMap.values()).sort((a, b) => b.timestamp - a.timestamp);
      setActiveChatRooms(sortedRooms);
    } catch (err) {
      console.error('채팅 목록 불러오기 에러:', err);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setCurrentUser(session.user);

      // 🌟 데이터 불러올 때 generation(기수) 필드 추가
      const { data: usersData } = await supabase.from('profiles').select('id, name, profile_image_url, session, generation').order('name');
      let loadedProfiles: Profile[] = [];
      if (usersData) {
        loadedProfiles = usersData.filter(u => u.id !== session.user.id);
        setAllUsers(loadedProfiles);
      }

      await fetchActiveChatRooms(session.user.id, loadedProfiles);
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!currentUser || allUsers.length === 0) return;
    
    const listChannel = supabase.channel('chat_list_updater')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
          fetchActiveChatRooms(currentUser.id, allUsers);
      }).subscribe();

    return () => { supabase.removeChannel(listChannel); };
  }, [currentUser, allUsers]);

  useEffect(() => {
    if (!activeRoom || !currentUser) return;
    setIsLoading(true);

    const fetchMessages = async () => {
      // 🌟 메시지 불러올 때 작성자의 generation(기수) 정보 추가
      const { data } = await supabase.from('chat_messages').select('*, profiles(name, profile_image_url, generation)').eq('room_id', activeRoom.id).order('created_at', { ascending: true });
      setMessages(data || []); setIsLoading(false); setTimeout(scrollToBottom, 100);
    };
    fetchMessages();

    const channel = supabase.channel(`room_${activeRoom.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${activeRoom.id}` }, async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: msgData } = await supabase.from('chat_messages').select('*, profiles(name, profile_image_url, generation)').eq('id', payload.new.id).single();
            if (msgData) { setMessages((prev) => [...prev, msgData]); setTimeout(scrollToBottom, 100); }
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter(m => m.id !== payload.old.id));
          }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeRoom, currentUser]);


  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;
    const messageText = newMessage; setNewMessage('');
    
    await supabase.from('chat_messages').insert([{ room_type: activeRoom.type, room_id: activeRoom.id, sender_id: currentUser.id, content: messageText }]);

    if (activeRoom.type === 'direct') {
      const targetUserId = activeRoom.id.split('_').find((id: string) => id !== currentUser.id);
      
      const { data: senderProfile } = await supabase.from('profiles').select('name, generation').eq('id', currentUser.id).single();
      const senderName = formatNameWithGen(senderProfile?.name || '새로운 메시지', senderProfile?.generation); // 🌟 푸시 알림 발송 시에도 기수 포함

      if (targetUserId) {
        try {
          await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetUserId: targetUserId,
              senderName: senderName,
              type: 'chat',
              message: messageText.length > 20 ? messageText.substring(0, 20) + '...' : messageText,
              link: '/chat' 
            })
          });
        } catch (error) {
          console.error('채팅 알림 발송 실패:', error);
        }
      }
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !currentUser) return;
    const file = e.target.files[0];
    setIsUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${activeRoom.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from('chat_media').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(filePath);

      await supabase.from('chat_messages').insert([{ 
        room_type: activeRoom.type, room_id: activeRoom.id, sender_id: currentUser.id, content: '미디어를 보냈습니다.',
        media_url: publicUrl, media_type: file.type
      }]);
    } catch (error: any) {
      alert("업로드 실패: " + error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const changeRoom = (room: Room) => { setActiveRoom(room); setIsSidebarOpen(false); };

  const handleCreateCustomRoom = async () => {
    if (!newRoomName.trim()) return alert('채팅방 이름을 입력해주세요.');
    if (selectedUsers.length === 0) return alert('초대할 사람을 1명 이상 선택해주세요.');

    const { data: roomData, error: roomError } = await supabase.from('custom_chat_rooms').insert([{ name: newRoomName, created_by: currentUser.id }]).select().single();
    if (roomError) return alert('방 생성 실패: ' + roomError.message);

    const membersToInsert = [...selectedUsers, currentUser.id].map(userId => ({ room_id: roomData.id, user_id: userId }));
    await supabase.from('custom_chat_members').insert(membersToInsert);

    setIsCreateRoomOpen(false); setNewRoomName(''); setSelectedUsers([]); setNewRoomSearchTerm('');
    
    await fetchActiveChatRooms(currentUser.id, allUsers);
    changeRoom({ type: 'custom', id: roomData.id, name: roomData.name });
  };

  const openRoomInfo = async () => {
    if (activeRoom.type !== 'custom') return;
    // 🌟 단체방 멤버 정보 불러올 때 generation(기수) 정보 추가
    const { data } = await supabase.from('custom_chat_members').select('profiles(id, name, profile_image_url, generation)').eq('room_id', activeRoom.id);
    if (data) setRoomMembers(data.map((d: any) => d.profiles));
    setIsRoomInfoOpen(true);
  };

  const handleLeaveRoom = async () => {
    if (!confirm("정말 이 단체방에서 나가시겠습니까?")) return;
    
    await supabase.from('custom_chat_members').delete().eq('room_id', activeRoom.id).eq('user_id', currentUser.id);
    const { count } = await supabase.from('custom_chat_members').select('*', { count: 'exact', head: true }).eq('room_id', activeRoom.id);
    
    if (count === 0) {
      await supabase.from('custom_chat_rooms').delete().eq('id', activeRoom.id);
    }

    alert("방에서 나갔습니다.");
    setIsRoomInfoOpen(false);
    fetchActiveChatRooms(currentUser.id, allUsers);
    changeRoom({ type: 'global', id: 'all', name: '동아리 전체 광장' });
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'message' | 'media', msg: Message) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, msg });
  };

  const handleTouchStart = (e: React.TouchEvent, type: 'message' | 'media', msg: Message) => {
    const touch = e.touches[0];
    pressTimer.current = setTimeout(() => {
      setContextMenu({ x: touch.clientX, y: touch.clientY, type, msg });
    }, 500); 
  };

  const handleTouchEnd = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  const handleUnsendMessage = async () => {
    if (!contextMenu) return;
    await supabase.from('chat_messages').delete().eq('id', contextMenu.msg.id);
    setContextMenu(null);
  };

  const formatTime = (isoString: string) => new Date(isoString).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const filteredChatRooms = activeChatRooms.filter(room => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return room.name.toLowerCase().includes(term) || room.lastMessage.toLowerCase().includes(term);
  }).sort((a, b) => {
    const aFav = favorites.includes(a.id); const bFav = favorites.includes(b.id);
    if (aFav && !bFav) return -1; if (!aFav && bFav) return 1;
    return b.timestamp - a.timestamp;
  });

  const newDirectFilteredUsers = allUsers.filter(u => directSearchTerm ? u.name?.toLowerCase().includes(directSearchTerm.toLowerCase()) : true);
  const newRoomFilteredUsers = allUsers.filter(u => newRoomSearchTerm ? u.name?.toLowerCase().includes(newRoomSearchTerm.toLowerCase()) : true);

  return (
    <div className="flex-1 flex h-dvh overflow-hidden bg-bg-base text-text-base transition-colors duration-300 relative">
      
      <aside className={`w-full lg:w-80 shrink-0 bg-bg-surface border-r border-border-base flex flex-col h-full transition-all duration-300 absolute lg:relative z-20 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b border-border-base flex items-center justify-between">
          <h2 className="text-xl font-black text-text-base flex items-center gap-2"><MessageSquare className="w-5 h-5 text-primary" /> 메신저</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-text-muted"><ChevronLeft className="w-6 h-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6 pb-20">
          <div>
            <button onClick={() => changeRoom({ type: 'global', id: 'all', name: '동아리 전체 광장' })} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${activeRoom.id === 'all' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-text-base'}`}>
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white"><Hash className="w-5 h-5" /></div>
              <div className="text-left flex-1">
                <div className="text-sm font-bold">동아리 전체 광장</div>
                <div className="text-[10px] text-text-muted">모두가 참여하는 공개 채팅방</div>
              </div>
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3 ml-2 mr-1">
              <div className="text-xs font-bold text-text-muted uppercase tracking-wider">채팅 목록</div>
              <div className="flex gap-1">
                <button onClick={() => setIsNewDirectModalOpen(true)} className="p-1 text-primary hover:bg-primary/10 rounded-md transition" title="1:1 대화 시작"><MessageCirclePlus className="w-4 h-4" /></button>
                <button onClick={() => setIsCreateRoomOpen(true)} className="p-1 text-primary hover:bg-primary/10 rounded-md transition" title="새 단체방 만들기"><Users className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="px-1 mb-3">
              <div className="flex items-center bg-bg-base border border-border-base rounded-xl px-3 py-2 focus-within:border-primary transition-colors">
                <Search className="w-4 h-4 text-text-muted mr-2 shrink-0" />
                <input type="text" placeholder="방 이름, 메시지 내용 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent text-sm text-text-base w-full outline-none" />
              </div>
            </div>

            <div className="space-y-1">
              {filteredChatRooms.length === 0 ? (
                <div className="text-center p-6 text-sm text-text-muted mt-4 border border-dashed border-border-base rounded-2xl mx-1">
                  진행 중인 대화가 없습니다.<br/>상단의 <MessageCirclePlus className="w-3 h-3 inline text-primary mb-0.5"/> 버튼을 눌러 시작해보세요!
                </div>
              ) : (
                filteredChatRooms.map(room => {
                  const isFav = favorites.includes(room.id); 
                  return (
                    <button key={room.id} onClick={() => changeRoom({ type: room.type, id: room.id, name: room.name })} className={`w-full flex items-center gap-3 p-3 rounded-xl transition group ${activeRoom.id === room.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent text-text-base'}`}>
                      <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-border-base shrink-0">
                        {room.type === 'custom' ? <Users className="w-5 h-5 text-slate-500" /> : 
                          (room.image_url ? <img src={room.image_url} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-slate-500" />)}
                      </div>
                      
                      <div className="text-left flex-1 min-w-0 pr-2">
                        <div className="flex justify-between items-center mb-0.5">
                          <div className={`text-sm font-bold truncate ${activeRoom.id === room.id ? 'text-primary' : 'text-text-base'}`}>{room.name}</div>
                          <div className="text-[10px] text-text-muted shrink-0 ml-2">{room.lastMessageTime}</div>
                        </div>
                        <div className="text-xs text-text-muted truncate font-medium">{room.lastMessage}</div>
                      </div>

                      <div onClick={(e) => toggleFavorite(e, room.id)} className={`p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition absolute right-2 ${isFav ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100'}`}>
                        <Star className="w-4 h-4" fill={isFav ? "currentColor" : "none"} />
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
        <header className="h-16 shrink-0 bg-bg-surface/90 backdrop-blur-md border-b border-border-base flex items-center justify-between px-4 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-text-muted hover:text-primary transition"><Menu className="w-6 h-6" /></button>
            <h2 className="text-lg font-bold text-text-base flex items-center gap-2">
              {activeRoom.type === 'global' ? <Hash className="w-4 h-4 text-text-muted" /> : activeRoom.type === 'direct' ? <UserIcon className="w-4 h-4 text-text-muted" /> : <Users className="w-4 h-4 text-text-muted" />}
              {activeRoom.name}
            </h2>
          </div>
          {activeRoom.type === 'custom' && (
            <button onClick={openRoomInfo} className="p-2 text-text-muted hover:text-primary transition bg-slate-100 dark:bg-slate-800 rounded-full"><Info className="w-5 h-5" /></button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar flex flex-col pb-28 md:pb-24">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-muted"><Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" /></div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-muted opacity-50"><MessageSquare className="w-12 h-12 mb-3" /><p>첫 인사를 건네보세요!</p></div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.sender_id === currentUser?.id;
              const showProfile = !isMe && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id);
              
              return (
                <div key={msg.id} className={`flex gap-2 w-full max-w-2xl ${isMe ? 'self-end justify-end' : 'self-start'}`}>
                  {!isMe && (
                    <div className="w-9 h-9 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0 overflow-hidden mt-1 border border-border-base">
                      {showProfile && (msg.profiles?.profile_image_url ? <img src={msg.profiles.profile_image_url} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-slate-500 m-2" />)}
                    </div>
                  )}
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* 🌟 메시지 보낸 사람의 이름 옆에 기수 표시 */}
                    {!isMe && showProfile && <span className="text-xs text-text-muted mb-1 ml-1">{formatNameWithGen(msg.profiles?.name, msg.profiles?.generation)}</span>}
                    <div className="flex items-end gap-1.5">
                      {isMe && <span className="text-[10px] text-text-muted mb-1">{formatTime(msg.created_at)}</span>}
                      
                      <div 
                        onContextMenu={(e) => handleContextMenu(e, 'message', msg)}
                        onTouchStart={(e) => handleTouchStart(e, 'message', msg)}
                        onTouchEnd={handleTouchEnd}
                        className={`px-4 py-2.5 rounded-2xl max-w-60 md:max-w-md text-wrap text-sm shadow-sm select-none cursor-pointer wrap-break-word ${isMe ? 'bg-primary text-white rounded-tr-sm' : 'bg-white dark:bg-slate-800 text-text-base border border-border-base rounded-tl-sm'}`}
                      >
                        {msg.content !== '미디어를 보냈습니다.' && msg.content}
                        
                        {msg.media_url && (
                           <div className="mt-2" onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, 'media', msg); }} onTouchStart={(e) => { e.stopPropagation(); handleTouchStart(e, 'media', msg); }}>
                             {msg.media_type?.startsWith('video/') ? (
                               <video src={msg.media_url} controls className="max-w-full rounded-xl border border-border-base" />
                             ) : (
                               <img src={msg.media_url} alt="첨부 이미지" className="max-w-full rounded-xl border border-border-base" />
                             )}
                           </div>
                        )}
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

        <div className="absolute bottom-16 md:bottom-0 left-0 right-0 p-4 bg-bg-surface/90 backdrop-blur-md border-t border-border-base shrink-0 transition-all">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-end gap-2 bg-bg-base border border-border-base p-1.5 rounded-3xl focus-within:border-primary focus-within:ring-1 transition-all">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-text-muted hover:text-primary transition rounded-full shrink-0 mb-0.5 ml-1">
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
            </button>
            <input type="file" accept="image/*,video/*" ref={fileInputRef} onChange={handleMediaUpload} className="hidden" />
            <textarea rows={1} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="메시지 입력..." className="flex-1 bg-transparent py-2.5 outline-none resize-none max-h-32 text-sm text-text-base custom-scrollbar" />
            <button type="submit" disabled={!newMessage.trim() && !isUploading} className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shrink-0 disabled:opacity-50 transition-all hover:scale-105 active:scale-95 mb-0.5 mr-0.5"><Send className="w-4 h-4 ml-0.5" /></button>
          </form>
        </div>
      </main>

      <Transition appear show={isNewDirectModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsNewDirectModalOpen(false)}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <Dialog.Title className="text-lg font-bold text-text-base flex items-center gap-2"><UserIcon className="w-5 h-5 text-primary" /> 대화할 사람 선택</Dialog.Title>
                <button onClick={() => setIsNewDirectModalOpen(false)} className="text-text-muted"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex items-center bg-bg-base border border-border-base rounded-lg px-2 py-1.5 mb-4 focus-within:border-primary">
                 <Search className="w-3.5 h-3.5 text-text-muted mr-1.5 shrink-0" />
                 <input type="text" placeholder="이름 검색..." value={directSearchTerm} onChange={e => setDirectSearchTerm(e.target.value)} className="bg-transparent text-sm text-text-base w-full outline-none" />
              </div>
              
              <div className="max-h-60 overflow-y-auto custom-scrollbar border border-border-base rounded-xl p-2 bg-bg-base space-y-1">
                {newDirectFilteredUsers.map(user => {
                  const dmRoomId = currentUser ? getDirectRoomId(currentUser.id, user.id) : '';
                  return (
                    <button key={user.id} onClick={() => { setIsNewDirectModalOpen(false); changeRoom({ type: 'direct', id: dmRoomId, name: user.name }); }} className="w-full flex items-center gap-3 p-2 hover:bg-bg-surface rounded-lg cursor-pointer transition">
                      <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0">{user.profile_image_url ? <img src={user.profile_image_url} className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 text-slate-500" />}</div>
                      <div className="text-left">
                        {/* 🌟 1:1 대화 상대방 검색 시 이름에 기수 표시 */}
                        <div className="text-sm font-bold text-text-base">{formatNameWithGen(user.name, user.generation)}</div>
                        <div className="text-[10px] text-text-muted">{user.session || '세션 미정'}</div>
                      </div>
                    </button>
                  );
                })}
                {newDirectFilteredUsers.length === 0 && <div className="text-xs text-center text-text-muted py-4">검색 결과가 없습니다.</div>}
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      {contextMenu && (
        <div 
          className="fixed z-50 bg-bg-surface border border-border-base shadow-2xl rounded-xl py-2 overflow-hidden w-40 animate-fade-in"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 100), left: Math.min(contextMenu.x, window.innerWidth - 160) }}
        >
          {contextMenu.type === 'message' && contextMenu.msg.sender_id === currentUser?.id ? (
            <button onClick={handleUnsendMessage} className="w-full text-left px-4 py-3 flex items-center gap-2 text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-sm font-bold">
              <Trash2 className="w-4 h-4" /> 메시지 취소
            </button>
          ) : contextMenu.type === 'media' && contextMenu.msg.media_url ? (
            <a href={contextMenu.msg.media_url} target="_blank" download className="w-full text-left px-4 py-3 flex items-center gap-2 text-text-base hover:bg-slate-100 dark:hover:bg-slate-800 transition text-sm font-bold">
              <Download className="w-4 h-4" /> 이미지/영상 저장
            </a>
          ) : (
             <div className="px-4 py-3 text-xs text-text-muted text-center">할 수 있는 작업이 없습니다.</div>
          )}
        </div>
      )}

      <Transition appear show={isRoomInfoOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsRoomInfoOpen(false)}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <Dialog.Title className="text-lg font-bold text-text-base flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> 단체방 참여자 ({roomMembers.length})</Dialog.Title>
                <button onClick={() => setIsRoomInfoOpen(false)} className="text-text-muted"><X className="w-5 h-5" /></button>
              </div>
              <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 mb-6">
                {roomMembers.map(member => (
                  <div key={member.id} className="flex items-center gap-3 p-2 bg-bg-base rounded-xl border border-border-base">
                    <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">{member.profile_image_url ? <img src={member.profile_image_url} className="w-full h-full object-cover"/> : <UserIcon className="w-4 h-4 text-slate-500 m-2"/>}</div>
                    {/* 🌟 단체방 참여자 목록에 기수 표시 */}
                    <span className="font-medium text-sm text-text-base">{formatNameWithGen(member.name, member.generation)} {member.id === currentUser?.id && '(나)'}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleLeaveRoom} className="w-full py-3 bg-rose-50 text-rose-500 font-bold rounded-xl hover:bg-rose-100 flex items-center justify-center gap-2 transition border border-rose-100">
                <LogOut className="w-4 h-4"/> 단체방 나가기
              </button>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      <Transition appear show={isCreateRoomOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsCreateRoomOpen(false)}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <Dialog.Title className="text-lg font-bold text-text-base flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" /> 새 단체방 만들기</Dialog.Title>
                <button onClick={() => setIsCreateRoomOpen(false)} className="text-text-muted"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block">채팅방 이름</label>
                  <input type="text" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="예: 건반 세션 모임" className="w-full bg-bg-base border border-border-base rounded-xl p-3 text-sm focus:border-primary outline-none" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-text-muted uppercase block">초대할 사람 선택 ({selectedUsers.length}명)</label>
                  </div>
                  <div className="flex items-center bg-bg-base border border-border-base rounded-lg px-2 py-1.5 mb-2 focus-within:border-primary">
                     <Search className="w-3.5 h-3.5 text-text-muted mr-1.5 shrink-0" />
                     <input type="text" placeholder="이름 검색..." value={newRoomSearchTerm} onChange={e => setNewRoomSearchTerm(e.target.value)} className="bg-transparent text-xs text-text-base w-full outline-none" />
                  </div>
                  
                  <div className="max-h-40 overflow-y-auto custom-scrollbar border border-border-base rounded-xl p-2 bg-bg-base">
                    {newRoomFilteredUsers.map(user => (
                      <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-bg-surface rounded-lg cursor-pointer">
                        <input type="checkbox" checked={selectedUsers.includes(user.id)} onChange={(e) => { e.target.checked ? setSelectedUsers([...selectedUsers, user.id]) : setSelectedUsers(selectedUsers.filter(id => id !== user.id)); }} className="w-4 h-4 accent-primary" />
                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0">{user.profile_image_url ? <img src={user.profile_image_url} className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 text-slate-500" />}</div>
                        {/* 🌟 단체방 초대 목록 검색 시 이름에 기수 표시 */}
                        <span className="text-sm font-medium">{formatNameWithGen(user.name, user.generation)}</span>
                      </label>
                    ))}
                    {newRoomFilteredUsers.length === 0 && <div className="text-xs text-center text-text-muted py-4">검색 결과가 없습니다.</div>}
                  </div>
                </div>
              </div>
              <button onClick={handleCreateCustomRoom} className="w-full mt-6 py-3.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 transition">채팅방 개설하기</button>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

    </div>
  );
}