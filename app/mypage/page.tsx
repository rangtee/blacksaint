"use client";
import React, { useState, useEffect, Fragment, useRef } from 'react';
import { User, Settings, Edit3, Phone, BookOpen, Music, FileText, ChevronRight, X, LogOut, Shield, Users, KeyRound, Plus, Moon, Sun, Palette, Camera, GraduationCap } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../lib/supabase';
import { useTheme } from 'next-themes'; 
import { useRouter } from 'next/navigation'; 

interface Profile { id: string; name: string; student_id: string; session: string; generation: string | null; major: string | null; phone: string | null; role: string; position: string | null; profile_image_url?: string; college?: string | null; grade?: string | null; enrollment_status?: string | null; }
interface Post { id: number; type: string; title: string; created_at: string; }
interface MyTeam { id: number; name: string; image_url: string | null; role: string; } 

export default function IntegratedProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [myTeams, setMyTeams] = useState<MyTeam[]>([]); 
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editSession, setEditSession] = useState(''); 
  const [editGeneration, setEditGeneration] = useState(''); // 🌟 기수 상태 추가
  
  const [editCollege, setEditCollege] = useState('');
  const [editMajor, setEditMajor] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editEnrollmentStatus, setEditEnrollmentStatus] = useState('재학');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const colorThemes = [
    { name: '오리지널 블루', hex: '#2536f4' },
    { name: '일렉트릭 퍼플', hex: '#9333ea' },
    { name: '민트 에메랄드', hex: '#10b981' },
    { name: '블러드 로즈', hex: '#f43f5e' },
    { name: '선셋 오렌지', hex: '#f97316' },
  ];

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (profileData) {
      setProfile(profileData);
      setEditName(profileData.name || ''); 
      setEditPhone(profileData.phone || '');
      setEditPosition(profileData.position || '미정');
      setEditSession(profileData.session || '미정'); 
      setEditGeneration(profileData.generation || ''); // 🌟 기수 세팅
      setEditCollege(profileData.college || '');
      setEditMajor(profileData.major || '');
      setEditGrade(profileData.grade || '');
      setEditEnrollmentStatus(profileData.enrollment_status || '재학');

      const { data: postData } = await supabase.from('posts').select('id, type, title, created_at').eq('author_name', profileData.name).order('created_at', { ascending: false });
      if (postData) setMyPosts(postData);

      const { data: teamData } = await supabase.from('team_members').select('role, teams(id, name, image_url)').eq('user_id', session.user.id);
      if (teamData) {
        const formattedTeams = teamData.filter((t: any) => t.teams).map((t: any) => ({ id: t.teams.id, name: t.teams.name, image_url: t.teams.image_url, role: t.role }));
        setMyTeams(formattedTeams);
      }
    }
  };

  useEffect(() => { 
    fetchData(); 
    setMounted(true); 
  }, []);

  const handleUpdateProfile = async () => {
    if (!profile) return;
    if (!editName.trim()) return alert('이름을 비울 수 없습니다.'); 
    
    setIsSubmitting(true);
    const { error } = await supabase.from('profiles').update({ 
      name: editName, 
      phone: editPhone, 
      college: editCollege,
      major: editMajor, 
      grade: editGrade,
      enrollment_status: editEnrollmentStatus,
      position: editPosition, 
      session: editSession,
      generation: editGeneration // 🌟 기수 저장
    }).eq('id', profile.id);
    
    setIsSubmitting(false);
    if (error) alert('수정 실패: ' + error.message);
    else { alert('프로필이 성공적으로 수정되었습니다! 🎉'); setIsEditing(false); fetchData(); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !profile) return;
    setIsUploading(true);
    try {
      const file = e.target.files[0];
      const filePath = `profiles/user_${profile.id}_${Math.random()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('community').upload(filePath, file);
      const { data: urlData } = supabase.storage.from('community').getPublicUrl(filePath);
      await supabase.from('profiles').update({ profile_image_url: urlData.publicUrl }).eq('id', profile.id);
      setProfile({ ...profile, profile_image_url: urlData.publicUrl });
      alert('프로필 사진이 변경되었습니다!');
    } catch (error: any) { alert('이미지 업로드 실패: ' + error.message); } finally { setIsUploading(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return alert('비밀번호는 6자리 이상이어야 합니다.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) alert('오류가 발생했습니다: ' + error.message);
    else { alert('비밀번호가 성공적으로 변경되었습니다!'); setIsChangingPassword(false); setNewPassword(''); }
  };

  const handleLogout = async () => {
    if (!confirm('정말로 로그아웃 하시겠습니까?')) return;
    await supabase.auth.signOut();
    window.location.href = '/login'; 
  };

  const changePrimaryColor = (hexValue: string) => {
    document.documentElement.style.setProperty('--primary', hexValue);
    localStorage.setItem('theme-primary', hexValue); 
  };

  if (!profile) return <div className="flex items-center justify-center h-full text-text-muted min-h-screen bg-bg-base transition-colors duration-300">데이터를 불러오는 중...</div>;

  return (
    <div className="flex-1 flex flex-col min-h-screen overflow-hidden relative font-sans transition-colors duration-300 bg-bg-base text-text-base">
      <header className="shrink-0 bg-bg-surface/80 backdrop-blur-md border-b border-border-base z-10 sticky top-0 transition-colors">
        <div className="flex items-center p-4 justify-between max-w-3xl mx-auto w-full">
          <div className="w-10"></div>
          <h2 className="text-xl font-bold text-text-base flex-1 text-center tracking-tight">마이페이지</h2>
          <button onClick={handleLogout} className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-500 transition" title="로그아웃"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-1 overflow-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto w-full p-4 lg:p-8 pb-24 space-y-6 lg:space-y-8">
          
          <section className="bg-bg-surface border border-border-base rounded-3xl p-6 lg:p-8 relative overflow-hidden shadow-sm dark:shadow-xl transition-colors">
            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-6 relative z-10 mb-6 border-b border-border-base pb-6 transition-colors">
              <div className="flex items-center gap-5">
                <div onClick={() => fileInputRef.current?.click()} className="relative w-20 h-20 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 transition-colors cursor-pointer group overflow-hidden border border-border-base">
                  {profile.profile_image_url ? <img src={profile.profile_image_url} alt="Profile" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" /> : <User className="w-10 h-10 group-hover:scale-110 transition-transform duration-300" />}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">{isUploading ? <span className="text-[10px] font-bold">업로드 중</span> : <Camera className="w-6 h-6" />}</div>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-2xl font-black text-text-base">{profile.name}</h3>
                    {profile.role === 'admin' || profile.role === 'president' ? <span className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-transparent px-2 py-0.5 rounded text-[10px] font-bold uppercase"><Shield className="w-3 h-3"/> 회장</span> : null}
                  </div>
                  <p className="text-sm font-medium text-text-muted mb-1">{profile.student_id} 학번</p>
                  <p className="text-xs font-bold text-primary transition-colors">{profile.session || '세션 미지정'} • {profile.generation || '기수 미지정'}</p>
                </div>
              </div>
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-text-base rounded-xl font-bold text-sm transition self-start sm:self-auto border border-border-base"><Edit3 className="w-4 h-4" /> 정보 수정</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10">
              <div className="flex flex-col gap-1 bg-bg-base border border-border-base p-4 rounded-2xl transition-colors">
                <div className="flex items-center gap-2 text-text-muted text-xs font-bold uppercase tracking-wider mb-1"><Music className="w-3.5 h-3.5" /> 포지션</div>
                <span className="font-bold text-text-base text-sm">{profile.position || '미정'}</span>
              </div>
              <div className="flex flex-col gap-1 bg-bg-base border border-border-base p-4 rounded-2xl transition-colors">
                <div className="flex items-center gap-2 text-text-muted text-xs font-bold uppercase tracking-wider mb-1"><GraduationCap className="w-3.5 h-3.5" /> 학적 상태</div>
                <span className="font-bold text-text-base text-sm"><span className={`${profile.enrollment_status === '재학' ? 'text-emerald-500' : 'text-amber-500'}`}>{profile.enrollment_status || '재학'}</span>{profile.grade ? ` (${profile.grade}학년)` : ''}</span>
              </div>
              <div className="flex flex-col gap-1 bg-bg-base border border-border-base p-4 rounded-2xl transition-colors">
                <div className="flex items-center gap-2 text-text-muted text-xs font-bold uppercase tracking-wider mb-1"><BookOpen className="w-3.5 h-3.5" /> 소속 정보</div>
                <span className="font-bold text-text-base text-sm line-clamp-1">{profile.college ? `${profile.college} ` : ''}{profile.major || '입력 안 됨'}</span>
              </div>
              <div className="flex flex-col gap-1 bg-bg-base border border-border-base p-4 rounded-2xl transition-colors">
                <div className="flex items-center gap-2 text-text-muted text-xs font-bold uppercase tracking-wider mb-1"><Phone className="w-3.5 h-3.5" /> 연락처</div>
                <span className="font-bold text-text-base text-sm">{profile.phone || '입력 안 됨'}</span>
              </div>
            </div>
          </section>

          {mounted && (
            <section className="bg-bg-surface border border-border-base rounded-3xl p-6 lg:p-8 shadow-sm dark:shadow-xl transition-colors">
              <h3 className="text-lg font-bold text-text-base flex items-center gap-2 mb-6"><Palette className="w-5 h-5 text-primary"/> 화면 및 테마 설정</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-3">모드 설정</label>
                  <div className="flex bg-bg-base p-1 rounded-xl w-fit border border-border-base transition-colors">
                    <button onClick={() => setTheme('light')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${theme === 'light' ? 'bg-bg-surface text-primary shadow-sm border border-border-base' : 'text-text-muted hover:text-text-base'}`}><Sun className="w-4 h-4" /> 라이트</button>
                    <button onClick={() => setTheme('dark')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${theme === 'dark' ? 'bg-bg-surface text-primary shadow-sm border border-border-base' : 'text-text-muted hover:text-text-base'}`}><Moon className="w-4 h-4" /> 다크</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-3">포인트 컬러</label>
                  <div className="flex flex-wrap gap-4">
                    {colorThemes.map((color) => <button key={color.name} onClick={() => changePrimaryColor(color.hex)} className="w-10 h-10 rounded-full border-2 border-transparent focus:border-slate-400 dark:focus:border-white ring-2 ring-transparent focus:ring-primary transition-transform hover:scale-110 shadow-md" style={{ backgroundColor: color.hex }} title={color.name} />)}
                  </div>
                </div>
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            <div className="space-y-6 lg:space-y-8">
              <section className="bg-bg-surface border border-border-base rounded-3xl p-6 lg:p-8 shadow-sm dark:shadow-xl transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-bold text-text-base flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary"/> 보안 설정</h3>
                  {!isChangingPassword && <button onClick={() => setIsChangingPassword(true)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 text-text-base text-xs font-bold rounded-lg border border-border-base hover:bg-slate-200 dark:hover:bg-slate-700/80 transition">비밀번호 변경</button>}
                </div>
                {isChangingPassword && (
                  <form onSubmit={handleChangePassword} className="mt-4 p-4 bg-bg-base rounded-2xl border border-border-base transition-colors">
                    <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wider">새 비밀번호 (6자리 이상)</label>
                    <div className="flex gap-2">
                      <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="새 비밀번호 입력" className="flex-1 bg-bg-surface border border-border-base rounded-xl px-4 py-2 text-text-base text-sm focus:border-primary outline-none transition-colors" />
                      <button type="submit" className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:brightness-110 shadow-lg shadow-primary/20 transition-all">저장</button>
                      <button type="button" onClick={() => setIsChangingPassword(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-text-base rounded-xl text-sm font-bold transition">취소</button>
                    </div>
                  </form>
                )}
                {!isChangingPassword && <p className="text-sm text-text-muted mt-1">안전한 서비스 이용을 위해 주기적으로 비밀번호를 변경해 주세요.</p>}
              </section>

              <section className="bg-bg-surface border border-border-base rounded-3xl p-6 lg:p-8 shadow-sm dark:shadow-xl transition-colors">
                <h3 className="text-lg font-bold text-text-base flex items-center gap-2 mb-4"><Users className="w-5 h-5 text-primary"/> 나의 소속 팀 <span className="bg-slate-100 dark:bg-slate-800/50 text-text-muted text-xs px-2.5 py-0.5 rounded-full ml-1 border border-border-base">{myTeams.length}</span></h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {myTeams.map(team => (
                    <div key={team.id} onClick={() => router.push(`/team?id=${team.id}`)} className="bg-bg-base border border-border-base p-4 rounded-2xl flex items-center gap-3 hover:border-primary/50 transition cursor-pointer group shadow-sm">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center font-bold text-text-muted overflow-hidden border border-border-base shrink-0 transition-colors">
                        {team.image_url ? <img src={team.image_url} alt={team.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" /> : team.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-text-base text-sm group-hover:text-primary transition-colors truncate">{team.name}</h4>
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{team.role}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary transition opacity-0 group-hover:opacity-100 -ml-1 shrink-0" />
                    </div>
                  ))}
                  <button onClick={() => router.push('/team')} className="bg-bg-base border-2 border-dashed border-border-base p-4 rounded-2xl flex flex-col items-center justify-center text-text-muted hover:text-primary hover:border-primary transition group min-h-22">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800/50 group-hover:bg-primary/10 flex items-center justify-center mb-1 transition-colors border border-border-base group-hover:border-primary/20"><Plus className="w-4 h-4 group-hover:scale-110 transition-transform" /></div>
                    <span className="font-bold text-xs">새로운 팀 찾기</span>
                  </button>
                </div>
              </section>
            </div>

            <section className="bg-bg-surface border border-border-base rounded-3xl p-6 lg:p-8 shadow-sm dark:shadow-xl flex flex-col h-full transition-colors">
              <h3 className="text-lg font-bold text-text-base mb-6 flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> 내가 작성한 글<span className="bg-slate-100 dark:bg-slate-800/50 text-text-muted text-xs px-2.5 py-0.5 rounded-full ml-1 border border-border-base">{myPosts.length}</span></h3>
              <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {myPosts.length === 0 ? (
                  <div className="text-center py-12 text-text-muted border border-dashed border-border-base rounded-2xl bg-bg-base flex flex-col items-center transition-colors"><FileText className="w-8 h-8 opacity-20 mb-2" /><p className="text-sm">아직 작성한 게시글이 없습니다.</p></div>
                ) : (
                  myPosts.map(post => (
                    <div key={post.id} className="flex items-center justify-between p-4 bg-bg-base border border-border-base rounded-2xl hover:border-slate-300 dark:hover:border-slate-500 transition cursor-pointer group">
                      <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/50 text-text-muted border border-border-base uppercase transition-colors">{post.type === 'free' ? '자유' : post.type === 'repair' ? '수리' : post.type === 'notice' ? '공지' : '커뮤니티'}</span>
                          <span className="text-xs text-text-muted">{new Date(post.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm font-semibold text-text-base group-hover:text-primary transition line-clamp-1">{post.title}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary transition" />
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      <Transition appear show={isEditing} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsEditing(false)}>
          <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm transition-opacity" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-md rounded-3xl bg-bg-surface border border-border-base p-6 lg:p-8 text-left shadow-2xl transition-colors max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-8">
                <Dialog.Title className="text-xl font-bold text-text-base flex items-center gap-2"><Settings className="w-5 h-5 text-primary" /> 프로필 수정</Dialog.Title>
                <button onClick={() => setIsEditing(false)} className="text-text-muted hover:text-text-base transition p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5"/></button>
              </div>
              
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block tracking-wider">이름</label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="실명 입력" className="w-full bg-bg-base border border-border-base rounded-xl p-3.5 text-text-base focus:border-primary outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block tracking-wider">기수</label>
                    <input type="text" value={editGeneration} onChange={e => setEditGeneration(e.target.value)} placeholder="예: 00기" className="w-full bg-bg-base border border-border-base rounded-xl p-3.5 text-text-base focus:border-primary outline-none transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block tracking-wider">재학/휴학</label>
                    <select value={editEnrollmentStatus} onChange={e => setEditEnrollmentStatus(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-3.5 text-text-base focus:border-primary outline-none transition-colors">
                      <option value="재학">재학</option>
                      <option value="휴학">휴학</option>
                      <option value="졸업">졸업</option>
                      <option value="수료">수료</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block tracking-wider">학년</label>
                    <select value={editGrade} onChange={e => setEditGrade(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-3.5 text-text-base focus:border-primary outline-none transition-colors">
                      <option value="">선택 안함</option>
                      <option value="1">1학년</option>
                      <option value="2">2학년</option>
                      <option value="3">3학년</option>
                      <option value="4">4학년</option>
                      <option value="5">5학년(초과)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block tracking-wider">단과대학</label>
                    <input type="text" value={editCollege} onChange={e => setEditCollege(e.target.value)} placeholder="예: 공과대학" className="w-full bg-bg-base border border-border-base rounded-xl p-3.5 text-text-base focus:border-primary outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block tracking-wider">학과 / 부서</label>
                    <input type="text" value={editMajor} onChange={e => setEditMajor(e.target.value)} placeholder="예: 컴퓨터공학과" className="w-full bg-bg-base border border-border-base rounded-xl p-3.5 text-text-base focus:border-primary outline-none transition-colors" />
                  </div>
                </div>

                <hr className="border-border-base my-2" />

                <div>
                  <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block tracking-wider">주 세션</label>
                  <select value={editSession} onChange={e => setEditSession(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-3.5 text-text-base focus:border-primary outline-none transition-colors">
                    <option value="미정">미정 (아직 정하지 않음)</option>
                    <option value="보컬">🎤 보컬 (Vocal)</option>
                    <option value="일렉기타">🎸 일렉기타 (E.Guitar)</option>
                    <option value="베이스">🎸 베이스 (Bass)</option>
                    <option value="드럼">🥁 드럼 (Drum)</option>
                    <option value="키보드">🎹 키보드 (Keyboard)</option>
                    <option value="어쿠스틱기타">🎸 어쿠스틱기타 (A.Guitar)</option>
                    <option value="엔지니어">🎧 음향/엔지니어</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block tracking-wider">세부 포지션 (선택)</label>
                  <input type="text" value={editPosition} onChange={e => setEditPosition(e.target.value)} placeholder="예: 메인 보컬, 퍼스트 기타" className="w-full bg-bg-base border border-border-base rounded-xl p-3.5 text-text-base focus:border-primary outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block tracking-wider">전화번호</label>
                  <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="010-0000-0000" className="w-full bg-bg-base border border-border-base rounded-xl p-3.5 text-text-base focus:border-primary outline-none transition-colors" />
                </div>
              </div>

              <div className="flex gap-3 mt-10">
                <button onClick={() => setIsEditing(false)} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-text-base font-bold rounded-xl transition-colors border border-border-base">취소</button>
                <button onClick={handleUpdateProfile} disabled={isSubmitting} className="flex-1 py-3.5 bg-primary text-white font-bold rounded-xl hover:brightness-110 disabled:opacity-50 transition shadow-lg shadow-primary/20">{isSubmitting ? '저장 중...' : '변경사항 저장'}</button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}