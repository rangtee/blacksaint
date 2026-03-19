"use client";
import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Users, Download, UserPlus, Search, Shield, ChevronDown, FileSpreadsheet, ToggleLeft, ToggleRight, HardDrive, Image as ImageIcon, Trash2, FolderTree, Folder, Edit2, LayoutList, Plus, X as CloseIcon, UploadCloud, FolderPlus, Loader2 } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx'; // 🌟 엑셀 라이브러리 불러오기

// 🌟 프로필 인터페이스 확장 (재학/휴학 상태 추가)[cite: 5]
interface Profile { id: string; name: string; student_id: string; session: string; role: string; can_reserve: boolean; can_post: boolean; phone?: string; team_names?: string[]; college?: string; major?: string; grade?: string; enrollment_status?: string; }
interface BoardCategory { id: number; name: string; parent_id: number | null; is_admin_only: boolean; }

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'members' | 'files' | 'folders' | 'categories'>('members');

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [storageFiles, setStorageFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [categories, setCategories] = useState<BoardCategory[]>([]);

  // 모달 상태 관리
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isEditFolderModalOpen, setIsEditFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editFolderId, setEditFolderId] = useState<number | null>(null);
  const [editFolderName, setEditFolderName] = useState('');

  const [newCatName, setNewCatName] = useState('');
  const [newCatParentId, setNewCatParentId] = useState<string>('');
  const [newCatIsAdmin, setNewCatIsAdmin] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newStudentId, setNewStudentId] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('member'); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number, isUploading: boolean}>({ current: 0, total: 0, isUploading: false });

  const fetchData = async () => {
    setIsLoading(true);
    // 🌟 profiles 테이블에서 enrollment_status 도 함께 가져옴[cite: 5]
    const { data: pData } = await supabase.from('profiles').select(`id, name, student_id, phone, session, role, can_reserve, can_post, college, major, grade, enrollment_status, team_members ( teams ( name ) )`).order('name');
    if (pData) setProfiles(pData.map((p: any) => ({ ...p, team_names: p.team_members?.map((tm: any) => tm.teams?.name).filter(Boolean) || [] })));
    
    const { data: fData } = await supabase.from('team_folders').select('id, name, created_at, teams(count)').order('created_at', { ascending: false });
    if (fData) setFolders(fData);
    
    const { data: sData } = await supabase.storage.from('community').list('teams', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (sData) setStorageFiles(sData.filter(f => f.name !== '.emptyFolderPlaceholder'));
    
    fetchCategories();
    setIsLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('board_categories').select('*').order('id');
    if (data) setCategories(data);
  };

  useEffect(() => { fetchData(); }, []);

  // --- 카테고리 관리 ---
  const handleSaveCategory = async () => {
    if (!newCatName.trim()) return alert('카테고리 이름을 입력하세요!');
    const payload = { name: newCatName, parent_id: newCatParentId ? parseInt(newCatParentId) : null, is_admin_only: newCatIsAdmin };
    const { error } = await supabase.from('board_categories').insert([payload]);
    if (error) alert('생성 실패: ' + error.message);
    else { setIsCategoryModalOpen(false); setNewCatName(''); setNewCatParentId(''); setNewCatIsAdmin(false); fetchCategories(); }
  };

  const handleDeleteCategory = async (catId: number, catName: string) => {
    if (!confirm(`[${catName}] 카테고리를 삭제하시겠습니까?\n서브 카테고리도 함께 삭제될 수 있습니다.`)) return;
    await supabase.from('board_categories').delete().eq('id', catId);
    fetchCategories();
  };

  // --- 팀 폴더 관리 ---
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return alert('폴더 이름을 입력해주세요!');
    const { error } = await supabase.from('team_folders').insert([{ name: newFolderName }]);
    if (error) alert('폴더 생성 실패: ' + error.message);
    else { setNewFolderName(''); setIsCreateFolderModalOpen(false); fetchData(); }
  };

  const openEditFolderModal = (id: number, currentName: string) => {
    setEditFolderId(id); setEditFolderName(currentName); setIsEditFolderModalOpen(true);
  };

  const handleEditFolder = async () => {
    if (!editFolderName.trim() || !editFolderId) return alert('변경할 이름을 입력해주세요!');
    const { error } = await supabase.from('team_folders').update({ name: editFolderName }).eq('id', editFolderId);
    if (error) alert('폴더 이름 변경 실패: ' + error.message);
    else { setIsEditFolderModalOpen(false); setEditFolderId(null); setEditFolderName(''); fetchData(); }
  };

  const handleDeleteFolder = async (folderId: number, folderName: string) => {
    if (!confirm(`🚨 [${folderName}] 폴더를 삭제하시겠습니까?\n(폴더 안에 있던 팀들은 삭제되지 않고 '미분류' 상태로 변경됩니다.)`)) return;
    const { error } = await supabase.from('team_folders').delete().eq('id', folderId);
    if (error) alert('폴더 삭제 실패: ' + error.message);
    else fetchData();
  };

  // --- 부원 관리 함수 ---
  const handleManualRegister = async () => {
    if (!newName || !newStudentId || !newPhone) return alert('이름, 학번, 전화번호를 모두 입력해주세요.');
    if (newPhone.length < 6) return alert('비밀번호로 사용될 전화번호는 6자리 이상이어야 합니다.');
    
    setIsSubmitting(true);
    const pseudoEmail = `${newStudentId}@bandon.com`;

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({ email: pseudoEmail, password: newPhone });
      if (authError) {
        if (authError.message.includes('already registered')) alert('이미 등록된 학번입니다!');
        else alert('계정 생성 에러: ' + authError.message);
        setIsSubmitting(false); return;
      }

      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: authData.user.id, name: newName, student_id: newStudentId, phone: newPhone, role: newRole, session: '미정', can_reserve: true, can_post: true, enrollment_status: '재학'
        });
        if (profileError) throw profileError;
        alert(`[${newName}] 부원이 명단에 성공적으로 추가되었습니다!\n\n아이디: ${newStudentId}\n초기 비밀번호: ${newPhone}`);
        setIsAddMemberModalOpen(false); setNewName(''); setNewStudentId(''); setNewPhone(''); setNewRole('member'); fetchData(); 
      }
    } catch (err: any) {
      alert("오류가 발생했습니다: " + err.message);
    } finally { setIsSubmitting(false); }
  };

  // 🌟 일괄 등록 (.xlsx 엑셀 파일 업로드 처리)[cite: 5]
  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('엑셀(.xlsx, .xls) 형식의 파일만 업로드 가능합니다.');
      return;
    }

    if (!confirm('업로드하신 파일로 회원 일괄 등록을 시작하시겠습니까?\n(인원이 많을 경우 시간이 다소 소요될 수 있습니다.)')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 엑셀 시트를 JSON 배열로 변환
        const parsedData = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        if (parsedData.length === 0) {
          alert('올바른 데이터를 찾을 수 없습니다. 엑셀 양식을 확인해주세요.');
          return;
        }

        setUploadProgress({ current: 0, total: parsedData.length, isUploading: true });
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < parsedData.length; i++) {
          const row = parsedData[i];
          const name = String(row['성명'] || '').trim();
          const college = String(row['단대'] || '').trim();
          const major = String(row['학과(부)'] || '').trim();
          const studentId = String(row['학번'] || '').trim();
          const grade = String(row['학년'] || '').trim();
          const phone = String(row['연락처'] || '').replace(/-/g, '').trim(); 
          const enrollmentStatus = String(row['재학/휴학'] || '재학').trim(); 

          if (!name || !studentId || !phone) {
            console.warn(`행 무시됨 (필수값 누락): ${JSON.stringify(row)}`);
            failCount++;
            continue;
          }

          const pseudoEmail = `${studentId}@bandon.com`;
          
          try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
              email: pseudoEmail,
              password: phone,
            });

            if (authError) {
              console.error(`[${name}] 계정 생성 실패:`, authError.message);
              failCount++;
            } else if (authData.user) {
              const { error: profileError } = await supabase.from('profiles').upsert({
                id: authData.user.id,
                name: name,
                student_id: studentId,
                phone: phone,
                college: college,
                major: major,
                grade: grade,
                enrollment_status: enrollmentStatus, // 🌟 재학/휴학 반영
                role: 'member', 
                session: '미정',
                can_reserve: true,
                can_post: true
              });

              if (profileError) throw profileError;
              successCount++;
            }
          } catch (err) {
            console.error(`[${name}] 프로필 저장 실패:`, err);
            failCount++;
          }
          
          setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }

        alert(`일괄 등록이 완료되었습니다!\n✅ 성공: ${successCount}명\n❌ 실패/중복: ${failCount}명`);
      } catch (err) {
        alert('파일을 읽는 중 오류가 발생했습니다. 파일이 손상되었거나 올바른 엑셀이 아닙니다.');
      } finally {
        setUploadProgress({ current: 0, total: 0, isUploading: false });
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsBatchOpen(false);
        fetchData();
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // 🌟 지정된 양식에 맞춰 XLSX 다운로드 템플릿 생성[cite: 5]
  const downloadTemplate = () => {
    const ws_data = [
      ['성명', '단대', '학과(부)', '학번', '학년', '연락처', '재학/휴학'],
      ['홍길동', '공과대학', '컴퓨터공학부', '20240001', '3', '01012345678', '재학']
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "회원등록양식");
    
    // 열 너비 조절
    ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 15 }, { wch: 12 }];
    
    XLSX.writeFile(wb, `동아리_부원일괄등록_양식.xlsx`);
  };

  // 🌟 멤버 리스트 내보내기도 XLSX 포맷으로 변경[cite: 5]
  const exportToExcel = () => {
    const headers = ['성명', '단대', '학과(부)', '학번', '학년', '재학/휴학', '연락처', '등급', '소속 팀', '주 세션'];
    const rows = profiles.map(p => [ 
      p.name, 
      p.college || '', 
      p.major || '', 
      p.student_id, 
      p.grade || '', 
      p.enrollment_status || '재학', // 재학/휴학 추가
      p.phone || '', 
      p.role === 'president' ? '회장' : p.role === 'leader' ? '팀장' : '부원', 
      p.team_names?.join(' / ') || '소속 없음', 
      p.session || '미정'
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "부원명단");
    
    // 열 너비 자동화 느낌으로 고정 세팅
    ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 10 }, { wch: 15 }, { wch: 8 }, { wch: 25 }, { wch: 15 }];

    XLSX.writeFile(wb, `동아리_부원명단_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const togglePermission = async (userId: string, field: 'can_reserve' | 'can_post', currentValue: boolean) => {
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, [field]: !currentValue } : p));
    const { error } = await supabase.from('profiles').update({ [field]: !currentValue }).eq('id', userId);
    if (error) { alert('권한 변경 실패: ' + error.message); fetchData(); }
  };

  const changeRole = async (userId: string, newRole: string) => {
    if (!confirm(`이 부원의 권한 등급을 변경하시겠습니까?`)) return;
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) { alert('권한 변경 실패: ' + error.message); fetchData(); }
  };

  const handleDeleteMember = async (userId: string, userName: string) => {
    if (!confirm(`🚨 경고: [${userName}] 부원을 정말 영구 삭제하시겠습니까?\n\n이 부원이 작성한 글, 댓글, 투표 기록 등 모든 데이터가 함께 삭제되며 복구할 수 없습니다.`)) return;

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
      
      alert(`[${userName}] 부원이 삭제되었습니다.`);
      fetchData(); 
    } catch (err: any) {
      alert('부원 삭제 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    if (!confirm(`정말로 [${fileName}] 파일을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.storage.from('community').remove([`teams/${fileName}`]);
    if (error) alert('파일 삭제 실패: ' + error.message);
    else { alert('파일이 서버에서 완전히 삭제되었습니다.'); fetchData(); }
  };
  
  const filteredProfiles = profiles.filter(p => p.name?.includes(searchTerm) || p.student_id?.includes(searchTerm) || p.major?.includes(searchTerm));
  const mainCategories = categories.filter(c => c.parent_id === null);

  const getRoleBadge = (role: string) => {
    if (role === 'president' || role === 'admin') return <span className="bg-primary/10 dark:bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">회장</span>;
    if (role === 'leader') return <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">팀장</span>;
    return <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">부원</span>;
  };

  // 재학/휴학 상태 뱃지
  const getStatusBadge = (status: string) => {
    if (status === '휴학') return <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-1.5 py-0.5 rounded">휴학</span>;
    return <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded">재학</span>;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base text-text-base font-sans overflow-hidden transition-colors duration-300 relative">
      
      <header className="h-16 shrink-0 border-b border-border-base flex items-center justify-between px-6 lg:px-8 bg-bg-surface/80 backdrop-blur-md z-10 transition-colors">
        <h2 className="text-xl font-bold flex items-center gap-2 text-text-base"><Shield className="w-5 h-5 text-primary" /> 관리자 데스크 (회장 전용)</h2>
      </header>

      {/* 관리자 메뉴 탭 */}
      <div className="flex px-6 lg:px-8 border-b border-border-base bg-bg-surface shrink-0 overflow-x-auto custom-scrollbar transition-colors">
        <button onClick={() => setActiveTab('members')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeTab === 'members' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-base'}`}><Users className="w-4 h-4" /> 부원 관리</button>
        <button onClick={() => setActiveTab('folders')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeTab === 'folders' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-base'}`}><FolderTree className="w-4 h-4" /> 팀 폴더 관리</button>
        <button onClick={() => setActiveTab('categories')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeTab === 'categories' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-base'}`}><LayoutList className="w-4 h-4" /> 게시판 카테고리</button>
        <button onClick={() => setActiveTab('files')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeTab === 'files' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-base'}`}><HardDrive className="w-4 h-4" /> 스토리지 파일</button>
      </div>

      <main className="flex-1 overflow-auto custom-scrollbar p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
          
          {/* 탭 1: 부원 관리 */}
          {activeTab === 'members' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* 검색 및 버튼 영역 */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bg-surface p-4 rounded-2xl border border-border-base shadow-sm transition-colors">
                <div className="flex items-center bg-bg-base border border-border-base rounded-xl px-3 py-2 w-full md:w-80 focus-within:border-primary transition-colors">
                  <Search className="w-4 h-4 text-text-muted mr-2" />
                  <input type="text" placeholder="이름, 학번, 학과로 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent text-sm text-text-base w-full outline-none placeholder:text-text-muted" />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto custom-scrollbar pb-1 md:pb-0">
                  <button onClick={() => setIsBatchOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-text-base text-sm font-bold rounded-lg border border-border-base transition-colors shrink-0">
                    <FileSpreadsheet className="w-4 h-4" /> 일괄 등록
                  </button>
                  <button onClick={() => setIsAddMemberModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-text-base text-sm font-bold rounded-lg border border-border-base transition-colors shrink-0">
                    <UserPlus className="w-4 h-4" /> 신규 등록
                  </button>
                  <button onClick={exportToExcel} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-sm font-bold rounded-lg border border-emerald-200 dark:border-emerald-500/20 transition-colors shrink-0">
                    <Download className="w-4 h-4" /> 엑셀 다운로드
                  </button>
                </div>
              </div>

              {/* 테이블 영역 (단대, 학과, 상태 보이도록 수정) */}
              <div className="bg-bg-surface border border-border-base rounded-2xl overflow-hidden shadow-sm dark:shadow-xl transition-colors">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-200">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/50 border-b border-border-base transition-colors">
                        <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider w-16 text-center">No</th>
                        <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider">이름 / 학번</th>
                        <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider">소속 학과 / 학년</th>
                        <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider text-center">등급 (Role)</th>
                        <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider text-center">예약 / 글 권한</th>
                        <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider text-center w-16">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-base">
                      {isLoading ? <tr><td colSpan={6} className="p-8 text-center text-text-muted transition-colors">데이터 로딩 중...</td></tr> : 
                       filteredProfiles.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-text-muted transition-colors">검색된 부원이 없습니다.</td></tr> : 
                       filteredProfiles.map((profile, idx) => (
                        <tr key={profile.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 text-sm text-text-muted text-center font-medium transition-colors">{idx + 1}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-text-base transition-colors">{profile.name}</span>
                              {getRoleBadge(profile.role)}
                            </div>
                            <div className="text-xs text-text-muted mt-0.5 transition-colors">{profile.student_id}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm font-medium text-text-base flex items-center gap-2">
                              {profile.major || '-'}
                              {getStatusBadge(profile.enrollment_status || '재학')}
                            </div>
                            <div className="text-xs text-text-muted mt-0.5">{profile.college ? `${profile.college} ${profile.grade ? `(${profile.grade}학년)` : ''}` : '-'}</div>
                          </td>
                          <td className="p-4 text-center">
                            <select 
                              value={profile.role === 'admin' ? 'president' : profile.role} 
                              onChange={(e) => changeRole(profile.id, e.target.value)}
                              className="text-xs font-bold bg-bg-base border border-border-base rounded-lg px-2 py-1 outline-none focus:border-primary text-text-base"
                            >
                              <option value="member">부원</option>
                              <option value="leader">팀장</option>
                              <option value="president">회장</option>
                            </select>
                          </td>
                          <td className="p-4 text-center transition-colors">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => togglePermission(profile.id, 'can_reserve', profile.can_reserve)} className="inline-flex items-center justify-center p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors" title="예약 권한">{profile.can_reserve ? <ToggleRight className="w-6 h-6 text-emerald-500" /> : <ToggleLeft className="w-6 h-6 text-slate-300 dark:text-slate-600" />}</button>
                              <button onClick={() => togglePermission(profile.id, 'can_post', profile.can_post)} className="inline-flex items-center justify-center p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors" title="글쓰기 권한">{profile.can_post ? <ToggleRight className="w-6 h-6 text-emerald-500" /> : <ToggleLeft className="w-6 h-6 text-slate-300 dark:text-slate-600" />}</button>
                            </div>
                          </td>
                          <td className="p-4 text-center transition-colors">
                            <button onClick={() => handleDeleteMember(profile.id, profile.name)} className="p-2 text-text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors" title="부원 영구 삭제">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 탭 2: 팀 폴더 관리 */}
          {activeTab === 'folders' && (
            <div className="space-y-6 animate-in fade-in duration-300">
               <div className="bg-bg-surface p-6 rounded-2xl border border-border-base shadow-sm transition-colors">
                 <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 transition-colors">
                   <div>
                     <h3 className="text-lg font-bold text-text-base flex items-center gap-2"><FolderTree className="w-5 h-5 text-primary" /> 팀 폴더 관리</h3>
                     <p className="text-xs text-text-muted mt-1 transition-colors">공연 기수나 목적별로 팀을 묶어둘 수 있는 상위 폴더를 관리합니다.</p>
                   </div>
                   <button onClick={() => setIsCreateFolderModalOpen(true)} className="px-4 py-2 bg-primary hover:brightness-110 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 shadow-lg shadow-primary/20">
                     <FolderPlus className="w-4 h-4" /> 새 폴더 생성
                   </button>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {folders.length === 0 ? (
                     <div className="col-span-full p-8 text-center text-text-muted border border-dashed border-border-base rounded-xl transition-colors">
                       생성된 폴더가 없습니다.
                     </div>
                   ) : (
                     folders.map(folder => (
                       <div key={folder.id} className="bg-bg-base border border-border-base rounded-xl p-5 flex flex-col justify-between hover:border-primary/50 transition-colors shadow-sm">
                         <div className="flex items-start justify-between mb-4">
                           <div className="flex items-center gap-2">
                             <Folder className="w-5 h-5 text-primary" />
                             <h4 className="font-bold text-text-base">{folder.name}</h4>
                           </div>
                           <span className="bg-slate-100 dark:bg-slate-800/50 text-text-muted text-xs font-bold px-2 py-0.5 rounded-full border border-border-base">
                             {folder.teams?.[0]?.count || 0} 팀
                           </span>
                         </div>
                         <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-base">
                           <button onClick={() => openEditFolderModal(folder.id, folder.name)} className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="이름 변경">
                             <Edit2 className="w-4 h-4" />
                           </button>
                           <button onClick={() => handleDeleteFolder(folder.id, folder.name)} className="p-2 text-text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors" title="삭제">
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       </div>
                     ))
                   )}
                 </div>
               </div>
            </div>
          )}

          {/* 탭 3: 카테고리 관리 */}
          {activeTab === 'categories' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-bg-surface p-6 rounded-2xl border border-border-base shadow-sm transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 transition-colors">
                  <div>
                    <h3 className="text-lg font-bold text-text-base flex items-center gap-2"><LayoutList className="w-5 h-5 text-primary" /> 커뮤니티 카테고리 관리</h3>
                    <p className="text-xs text-text-muted mt-1 transition-colors">메인 게시판과 하위 말머리(서브 카테고리)를 생성하고 관리합니다.</p>
                  </div>
                  <button onClick={() => setIsCategoryModalOpen(true)} className="px-4 py-2 bg-primary hover:brightness-110 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4" /> 새 카테고리 생성
                  </button>
                </div>

                <div className="space-y-4 transition-colors">
                  {mainCategories.map(main => {
                    const subs = categories.filter(c => c.parent_id === main.id);
                    return (
                      <div key={main.id} className="bg-bg-base border border-border-base rounded-xl overflow-hidden transition-colors">
                        <div className="p-4 bg-slate-100 dark:bg-slate-800/50 flex justify-between items-center border-b border-border-base transition-colors">
                          <div className="flex items-center gap-3 transition-colors">
                            <span className="font-bold text-text-base text-base transition-colors">{main.name}</span>
                            {main.is_admin_only && <span className="bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-rose-200 dark:border-rose-500/30 transition-colors">관리자 전용</span>}
                          </div>
                          <button onClick={() => handleDeleteCategory(main.id, main.name)} className="text-text-muted hover:text-rose-600 dark:hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <div className="p-4 flex flex-wrap gap-2 transition-colors">
                          {subs.length === 0 ? <span className="text-xs text-text-muted transition-colors">등록된 서브 카테고리가 없습니다.</span> : 
                            subs.map(sub => (
                              <div key={sub.id} className="flex items-center gap-2 bg-bg-surface border border-border-base px-3 py-1.5 rounded-lg text-sm text-text-base shadow-sm transition-colors">
                                {sub.name}
                                <button onClick={() => handleDeleteCategory(sub.id, sub.name)} className="text-text-muted hover:text-rose-600 dark:hover:text-rose-500 ml-1 transition-colors">
                                  <CloseIcon className="w-3 h-3" />
                                </button>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 탭 4: 스토리지 파일 */}
          {activeTab === 'files' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-bg-surface p-6 rounded-2xl border border-border-base shadow-sm transition-colors">
                <div className="flex items-center justify-between mb-6 transition-colors">
                  <div><h3 className="text-lg font-bold text-text-base flex items-center gap-2 mb-2 transition-colors"><HardDrive className="w-5 h-5 text-primary" /> 서버 이미지 목록</h3><p className="text-xs text-text-muted transition-colors">팀 대표 사진 등이 저장됩니다.</p></div>
                  <button onClick={fetchData} className="px-4 py-2 bg-bg-base text-text-base rounded-lg hover:brightness-95 dark:hover:brightness-110 transition-colors font-bold text-sm border border-border-base shadow-sm">새로고침</button>
                </div>
                <div className="border border-border-base rounded-xl overflow-hidden transition-colors">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/50 border-b border-border-base transition-colors">
                        <th className="p-4 text-xs font-bold text-text-muted tracking-wider">파일명</th>
                        <th className="p-4 text-xs font-bold text-text-muted tracking-wider text-center w-24">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-base">
                      {storageFiles.length === 0 ? <tr><td colSpan={2} className="p-8 text-center text-text-muted transition-colors">저장된 파일이 없습니다.</td></tr> : 
                       storageFiles.map((file, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 border-b border-border-base transition-colors last:border-0">
                          <td className="p-4 text-sm text-text-base break-all font-medium transition-colors">{file.name}</td>
                          <td className="p-4 text-center transition-colors"><button onClick={() => handleDeleteFile(file.name)} className="p-2 text-text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* 모달 1: 카테고리 생성 */}
      <Transition appear show={isCategoryModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsCategoryModalOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl transition-colors">
                <div className="flex justify-between items-center mb-6 transition-colors">
                  <Dialog.Title className="text-xl font-bold text-text-base">카테고리 생성</Dialog.Title>
                  <button onClick={() => setIsCategoryModalOpen(false)} className="text-text-muted hover:text-text-base transition p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50"><CloseIcon className="w-5 h-5"/></button>
                </div>
                <div className="space-y-5 transition-colors">
                  <div>
                    <label className="text-xs font-bold text-text-muted block mb-1">카테고리 이름</label>
                    <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-4 text-text-base outline-none focus:border-primary transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted block mb-1">위치 지정</label>
                    <select value={newCatParentId} onChange={e => setNewCatParentId(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-4 text-text-base outline-none focus:border-primary transition-colors">
                      <option value="">🌟 최상위 메인 게시판</option>
                      {mainCategories.map(c => <option key={c.id} value={c.id}>↳ {c.name}의 하위 말머리</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-2 transition-colors">
                    <input type="checkbox" checked={newCatIsAdmin} onChange={e => setNewCatIsAdmin(e.target.checked)} className="w-4 h-4 accent-primary" />
                    <span className="text-sm text-text-base font-medium">관리자 전용 (공지사항 등)</span>
                  </label>
                </div>
                <button onClick={handleSaveCategory} className="w-full py-4 mt-8 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition hover:brightness-110">만들기</button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* 모달 2: 수동 개별 등록 */}
      <Transition appear show={isAddMemberModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsAddMemberModalOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl transition-colors">
                <div className="flex justify-between items-center mb-6 transition-colors">
                  <Dialog.Title className="text-xl font-bold text-text-base flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary"/> 신규 부원 계정 발급</Dialog.Title>
                  <button onClick={() => setIsAddMemberModalOpen(false)} className="text-text-muted hover:text-text-base transition p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50"><CloseIcon className="w-5 h-5"/></button>
                </div>
                
                <div className="space-y-4 transition-colors">
                  <div className="bg-primary/10 border border-primary/20 p-3 rounded-xl mb-2">
                    <p className="text-[10px] text-primary font-bold">💡 아이디는 '학번', 초기 비밀번호는 '전화번호'로 자동 설정됩니다.</p>
                  </div>
                  <div><label className="text-xs font-bold text-text-muted block mb-1">이름</label><input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="실명 입력" className="w-full bg-bg-base border border-border-base p-3.5 rounded-xl text-text-base outline-none focus:border-primary transition-colors" /></div>
                  <div><label className="text-xs font-bold text-text-muted block mb-1">학번 (로그인 아이디)</label><input type="text" value={newStudentId} onChange={e => setNewStudentId(e.target.value)} placeholder="예: 20241234" className="w-full bg-bg-base border border-border-base p-3.5 rounded-xl text-text-base outline-none focus:border-primary transition-colors" /></div>
                  <div><label className="text-xs font-bold text-text-muted block mb-1">전화번호 (초기 비밀번호)</label><input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="01012345678 (- 없이 입력 추천)" className="w-full bg-bg-base border border-border-base p-3.5 rounded-xl text-text-base outline-none focus:border-primary transition-colors" /></div>
                  <div>
                    <label className="text-xs font-bold text-text-muted block mb-1">초기 권한 설정</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full bg-bg-base border border-border-base p-3.5 rounded-xl text-text-base outline-none focus:border-primary transition-colors">
                      <option value="member">일반 부원</option>
                      <option value="leader">팀장 (부분 관리자)</option>
                      <option value="president">회장 (최고 관리자)</option>
                    </select>
                  </div>
                </div>
                <button onClick={handleManualRegister} disabled={isSubmitting} className="w-full py-4 mt-8 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:opacity-50">
                  {isSubmitting ? '계정 생성 중...' : '계정 발급 및 등록'}
                </button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* 🌟 모달 3: 일괄 등록 (.xlsx 엑셀 반영 완료) */}
      <Transition appear show={isBatchOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsBatchOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-md rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl transition-colors relative overflow-hidden">
                
                {/* 로딩 오버레이 */}
                {uploadProgress.isUploading && (
                  <div className="absolute inset-0 bg-bg-surface/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="font-bold text-text-base">부원 계정 생성 중...</p>
                    <p className="text-sm text-text-muted mt-2">{uploadProgress.current} / {uploadProgress.total} 완료</p>
                    <div className="w-48 h-2 bg-slate-200 dark:bg-slate-800 rounded-full mt-4 overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}></div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center mb-6 transition-colors">
                  <Dialog.Title className="text-xl font-bold text-text-base flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-emerald-500"/> 엑셀(.xlsx) 일괄 등록</Dialog.Title>
                  <button onClick={() => setIsBatchOpen(false)} className="text-text-muted hover:text-text-base transition p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50"><CloseIcon className="w-5 h-5"/></button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-4 rounded-xl text-sm text-emerald-700 dark:text-emerald-400">
                    <p className="font-bold mb-2">1단계: 정해진 양식 다운로드</p>
                    <p className="text-xs mb-3 opacity-80">제공된 엑셀(.xlsx) 파일 양식에 정보를 기입해 주세요.</p>
                    <button onClick={downloadTemplate} className="w-full py-2 bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-200 dark:hover:bg-emerald-500/40 rounded-lg font-bold transition flex items-center justify-center gap-2">
                      <Download className="w-4 h-4"/> 엑셀 양식 다운로드
                    </button>
                  </div>

                  <div className="border-2 border-dashed border-border-base rounded-xl p-8 text-center bg-bg-base hover:border-primary/50 hover:bg-primary/5 transition cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud className="w-8 h-8 text-text-muted mx-auto mb-2" />
                    <p className="text-sm font-bold text-text-base">2단계: 완성된 엑셀 파일 업로드</p>
                    <p className="text-xs text-text-muted mt-1">클릭하여 .xlsx 파일을 선택하면 자동으로 등록이 시작됩니다.</p>
                    <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleBatchUpload} />
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* 모달 4: 폴더 생성/수정 */}
      <Transition appear show={isCreateFolderModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsCreateFolderModalOpen(false)}>
          <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl transition-colors">
              <div className="flex justify-between items-center mb-6">
                <Dialog.Title className="text-xl font-bold text-text-base">새 폴더 생성</Dialog.Title>
                <button onClick={() => setIsCreateFolderModalOpen(false)} className="text-text-muted hover:text-text-base transition p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50"><CloseIcon className="w-5 h-5"/></button>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block">폴더 이름</label>
                  <input type="text" placeholder="예: 1학기 공연조" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-4 text-text-base focus:border-primary outline-none transition-colors" />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={handleCreateFolder} className="w-full py-4 bg-primary hover:brightness-110 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition">만들기</button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      <Transition appear show={isEditFolderModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsEditFolderModalOpen(false)}>
          <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl transition-colors">
              <div className="flex justify-between items-center mb-6">
                <Dialog.Title className="text-xl font-bold text-text-base">폴더 이름 변경</Dialog.Title>
                <button onClick={() => setIsEditFolderModalOpen(false)} className="text-text-muted hover:text-text-base transition p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50"><CloseIcon className="w-5 h-5"/></button>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase mb-1.5 block">폴더 이름</label>
                  <input type="text" value={editFolderName} onChange={e => setEditFolderName(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-4 text-text-base focus:border-primary outline-none transition-colors" />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={handleEditFolder} className="w-full py-4 bg-primary hover:brightness-110 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition">수정 완료</button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

    </div>
  );
}