"use client";
import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Plus, Users, ChevronLeft, MoreVertical, Edit2, Shield, UserMinus, UserPlus, Info, Camera, Music, Trash2, X, Clock, Search, FolderPlus, Folder, ChevronUp, ChevronDown } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../lib/supabase';

// --- 인터페이스 정의 ---
interface TeamFolder { id: number; name: string; }
interface Team { id: number; name: string; bio: string | null; image_url: string | null; folder_id: number | null; memberCount?: number; }
interface Song { id: number; team_id: number; title: string; artist: string; duration_seconds: number; sort_order?: number; }
interface TeamMember { id: number; user_id: string; role: string; profiles: { name: string; session: string; student_id: string; }; }
interface Profile { id: string; name: string; session: string; student_id: string; }

export default function TeamManagementPage() {
  const [folders, setFolders] = useState<TeamFolder[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  
  const [currentView, setCurrentView] = useState<'list' | 'detail'>('list');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [globalRole, setGlobalRole] = useState<string>('member');

  // 모달 상태
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isAddSongModalOpen, setIsAddSongModalOpen] = useState(false);
  const [isEditTeamModalOpen, setIsEditTeamModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  // 폼 상태
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamBio, setNewTeamBio] = useState('');
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamBio, setEditTeamBio] = useState('');
  const [editTeamFolderId, setEditTeamFolderId] = useState<string>('');
  
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongArtist, setNewSongArtist] = useState('');
  const [newSongMinutes, setNewSongMinutes] = useState('');
  const [newSongSeconds, setNewSongSeconds] = useState('');
  
  const [newFolderName, setNewFolderName] = useState('');

  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [inviteSearchTerm, setInviteSearchTerm] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        setGlobalRole(profile?.role || 'member');
      }
      
      await fetchFolders();
      await fetchTeams();

      const urlParams = new URLSearchParams(window.location.search);
      const teamIdParam = urlParams.get('id');
      
      if (teamIdParam) {
        const { data: teamData } = await supabase
          .from('teams')
          .select('*, team_members(count)')
          .eq('id', teamIdParam)
          .single();
          
        if (teamData) {
          const formattedTeam = { ...teamData, memberCount: teamData.team_members[0]?.count || 0 };
          setSelectedTeam(formattedTeam);
          await fetchMembers(formattedTeam.id);
          await fetchSongs(formattedTeam.id);
          setCurrentView('detail');
        }
      }
    };
    init();
  }, []);

  // 🌟 권한 제어 변수들
  const isPresident = globalRole === 'president' || globalRole === 'admin';
  const isGlobalLeader = globalRole === 'leader';
  const isTeamMember = members.some(m => m.user_id === currentUser?.id);
  const isTeamLeader = members.some(m => m.user_id === currentUser?.id && m.role === 'Leader');
  
  const canManageTeam = isPresident || isGlobalLeader || isTeamLeader;
  const canAddContent = isTeamMember || isPresident;

  const fetchFolders = async () => {
    const { data } = await supabase.from('team_folders').select('*').order('id');
    if (data) setFolders(data as TeamFolder[]);
  };

  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select('*, team_members(count)').order('id', { ascending: false });
    if (data) {
      const formatted = data.map((t: any) => ({ ...t, memberCount: t.team_members[0]?.count || 0 }));
      setTeams(formatted);
    }
  };

  const fetchMembers = async (teamId: number) => {
    const { data } = await supabase.from('team_members').select('id, user_id, role, profiles(name, session, student_id)').eq('team_id', teamId).order('role', { ascending: true });
    if (data) setMembers(data as unknown as TeamMember[]);
  };

  // 🌟 곡 목록을 가져올 때 'sort_order' 기준으로 정렬하도록 수정
  const fetchSongs = async (teamId: number) => {
    const { data } = await supabase.from('team_songs').select('*').eq('team_id', teamId).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (data) setSongs(data as Song[]);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return alert('폴더 이름을 입력해주세요!');
    const { error } = await supabase.from('team_folders').insert([{ name: newFolderName }]);
    if (error) alert('폴더 생성 실패: ' + error.message);
    else {
      setNewFolderName('');
      setIsCreateFolderModalOpen(false);
      fetchFolders();
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;
    const confirmMsg = `정말로 [${selectedTeam.name}] 팀을 해체하시겠습니까?\n모든 멤버, 노래, 데이터가 영구 삭제됩니다!`;
    if (!confirm(confirmMsg)) return;

    const { error } = await supabase.from('teams').delete().eq('id', selectedTeam.id);
    if (error) alert('팀 삭제 실패: ' + error.message);
    else {
      alert('팀이 성공적으로 해체되었습니다.');
      setCurrentView('list');
      setSelectedTeam(null);
      window.history.pushState({}, '', '/team'); 
      fetchTeams();
    }
  };

  const handleOpenEditTeam = () => {
    if (selectedTeam) {
      setEditTeamName(selectedTeam.name);
      setEditTeamBio(selectedTeam.bio || '');
      setEditTeamFolderId(selectedTeam.folder_id ? selectedTeam.folder_id.toString() : '');
      setIsEditTeamModalOpen(true);
    }
  };

  const handleUpdateTeam = async () => {
    if (!editTeamName.trim() || !selectedTeam) return;
    const folderIdToSave = editTeamFolderId === '' ? null : parseInt(editTeamFolderId);
    
    const { error } = await supabase.from('teams').update({ name: editTeamName, bio: editTeamBio, folder_id: folderIdToSave }).eq('id', selectedTeam.id);
    if (error) alert('수정 실패: ' + error.message);
    else { 
      setIsEditTeamModalOpen(false); 
      fetchTeams(); 
      setSelectedTeam({ ...selectedTeam, name: editTeamName, bio: editTeamBio, folder_id: folderIdToSave }); 
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    const { data: newTeam, error } = await supabase.from('teams').insert([{ name: newTeamName, bio: newTeamBio }]).select().single();
    if (error) return alert('팀 생성 실패: ' + error.message);

    if (newTeam && currentUser) {
      await supabase.from('team_members').insert([{ team_id: newTeam.id, user_id: currentUser.id, role: 'Leader' }]);
    }
    
    setIsCreateModalOpen(false); setNewTeamName(''); setNewTeamBio(''); fetchTeams();
  };

  const handleOpenInviteModal = async () => {
    const { data } = await supabase.from('profiles').select('id, name, session, student_id').order('name');
    if (data) setAllProfiles(data as Profile[]);
    setIsInviteModalOpen(true);
  };

  const handleAddMemberDirectly = async (userId: string, userName: string) => {
    if (!selectedTeam) return;
    const { error } = await supabase.from('team_members').insert([{ team_id: selectedTeam.id, user_id: userId, role: 'Member' }]);
    if (error) alert(error.code === '23505' ? '이미 소속된 부원입니다!' : '추가 실패: ' + error.message);
    else { fetchMembers(selectedTeam.id); fetchTeams(); }
  };

  const handleKickMember = async () => {
    if (!selectedMember || !selectedTeam || !confirm('팀에서 내보내시겠습니까?')) return;
    await supabase.from('team_members').delete().eq('id', selectedMember.id);
    setIsActionSheetOpen(false); fetchMembers(selectedTeam.id); fetchTeams();
  };

  const handleChangeRole = async () => {
    if (!selectedMember || !selectedTeam) return;
    
    const newRole = selectedMember.role === 'Leader' ? 'Member' : 'Leader';
    const confirmMsg = newRole === 'Leader' 
      ? `[${selectedMember.profiles?.name}]님을 이 팀의 팀장(Leader)으로 임명하시겠습니까?` 
      : `[${selectedMember.profiles?.name}]님을 일반 팀원으로 강등하시겠습니까?`;
    
    if (!confirm(confirmMsg)) return;

    const { error } = await supabase.from('team_members').update({ role: newRole }).eq('id', selectedMember.id);
    if (error) alert('역할 변경 실패: ' + error.message);
    else {
      alert('역할이 성공적으로 변경되었습니다.');
      setIsActionSheetOpen(false);
      fetchMembers(selectedTeam.id);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedTeam) return;
    setIsUploading(true);
    try {
      const file = e.target.files[0];
      const filePath = `teams/team_${selectedTeam.id}_${Math.random()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('community').upload(filePath, file);
      const { data: urlData } = supabase.storage.from('community').getPublicUrl(filePath);
      await supabase.from('teams').update({ image_url: urlData.publicUrl }).eq('id', selectedTeam.id);
      setSelectedTeam({ ...selectedTeam, image_url: urlData.publicUrl }); fetchTeams();
    } finally { setIsUploading(false); }
  };

  // 🌟 새 곡을 추가할 때 현재 리스트의 제일 마지막 순서(sort_order)로 밀어 넣습니다.
  const handleAddSong = async () => {
    if (!newSongTitle.trim() || !newSongArtist.trim() || !selectedTeam) return;
    const totalSeconds = (parseInt(newSongMinutes || '0') * 60) + parseInt(newSongSeconds || '0');
    const newSortOrder = songs.length; // 배열 길이 = 마지막 순번

    await supabase.from('team_songs').insert([{ 
      team_id: selectedTeam.id, 
      title: newSongTitle, 
      artist: newSongArtist, 
      duration_seconds: totalSeconds,
      sort_order: newSortOrder
    }]);
    setNewSongTitle(''); setNewSongArtist(''); setNewSongMinutes(''); setNewSongSeconds(''); setIsAddSongModalOpen(false); fetchSongs(selectedTeam.id);
  };

  const handleDeleteSong = async (songId: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await supabase.from('team_songs').delete().eq('id', songId);
    if (selectedTeam) fetchSongs(selectedTeam.id);
  };

  // 🌟 곡 순서 변경(위/아래 이동) 함수
  const handleMoveSong = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === songs.length - 1) return;

    const newSongs = [...songs];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;

    // 로컬 상태(배열)에서 순서 바꾸기 (빠른 화면 전환용)
    const temp = newSongs[index];
    newSongs[index] = newSongs[swapIndex];
    newSongs[swapIndex] = temp;
    setSongs(newSongs);

    // DB에 새로운 순서 업데이트 (변경된 두 곡만 업데이트해도 되지만 안전하게 전체 인덱스 재정렬)
    for (let i = 0; i < newSongs.length; i++) {
      await supabase.from('team_songs').update({ sort_order: i }).eq('id', newSongs[i].id);
    }
  };

  const groupedTeams = folders.map(folder => ({
    ...folder,
    teams: teams.filter(t => t.folder_id === folder.id)
  }));
  const unassignedTeams = teams.filter(t => !t.folder_id);

  const totalSetlistSeconds = songs.reduce((acc, song) => acc + (song.duration_seconds || 0), 0);
  const totalSetlistMinutes = Math.floor(totalSetlistSeconds / 60);
  const remainingSetlistSeconds = totalSetlistSeconds % 60;
  
  const availableProfiles = allProfiles.filter(p => !members.some(m => m.user_id === p.id) && (p.name.includes(inviteSearchTerm) || p.student_id.includes(inviteSearchTerm)));

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base text-text-base font-sans overflow-hidden transition-colors duration-300">
      
      <header className="h-16 shrink-0 border-b border-border-base flex items-center justify-between px-4 lg:px-8 bg-bg-surface/80 backdrop-blur-md z-10 transition-colors">
        <div className="flex items-center gap-2">
          {currentView === 'detail' && (
            <button onClick={() => { 
                setCurrentView('list'); 
                setSelectedTeam(null);
                window.history.pushState({}, '', '/team');
              }} className="p-2 mr-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 text-text-muted hover:text-text-base transition">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <h2 className="text-xl font-bold flex items-center gap-2 text-text-base">
            {currentView === 'list' ? <><Users className="w-5 h-5 text-primary" /> 팀 목록</> : selectedTeam?.name}
          </h2>
        </div>
        
        {currentView === 'list' && isPresident && (
          <button onClick={() => setIsCreateFolderModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-text-muted hover:text-text-base text-xs font-bold rounded-lg border border-border-base transition shrink-0">
            <FolderPlus className="w-4 h-4" /> 새 폴더 생성
          </button>
        )}
      </header>

      <main className="flex-1 overflow-auto custom-scrollbar p-4 lg:p-8">
        <div className="max-w-5xl mx-auto w-full">
          
          {/* ==========================================
              뷰 1: 폴더별 팀 목록 
          ========================================== */}
          {currentView === 'list' && (
            <div className="space-y-10">
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <button onClick={() => setIsCreateModalOpen(true)} className="aspect-square flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border-base hover:border-primary hover:bg-primary/5 text-text-muted hover:text-primary bg-bg-surface transition-all group shadow-sm dark:shadow-none">
                  <div className="w-12 h-12 rounded-full bg-bg-base group-hover:bg-primary/10 flex items-center justify-center transition-colors"><Plus className="w-6 h-6" /></div>
                  <span className="font-bold text-sm">새 팀 생성</span>
                </button>
              </div>

              {groupedTeams.map(folder => folder.teams.length > 0 && (
                <div key={folder.id} className="space-y-4">
                  <h3 className="text-sm font-bold text-text-muted flex items-center gap-2 border-b border-border-base pb-2 transition-colors">
                    <Folder className="w-4 h-4 text-primary" /> {folder.name} <span className="text-xs bg-bg-surface border border-border-base text-text-muted px-2 py-0.5 rounded-full">{folder.teams.length}</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {folder.teams.map(team => (
                      <div key={team.id} onClick={() => { setSelectedTeam(team); fetchMembers(team.id); fetchSongs(team.id); setCurrentView('detail'); }} className="aspect-square relative rounded-xl overflow-hidden cursor-pointer group shadow-sm dark:shadow-lg border border-border-base transition-colors">
                        <img src={team.image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600&auto=format&fit=crop'} alt={team.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 bg-slate-200 dark:bg-slate-800" />
                        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity" />
                        <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col justify-end">
                          <h3 className="text-lg font-black text-white mb-1 leading-tight line-clamp-1">{team.name}</h3>
                          <div className="flex items-center gap-1.5 text-xs text-white/90 font-medium bg-black/30 w-fit px-2 py-1 rounded-md backdrop-blur-sm border border-white/20 transition-colors">
                            <Users className="w-3 h-3 text-primary" /> {team.memberCount}명
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {unassignedTeams.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-text-muted flex items-center gap-2 border-b border-border-base pb-2 transition-colors">
                    기본 (미분류) <span className="text-xs bg-bg-surface border border-border-base text-text-muted px-2 py-0.5 rounded-full">{unassignedTeams.length}</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {unassignedTeams.map(team => (
                      <div key={team.id} onClick={() => { setSelectedTeam(team); fetchMembers(team.id); fetchSongs(team.id); setCurrentView('detail'); }} className="aspect-square relative rounded-xl overflow-hidden cursor-pointer group shadow-sm dark:shadow-lg border border-border-base transition-colors">
                        <img src={team.image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600&auto=format&fit=crop'} alt={team.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 bg-slate-200 dark:bg-slate-800" />
                        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity" />
                        <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col justify-end">
                          <h3 className="text-lg font-black text-white mb-1 leading-tight line-clamp-1">{team.name}</h3>
                          <div className="flex items-center gap-1.5 text-xs text-white/90 font-medium bg-black/30 w-fit px-2 py-1 rounded-md backdrop-blur-sm border border-white/20 transition-colors">
                            <Users className="w-3 h-3 text-primary" /> {team.memberCount}명
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ==========================================
              뷰 2: 팀 상세 관리
          ========================================== */}
          {currentView === 'detail' && selectedTeam && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-24">
              
              <div className="bg-bg-surface rounded-2xl overflow-hidden border border-border-base shadow-sm dark:shadow-xl relative group transition-colors">
                <div className="h-48 w-full relative bg-slate-200 dark:bg-slate-800">
                  <img src={selectedTeam.image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600&auto=format&fit=crop'} alt={selectedTeam.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                    {canAddContent && (
                      <>
                        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 bg-black/60 hover:bg-black/80 text-white px-5 py-2.5 rounded-full font-bold backdrop-blur-md border border-white/20 transition">
                          <Camera className="w-5 h-5" /> {isUploading ? '업로드 중...' : '대표 사진 변경'}
                        </button>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                      </>
                    )}
                  </div>
                </div>
                
                <div className="p-6 lg:p-8 relative z-10 -mt-8">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                      <h1 className="text-3xl font-black text-text-base mb-2 drop-shadow-md">{selectedTeam.name}</h1>
                      <p className="text-text-muted flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> {selectedTeam.bio || '등록된 팀 소개가 없습니다.'}</p>
                    </div>
                    <div className="flex flex-wrap gap-3 w-full md:w-auto">
                      
                      {canManageTeam && (
                        <button onClick={handleDeleteTeam} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 border border-rose-200 dark:border-rose-500/20 rounded-xl text-sm font-bold transition">
                          <Trash2 className="w-4 h-4" /> 팀 해체
                        </button>
                      )}

                      {canManageTeam && (
                        <button onClick={handleOpenEditTeam} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-bg-base hover:brightness-95 dark:hover:brightness-110 border border-border-base text-text-base rounded-xl text-sm font-bold transition">
                          <Edit2 className="w-4 h-4" /> 정보 수정
                        </button>
                      )}

                      {canAddContent && (
                        <button onClick={handleOpenInviteModal} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:brightness-110 shadow-lg shadow-primary/20 rounded-xl text-sm font-bold text-white transition">
                          <UserPlus className="w-4 h-4" /> 팀원 추가
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 셋리스트 */}
                <div>
                  <div className="flex flex-wrap items-center justify-between mb-4 ml-2 gap-2">
                    <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest flex items-center gap-2"><Music className="w-4 h-4 text-primary" /> Setlist <span className="bg-bg-surface border border-border-base text-text-muted px-2 py-0.5 rounded-full text-xs">{songs.length}</span></h3>
                    <div className="flex items-center gap-3">
                      {songs.length > 0 && <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-200 dark:border-amber-500/20 px-2 py-1 rounded-md text-xs font-bold"><Clock className="w-3 h-3" /> 예상 {totalSetlistMinutes}분 {remainingSetlistSeconds.toString().padStart(2, '0')}초</div>}
                      
                      {canAddContent && (
                        <button onClick={() => setIsAddSongModalOpen(true)} className="text-xs font-bold text-primary hover:text-text-base transition flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-md"><Plus className="w-3 h-3" /> 곡 추가</button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {songs.length === 0 ? <div className="bg-bg-surface border border-border-base border-dashed rounded-xl p-8 text-center text-text-muted transition-colors"><Music className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">등록된 합주곡이 없습니다.<br/>새로운 곡을 추가해보세요!</p></div> : songs.map((song, idx) => (
                      <div key={song.id} className="flex items-center justify-between p-4 bg-bg-surface border border-border-base rounded-xl hover:border-primary/50 transition-colors group shadow-sm dark:shadow-none">
                        <div className="flex items-center gap-4">
                          <div className="text-text-muted font-bold text-lg w-4">{idx + 1}</div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <h4 className="font-bold text-text-base text-base leading-tight">{song.title}</h4>
                              {song.duration_seconds > 0 && <span className="text-[10px] bg-bg-base border border-border-base text-text-muted px-1.5 py-0.5 rounded font-medium transition-colors">{Math.floor(song.duration_seconds / 60)}:{String(song.duration_seconds % 60).padStart(2, '0')}</span>}
                            </div>
                            <p className="text-xs text-text-muted font-medium">{song.artist}</p>
                          </div>
                        </div>
                        
                        {/* 🌟 순서 변경(위/아래) & 곡 삭제 버튼 영역 */}
                        {canAddContent && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleMoveSong(idx, 'up')} disabled={idx === 0} className="p-1.5 text-text-muted hover:text-text-base hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition disabled:opacity-30 disabled:hover:bg-transparent">
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleMoveSong(idx, 'down')} disabled={idx === songs.length - 1} className="p-1.5 text-text-muted hover:text-text-base hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition disabled:opacity-30 disabled:hover:bg-transparent">
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteSong(song.id)} className="p-1.5 ml-1 text-text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 멤버 */}
                <div>
                  <div className="flex items-center justify-between mb-4 ml-2">
                    <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">Members <span className="bg-bg-surface border border-border-base text-text-muted px-2 py-0.5 rounded-full text-xs">{members.length}</span></h3>
                    
                    {canAddContent && (
                      <button onClick={handleOpenInviteModal} className="text-xs font-bold text-primary hover:text-text-base transition flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-md"><UserPlus className="w-3 h-3" /> 팀원 추가</button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {members.length === 0 ? <div className="bg-bg-surface border border-border-base border-dashed rounded-xl p-8 text-center text-text-muted text-sm transition-colors">팀원이 없습니다.</div> : members.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-4 bg-bg-surface border border-border-base rounded-xl hover:border-primary/50 transition-colors group shadow-sm dark:shadow-none">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-bg-base border border-border-base flex items-center justify-center text-base font-bold text-text-muted transition-colors">{member.profiles?.name?.charAt(0) || '?'}</div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-text-base text-sm">{member.profiles?.name}</h4>
                              {member.role === 'Leader' ? <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 dark:border-primary/30 uppercase"><Shield className="w-2.5 h-2.5" /> Leader</span> : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-bg-base text-text-muted border border-border-base uppercase transition-colors">Member</span>}
                            </div>
                            <div className="text-[11px] text-text-muted">{member.profiles?.session || '포지션 미정'}</div>
                          </div>
                        </div>
                        {canManageTeam && member.user_id !== currentUser?.id && (
                          <button onClick={() => { setSelectedMember(member); setIsActionSheetOpen(true); }} className="p-2 text-text-muted hover:text-text-base hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 모달들... */}
      <Transition appear show={isCreateFolderModalOpen} as={Fragment}><Dialog as="div" className="relative z-50" onClose={() => setIsCreateFolderModalOpen(false)}><Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"><div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm" /></Transition.Child><div className="fixed inset-0 flex items-center justify-center p-4"><Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"><Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl transition-colors"><Dialog.Title className="text-xl font-bold text-text-base mb-6">새 폴더 생성</Dialog.Title><div className="space-y-5"><div><label className="text-xs font-bold text-text-muted uppercase mb-1.5 block">폴더 이름</label><input type="text" placeholder="예: 1학기 공연조" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-4 text-text-base focus:border-primary outline-none transition-colors" /></div></div><div className="flex gap-3 mt-8"><button onClick={() => setIsCreateFolderModalOpen(false)} className="flex-1 py-3.5 bg-bg-base hover:brightness-95 dark:hover:brightness-110 border border-border-base text-text-base font-bold rounded-xl transition-colors">취소</button><button onClick={handleCreateFolder} className="flex-1 py-3.5 bg-primary hover:brightness-110 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition">만들기</button></div></Dialog.Panel></Transition.Child></div></Dialog></Transition>

      <Transition appear show={isEditTeamModalOpen} as={Fragment}><Dialog as="div" className="relative z-50" onClose={() => setIsEditTeamModalOpen(false)}><Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"><div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm" /></Transition.Child><div className="fixed inset-0 flex items-center justify-center p-4"><Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"><Dialog.Panel className="w-full max-w-md rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl transition-colors"><div className="flex justify-between items-center mb-6"><Dialog.Title className="text-xl font-bold text-text-base">팀 정보 수정</Dialog.Title><button onClick={() => setIsEditTeamModalOpen(false)} className="text-text-muted hover:text-text-base transition-colors"><X className="w-5 h-5"/></button></div><div className="space-y-5"><div><label className="text-xs font-bold text-text-muted uppercase mb-1.5 block">팀 이름</label><input type="text" value={editTeamName} onChange={e => setEditTeamName(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-4 text-text-base focus:border-primary outline-none transition-colors" /></div><div><label className="text-xs font-bold text-text-muted uppercase mb-1.5 block">팀 소개</label><textarea rows={3} value={editTeamBio} onChange={e => setEditTeamBio(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-4 text-text-base focus:border-primary outline-none transition-colors resize-none custom-scrollbar" /></div>
        {isPresident && (
          <div>
            <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block">소속 폴더 (관리자 전용)</label>
            <select value={editTeamFolderId} onChange={e => setEditTeamFolderId(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-4 text-text-base focus:border-primary outline-none transition-colors">
              <option value="">미분류 (기본)</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}
        </div><button onClick={handleUpdateTeam} className="w-full mt-8 py-3.5 bg-primary hover:brightness-110 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition">수정 완료</button></Dialog.Panel></Transition.Child></div></Dialog></Transition>

      <Transition appear show={isCreateModalOpen} as={Fragment}><Dialog as="div" className="relative z-50" onClose={() => setIsCreateModalOpen(false)}><Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"><div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm" /></Transition.Child><div className="fixed inset-0 flex items-center justify-center p-4"><Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"><Dialog.Panel className="w-full max-w-md rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl transition-colors"><Dialog.Title className="text-xl font-bold text-text-base mb-6">새 팀 생성</Dialog.Title><div className="space-y-5"><div><label className="text-xs font-bold text-text-muted uppercase mb-1.5 block">팀 이름</label><input type="text" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-4 text-text-base focus:border-primary outline-none transition-colors" /></div><div><label className="text-xs font-bold text-text-muted uppercase mb-1.5 block">팀 소개</label><textarea rows={3} value={newTeamBio} onChange={e => setNewTeamBio(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-4 text-text-base focus:border-primary outline-none transition-colors resize-none custom-scrollbar" /></div></div><div className="flex gap-3 mt-8"><button onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-3.5 bg-bg-base hover:brightness-95 dark:hover:brightness-110 border border-border-base text-text-base font-bold rounded-xl transition-colors">취소</button><button onClick={handleCreateTeam} className="flex-1 py-3.5 bg-primary hover:brightness-110 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition">생성하기</button></div></Dialog.Panel></Transition.Child></div></Dialog></Transition>
      
      <Transition appear show={isAddSongModalOpen} as={Fragment}><Dialog as="div" className="relative z-50" onClose={() => setIsAddSongModalOpen(false)}><Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"><div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm" /></Transition.Child><div className="fixed inset-0 flex items-center justify-center p-4"><Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"><Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl transition-colors"><div className="flex justify-between items-center mb-6"><Dialog.Title className="text-lg font-bold text-text-base flex items-center gap-2"><Music className="w-5 h-5 text-primary" /> 합주곡 추가</Dialog.Title><button onClick={() => setIsAddSongModalOpen(false)} className="text-text-muted hover:text-text-base transition-colors"><X className="w-5 h-5"/></button></div><div className="space-y-4"><div><label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">아티스트</label><input type="text" value={newSongArtist} onChange={e => setNewSongArtist(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-4 text-text-base focus:border-primary outline-none transition-colors" /></div><div><label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">곡 제목</label><input type="text" value={newSongTitle} onChange={e => setNewSongTitle(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-4 text-text-base focus:border-primary outline-none transition-colors" /></div><div><label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">곡 길이</label><div className="flex items-center gap-3"><div className="flex-1 flex items-center bg-bg-base border border-border-base rounded-xl pr-4 transition-colors"><input type="number" value={newSongMinutes} onChange={e => setNewSongMinutes(e.target.value)} className="w-full bg-transparent p-4 text-text-base outline-none text-right" /><span className="text-text-muted font-bold ml-1">분</span></div><div className="flex-1 flex items-center bg-bg-base border border-border-base rounded-xl pr-4 transition-colors"><input type="number" value={newSongSeconds} onChange={e => setNewSongSeconds(e.target.value)} className="w-full bg-transparent p-4 text-text-base outline-none text-right" /><span className="text-text-muted font-bold ml-1">초</span></div></div></div></div><button onClick={handleAddSong} className="w-full py-4 mt-8 bg-primary hover:brightness-110 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition">추가하기</button></Dialog.Panel></Transition.Child></div></Dialog></Transition>
      
      <Transition appear show={isInviteModalOpen} as={Fragment}><Dialog as="div" className="relative z-50" onClose={() => setIsInviteModalOpen(false)}><Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"><div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm" /></Transition.Child><div className="fixed inset-0 flex items-center justify-center p-4"><Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"><Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl transition-colors"><div className="flex justify-between items-center mb-4"><Dialog.Title className="text-xl font-bold text-text-base flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary"/> 팀원 직접 추가</Dialog.Title><button onClick={() => setIsInviteModalOpen(false)} className="text-text-muted hover:text-text-base transition-colors"><X className="w-5 h-5"/></button></div><div className="flex items-center bg-bg-base border border-border-base rounded-xl px-4 py-3 mb-4 focus-within:border-primary transition-colors"><Search className="w-4 h-4 text-text-muted mr-2 shrink-0" /><input type="text" placeholder="이름이나 학번으로 검색..." value={inviteSearchTerm} onChange={e => setInviteSearchTerm(e.target.value)} className="bg-transparent text-sm text-text-base w-full outline-none" /></div><div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 mb-4 pr-1">{availableProfiles.length === 0 ? <div className="text-center p-4 text-text-muted text-sm transition-colors">추가할 수 있는 부원이 없습니다.</div> : availableProfiles.map(p => (<div key={p.id} className="flex items-center justify-between p-3 bg-bg-base border border-border-base rounded-xl transition-colors"><div><div className="font-bold text-text-base text-sm">{p.name} <span className="text-xs text-text-muted font-normal ml-1">{p.student_id}</span></div><div className="text-[11px] text-text-muted">{p.session || '세션 미정'}</div></div><button onClick={() => handleAddMemberDirectly(p.id, p.name)} className="px-3 py-1.5 bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary hover:text-white text-xs font-bold rounded-lg transition">추가</button></div>))}</div><button onClick={() => setIsInviteModalOpen(false)} className="w-full py-3 bg-bg-base hover:brightness-95 dark:hover:brightness-110 border border-border-base text-text-base font-bold rounded-xl transition-colors">닫기</button></Dialog.Panel></Transition.Child></div></Dialog></Transition>
      
      <Transition appear show={isActionSheetOpen} as={Fragment}><Dialog as="div" className="relative z-50" onClose={() => setIsActionSheetOpen(false)}><Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"><div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" /></Transition.Child><div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4"><Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 translate-y-full sm:translate-y-0 sm:scale-95" enterTo="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 translate-y-0 sm:scale-100" leaveTo="opacity-0 translate-y-full sm:translate-y-0 sm:scale-95"><Dialog.Panel className="w-full sm:max-w-sm bg-bg-surface border-t sm:border border-border-base rounded-t-3xl sm:rounded-3xl p-6 pb-8 sm:pb-6 shadow-2xl transition-colors"><div className="flex flex-col items-center mb-6"><div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mb-4 sm:hidden" /><h3 className="text-lg font-bold text-text-base">{selectedMember?.profiles?.name}</h3><p className="text-sm text-text-muted">{selectedMember?.profiles?.session}</p></div>
        
        <div className="space-y-2">
          <button onClick={handleChangeRole} className="w-full flex items-center gap-3 p-4 bg-bg-base hover:brightness-95 dark:hover:brightness-110 rounded-xl text-text-base font-medium transition-colors border border-border-base">
            <Shield className="w-5 h-5 text-text-muted" /> 
            {selectedMember?.role === 'Leader' ? '일반 팀원으로 강등' : '팀장(Leader)으로 승급'}
          </button>
          
          <div className="h-px bg-border-base my-2 transition-colors" />
          
          <button onClick={handleKickMember} className="w-full flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-100 dark:border-rose-500/20 rounded-xl text-rose-500 font-bold transition-colors">
            <UserMinus className="w-5 h-5" /> 팀에서 내보내기
          </button>
        </div>

        <button onClick={() => setIsActionSheetOpen(false)} className="w-full mt-4 py-4 text-text-muted font-bold hover:text-text-base transition-colors sm:hidden">닫기</button></Dialog.Panel></Transition.Child></div></Dialog></Transition>

    </div>
  );
}