"use client";
import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Users, Download, UserPlus, Search, Shield, ChevronDown, FileSpreadsheet, ToggleLeft, ToggleRight, HardDrive, Image as ImageIcon, Trash2, FolderTree, Folder, Edit2, LayoutList, Plus, X as CloseIcon, UploadCloud, FolderPlus, Loader2, MessageSquare, ListChecks, Wallet, TrendingUp, TrendingDown, Receipt } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

interface Profile { id: string; name: string; student_id: string; session: string; role: string; can_reserve: boolean; can_post: boolean; phone?: string; team_names?: string[]; college?: string; major?: string; grade?: string; enrollment_status?: string; }
interface BoardCategory { id: number; name: string; parent_id: number | null; is_admin_only: boolean; }
interface CustomRoom { id: string; name: string; created_at: string; member_count?: number; profiles?: { name: string }; }
interface Transaction { id: number; date: string; type: 'income' | 'expense'; amount: number; description: string; receipt_url: string | null; created_at: string; }

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'members' | 'files' | 'folders' | 'categories' | 'chat' | 'accounting'>('members');

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [storageFiles, setStorageFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [categories, setCategories] = useState<BoardCategory[]>([]);
  const [customRooms, setCustomRooms] = useState<CustomRoom[]>([]); 
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  
  const [isEditMemberModalOpen, setIsEditMemberModalOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<Partial<Profile> | null>(null);

  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isEditFolderModalOpen, setIsEditFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editFolderId, setEditFolderId] = useState<number | null>(null);
  const [editFolderName, setEditFolderName] = useState('');

  const [isAssignTeamsModalOpen, setIsAssignTeamsModalOpen] = useState(false);
  const [assignFolderId, setAssignFolderId] = useState<number | null>(null);
  const [assignFolderName, setAssignFolderName] = useState('');
  const [allTeamsList, setAllTeamsList] = useState<any[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);

  const [newCatName, setNewCatName] = useState('');
  const [newCatParentId, setNewCatParentId] = useState<string>('');
  const [newCatIsAdmin, setNewCatIsAdmin] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newStudentId, setNewStudentId] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('member'); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAccModalOpen, setIsAccModalOpen] = useState(false);
  const [accDate, setAccDate] = useState(new Date().toISOString().split('T')[0]);
  const [accType, setAccType] = useState<'income' | 'expense'>('expense');
  const [accAmount, setAccAmount] = useState('');
  const [accDesc, setAccDesc] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number, isUploading: boolean}>({ current: 0, total: 0, isUploading: false });

  const fetchData = async () => {
    setIsLoading(true);
    const { data: pData } = await supabase.from('profiles').select(`id, name, student_id, phone, session, role, can_reserve, can_post, college, major, grade, enrollment_status, team_members ( teams ( name ) )`).order('name');
    if (pData) setProfiles(pData.map((p: any) => ({ ...p, team_names: p.team_members?.map((tm: any) => tm.teams?.name).filter(Boolean) || [] })));
    
    const { data: fData } = await supabase.from('team_folders').select('id, name, created_at, teams(count)').order('created_at', { ascending: false });
    if (fData) setFolders(fData);
    
    const { data: sData } = await supabase.storage.from('community').list('teams', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (sData) setStorageFiles(sData.filter(f => f.name !== '.emptyFolderPlaceholder'));
    
    fetchCategories();
    fetchCustomRooms();
    fetchAccounting();
    setIsLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('board_categories').select('*').order('id');
    if (data) setCategories(data);
  };

  const fetchCustomRooms = async () => {
    const { data: roomsData } = await supabase.from('custom_chat_rooms').select('id, name, created_at, created_by, profiles!custom_chat_rooms_created_by_fkey(name)').order('created_at', { ascending: false });
    if (roomsData) {
      const roomsWithCounts = await Promise.all(roomsData.map(async (room: any) => {
        const { count } = await supabase.from('custom_chat_members').select('*', { count: 'exact', head: true }).eq('room_id', room.id);
        return { ...room, member_count: count || 0 };
      }));
      setCustomRooms(roomsWithCounts);
    }
  };

  const fetchAccounting = async () => {
    const { data } = await supabase.from('accounting').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
    if (data) setTransactions(data as Transaction[]);
  };

  useEffect(() => { fetchData(); }, []);

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

  const openAssignTeamsModal = async (folderId: number, folderName: string) => {
    setIsLoading(true);
    const { data } = await supabase.from('teams').select('id, name, folder_id').order('name');
    if (data) {
      setAllTeamsList(data);
      setSelectedTeamIds(data.filter(t => t.folder_id === folderId).map(t => t.id));
    }
    setAssignFolderId(folderId);
    setAssignFolderName(folderName);
    setIsAssignTeamsModalOpen(true);
    setIsLoading(false);
  };

  const handleSaveTeamAssignments = async () => {
    if (!assignFolderId) return;
    setIsLoading(true);
    try {
      const teamsToRemove = allTeamsList.filter(t => t.folder_id === assignFolderId && !selectedTeamIds.includes(t.id));
      for (const t of teamsToRemove) {
        await supabase.from('teams').update({ folder_id: null }).eq('id', t.id);
      }
      for (const tId of selectedTeamIds) {
        await supabase.from('teams').update({ folder_id: assignFolderId }).eq('id', tId);
      }
      alert('팀 배정이 완료되었습니다!');
      setIsAssignTeamsModalOpen(false);
      fetchData(); 
    } catch (err: any) {
      alert('배정 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTransaction = async () => {
    if (!accDate || !accAmount || !accDesc) return alert('날짜, 금액, 내역을 모두 입력해주세요.');
    setIsSubmitting(true);
    try {
      let receiptUrl = null;
      if (receiptInputRef.current?.files?.[0]) {
         const file = receiptInputRef.current.files[0];
         const filePath = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${file.name.split('.').pop()}`;
         const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, file);
         if (uploadError) throw uploadError;
         const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
         receiptUrl = data.publicUrl;
      }

      const { error } = await supabase.from('accounting').insert([{
         date: accDate,
         type: accType,
         amount: parseInt(accAmount),
         description: accDesc,
         receipt_url: receiptUrl
      }]);

      if (error) throw error;
      
      alert('내역이 추가되었습니다.');
      setIsAccModalOpen(false);
      setAccAmount(''); setAccDesc('');
      if (receiptInputRef.current) receiptInputRef.current.value = '';
      fetchAccounting();
    } catch(err: any) {
      alert('저장 실패: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    if (!confirm('이 내역을 삭제하시겠습니까?')) return;
    await supabase.from('accounting').delete().eq('id', id);
    fetchAccounting();
  };

  const exportFolderDataToExcel = async (folderId: number, folderName: string) => {
    try {
      setIsLoading(true);
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          id, 
          name, 
          team_members ( profiles ( name, session ) ),
          team_songs ( title, artist, duration_seconds, sort_order )
        `)
        .eq('folder_id', folderId);

      if (teamsError) throw teamsError;
      if (!teamsData || teamsData.length === 0) { alert('이 폴더에는 등록된 팀이 없습니다.'); setIsLoading(false); return; }

      const rows: any[] = [];
      const headers = ['팀 이름', '팀 구성원', '곡 제목', '아티스트', '곡 시간', '팀 총 공연 시간(분)'];

      teamsData.forEach((team: any) => {
        const membersString = team.team_members.map((tm: any) => `${tm.profiles?.name}(${tm.profiles?.session || '미정'})`).join(', ');
        
        const songs = (team.team_songs || []).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
        const totalTeamTimeSeconds = songs.reduce((acc: number, cur: any) => acc + (Number(cur.duration_seconds) || 0), 0);
        const totalTeamTimeMinutes = Math.floor(totalTeamTimeSeconds / 60);

        if (songs.length === 0) {
          rows.push([team.name, membersString, '등록된 곡 없음', '-', '-', 0]);
        } else {
          const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
          
          rows.push([
            team.name, 
            membersString, 
            songs[0].title || '-', 
            songs[0].artist || '-', 
            formatDuration(songs[0].duration_seconds || 0), 
            totalTeamTimeMinutes
          ]);
          
          for (let i = 1; i < songs.length; i++) {
            rows.push([
              '', 
              '', 
              songs[i].title || '-', 
              songs[i].artist || '-', 
              formatDuration(songs[i].duration_seconds || 0), 
              ''
            ]);
          }
        }
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, folderName.substring(0, 31));
      
      ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 30 }, { wch: 20 }, { wch: 10 }, { wch: 20 }];
      XLSX.writeFile(wb, `동아리_공연팀목록_${folderName}.xlsx`);
    } catch (error: any) { 
      alert('엑셀 파일 생성 중 오류가 발생했습니다: ' + error.message); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleDeleteCustomRoom = async (roomId: string, roomName: string) => { 
    if (!confirm(`🚨 경고: [${roomName}] 단체 채팅방을 강제로 삭제하시겠습니까?\n방에 있는 모든 대화 내용이 즉시 영구 삭제되며, 방에 속한 인원들도 모두 쫓겨납니다.`)) return;
    try {
      const { error } = await supabase.from('custom_chat_rooms').delete().eq('id', roomId);
      if (error) throw error;
      alert(`[${roomName}] 단체방이 삭제되었습니다.`); fetchCustomRooms(); 
    } catch (err: any) { alert('방 삭제 중 오류가 발생했습니다: ' + err.message); }
  };

  // 🌟 [수동 등록 픽스] 학번에서 눈에 보이지 않는 유령 문자, 공백, 특수기호 완벽 제거
  const handleManualRegister = async () => {
    if (!newName || !newStudentId || !newPhone) return alert('이름, 학번, 전화번호를 모두 입력해주세요.');
    
    const cleanPhone = newPhone.replace(/[^0-9]/g, '');
    const cleanStudentId = newStudentId.replace(/[^a-zA-Z0-9]/g, ''); // 영문, 숫자만 남기고 전부 삭제!
    
    if (cleanPhone.length < 6) return alert('비밀번호로 사용될 전화번호는 숫자 6자리 이상이어야 합니다.');
    if (!cleanStudentId) return alert('유효한 학번을 입력해주세요.');

    setIsSubmitting(true);
    const pseudoEmail = `${cleanStudentId}@bandon.com`;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ email: pseudoEmail, password: cleanPhone })
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error?.includes('already registered') || data.error?.includes('already exists')) alert('이미 등록된 학번입니다!');
        else alert('계정 생성 에러: ' + data.error);
        setIsSubmitting(false); return;
      }

      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id, name: newName, student_id: cleanStudentId, phone: cleanPhone, role: newRole, session: '미정', can_reserve: true, can_post: true, enrollment_status: '재학'
        });
        if (profileError) throw profileError;
        alert(`[${newName}] 부원이 명단에 성공적으로 추가되었습니다!\n\n아이디: ${cleanStudentId}\n초기 비밀번호: ${cleanPhone}`);
        setIsAddMemberModalOpen(false); setNewName(''); setNewStudentId(''); setNewPhone(''); setNewRole('member'); fetchData(); 
      }
    } catch (err: any) {
      alert("오류가 발생했습니다: " + err.message);
    } finally { setIsSubmitting(false); }
  };

  // 🌟 [일괄 등록 픽스] 학번에서 눈에 보이지 않는 유령 문자, 공백, 특수기호 완벽 제거
  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      alert('엑셀(.xlsx, .xls) 또는 CSV 형식의 파일만 업로드 가능합니다.');
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
        
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        let headerRowIndex = -1;
        
        for (let i = 0; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || !Array.isArray(row)) continue;
          
          const rowString = row.join('').replace(/\s+/g, '');
          if (rowString.includes('성명') || rowString.includes('이름') || rowString.includes('학번')) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          alert('엑셀 파일에서 [성명/이름], [학번] 등의 필수 항목 제목을 찾을 수 없습니다.\n양식을 다시 확인해주세요.');
          setUploadProgress({ current: 0, total: 0, isUploading: false });
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const parsedData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex }) as any[];
        
        if (parsedData.length === 0) {
          alert('등록할 부원 데이터가 없습니다.');
          return;
        }

        setUploadProgress({ current: 0, total: parsedData.length, isUploading: true });
        
        let successCount = 0; 
        let failCount = 0; 
        let updateCount = 0;
        let lastErrorMessage = ''; 

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        for (let i = 0; i < parsedData.length; i++) {
          const row = parsedData[i];
          
          const name = String(row['성명'] || row['이름'] || '').trim();
          
          // 🚨 핵심 수정 부분: 엑셀에서 들어온 학번의 투명 공백, 줄바꿈 등 유령 문자를 완벽하게 파괴합니다.
          const rawStudentId = String(row['학번'] || '');
          const studentId = rawStudentId.replace(/[^a-zA-Z0-9]/g, ''); 
          
          const rawPhone = String(row['연락처'] || row['전화번호'] || row['핸드폰'] || '').trim();
          const phone = rawPhone.replace(/[^0-9]/g, ''); 
          
          if (!name || !studentId || !phone) { 
            continue; 
          }

          const college = String(row['단대'] || row['단과대학'] || '').trim();
          const major = String(row['학과(부)'] || row['학과'] || row['전공'] || '').trim();
          const grade = String(row['학년'] || '').trim();
          const enrollmentStatus = String(row['재학/휴학'] || row['상태'] || '재학').trim(); 

          const roleString = String(row['직책'] || '').trim();
          let assignRole = 'member';
          if (roleString.includes('회장')) assignRole = 'president';
          else if (roleString.includes('부회장') || roleString.includes('관리자') || roleString.includes('임원')) assignRole = 'admin';

          const pseudoEmail = `${studentId}@bandon.com`;
          
          try {
            const { data: existingProfiles } = await supabase
              .from('profiles')
              .select('id, student_id, name')
              .or(`student_id.eq.${studentId},name.eq.${name}`);

            let existingProfile = null;
            if (existingProfiles && existingProfiles.length > 0) {
              existingProfile = existingProfiles.find(p => p.student_id === studentId) || existingProfiles.find(p => p.name === name);
            }

            if (existingProfile) {
              const { error: updateError } = await supabase.from('profiles').update({
                student_id: studentId, 
                phone: phone, 
                college: college, 
                major: major, 
                grade: grade, 
                enrollment_status: enrollmentStatus
              }).eq('id', existingProfile.id);
              
              if (updateError) {
                lastErrorMessage = `[${name}] 정보 갱신 실패: ` + updateError.message;
                failCount++;
              } else {
                updateCount++;
              }
            } else {
              const res = await fetch('/api/create-user', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ email: pseudoEmail, password: phone })
              });
              const resData = await res.json();
              
              if (!res.ok) {
                let detailedError = '알 수 없는 서버 에러 (가입 차단됨)';
                if (resData.error) detailedError = typeof resData.error === 'string' ? resData.error : JSON.stringify(resData.error);
                else if (resData.message) detailedError = resData.message;
                
                lastErrorMessage = `[${name}] 신규 가입 에러: ` + detailedError;
                failCount++; 
                continue; 
              }

              if (resData.user) {
                const { error: profileError } = await supabase.from('profiles').insert({
                  id: resData.user.id, name, student_id: studentId, phone, college, major, grade, enrollment_status: enrollmentStatus, role: assignRole, session: '미정', can_reserve: true, can_post: true
                });
                
                if (profileError) {
                  lastErrorMessage = `[${name}] 프로필 생성 에러: ` + profileError.message;
                  failCount++;
                } else {
                  successCount++;
                }
              }
            }
          } catch (err: any) { 
            lastErrorMessage = `[${name}] 네트워크 통신 에러: ` + (err.message || '인터넷 연결을 확인하세요');
            failCount++; 
          }
          setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }
        
        let resultMsg = `일괄 처리가 완료되었습니다!\n\n✅ 신규 가입 성공: ${successCount}명\n🔄 기존 회원 정보 갱신: ${updateCount}명\n❌ 실패: ${failCount}명`;
        if (failCount > 0 && lastErrorMessage) {
          resultMsg += `\n\n⚠️ 최근 실패 원인: ${lastErrorMessage}\n(※ 'rate limit'이 포함된 에러라면 Supabase의 Rate Limits 설정을 높여주세요!)`;
        }
        alert(resultMsg);

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

  const downloadTemplate = () => {
    const ws_data = [ 
      [`${new Date().getFullYear()}년도 동아리 회원명부(재학생)`], 
      ['직책', '성명', '단대', '학과(부)', '학번', '학년', '연락처'], 
      ['회장', '박지민', 'IT대학', '전자정보공학부', '20231510', '3', '010-3714-6713'],
      ['', '홍길동', '공과대학', '컴퓨터공학부', '20240001', '2', '010-1234-5678'] 
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]; 
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "회원등록양식");
    ws['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 15 }];
    XLSX.writeFile(wb, `동아리_부원일괄등록_양식.xlsx`);
  };

  const exportToExcel = () => {
    const sortedProfiles = [...profiles].sort((a, b) => {
      if (a.role === 'president' && b.role !== 'president') return -1;
      if (a.role !== 'president' && b.role === 'president') return 1;
      return a.name.localeCompare(b.name);
    });

    const rows = sortedProfiles.map(p => {
      let phoneDisplay = p.phone || '';
      if (phoneDisplay.length === 11) phoneDisplay = phoneDisplay.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
      else if (phoneDisplay.length === 10) phoneDisplay = phoneDisplay.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');

      return [ 
        p.role === 'president' ? '회장' : '', 
        p.name, 
        p.college || '', 
        p.major || '', 
        p.student_id, 
        p.grade || '', 
        phoneDisplay 
      ];
    });

    const ws_data = [
      [`${new Date().getFullYear()}년도 동아리 회원명부`],
      ['직책', '성명', '단대', '학과(부)', '학번', '학년', '연락처'],
      ...rows
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]; 
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "회원명부");
    ws['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 15 }];
    XLSX.writeFile(wb, `동아리_회원명부_${new Date().toISOString().split('T')[0]}.xlsx`);
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
    if (!confirm(`🚨 경고: [${userName}] 부원을 정말 영구 삭제하시겠습니까?\n\n이 부원이 작성한 글, 댓글, 투표 기록 등 모든 데이터가 함께 삭제되며 복구할 수 복원할 수 없습니다.`)) return;
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
      alert(`[${userName}] 부원이 삭제되었습니다.`); fetchData(); 
    } catch (err: any) { alert('부원 삭제 중 오류가 발생했습니다: ' + err.message); }
  };

  const handleDeleteFile = async (fileName: string) => {
    if (!confirm(`정말로 [${fileName}] 파일을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.storage.from('community').remove([`teams/${fileName}`]);
    if (error) alert('파일 삭제 실패: ' + error.message);
    else { alert('파일이 서버에서 완전히 삭제되었습니다.'); fetchData(); }
  };

  const handleOpenEditMember = (profile: Profile) => {
    setEditProfile(profile);
    setIsEditMemberModalOpen(true);
  };

  const handleSaveEditMember = async () => {
    if (!editProfile?.id || !editProfile.name || !editProfile.student_id) return alert('이름과 학번은 필수입니다.');
    setIsSubmitting(true);
    const { error } = await supabase.from('profiles').update({
      name: editProfile.name,
      student_id: editProfile.student_id.replace(/[^a-zA-Z0-9]/g, ''),
      phone: editProfile.phone,
      college: editProfile.college,
      major: editProfile.major,
      grade: editProfile.grade,
      enrollment_status: editProfile.enrollment_status,
      session: editProfile.session,
      role: editProfile.role
    }).eq('id', editProfile.id);

    if (error) alert('수정 실패: ' + error.message);
    else {
      alert('회원 정보가 수정되었습니다!');
      setIsEditMemberModalOpen(false);
      fetchData();
    }
    setIsSubmitting(false);
  };
  
  const filteredProfiles = profiles.filter(p => p.name?.includes(searchTerm) || p.student_id?.includes(searchTerm) || p.major?.includes(searchTerm));
  const mainCategories = categories.filter(c => c.parent_id === null);

  const getRoleBadge = (role: string) => {
    if (role === 'president') return <span className="bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">회장</span>;
    if (role === 'admin') return <span className="bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">관리자</span>;
    if (role === 'leader') return <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">팀장</span>;
    return <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">부원</span>;
  };

  const getStatusBadge = (status: string) => {
    if (status === '휴학') return <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-1.5 py-0.5 rounded">휴학</span>;
    return <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded">재학</span>;
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const totalBalance = totalIncome - totalExpense;

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base text-text-base font-sans overflow-hidden transition-colors duration-300 relative">
      <header className="h-16 shrink-0 border-b border-border-base flex items-center justify-between px-6 lg:px-8 bg-bg-surface/80 backdrop-blur-md z-10 transition-colors">
        <h2 className="text-xl font-bold flex items-center gap-2 text-text-base"><Shield className="w-5 h-5 text-primary" /> 관리자 데스크 (회장/관리자 전용)</h2>
      </header>

      <div className="flex px-6 lg:px-8 border-b border-border-base bg-bg-surface shrink-0 overflow-x-auto custom-scrollbar transition-colors">
        <button onClick={() => setActiveTab('members')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeTab === 'members' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-base'}`}><Users className="w-4 h-4" /> 부원 관리</button>
        <button onClick={() => setActiveTab('accounting')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeTab === 'accounting' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-base'}`}><Wallet className="w-4 h-4" /> 회계 관리</button>
        <button onClick={() => setActiveTab('folders')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeTab === 'folders' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-base'}`}><FolderTree className="w-4 h-4" /> 팀 폴더 관리</button>
        <button onClick={() => setActiveTab('chat')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeTab === 'chat' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-base'}`}><MessageSquare className="w-4 h-4" /> 단체방 관리</button>
        <button onClick={() => setActiveTab('categories')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeTab === 'categories' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-base'}`}><LayoutList className="w-4 h-4" /> 게시판 관리</button>
        <button onClick={() => setActiveTab('files')} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeTab === 'files' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-base'}`}><HardDrive className="w-4 h-4" /> 파일 관리</button>
      </div>

      <main className="flex-1 overflow-auto custom-scrollbar p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
          
          {activeTab === 'accounting' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-bg-surface border border-border-base p-6 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2 text-text-muted mb-2 font-bold text-sm"><Wallet className="w-5 h-5 text-primary" /> 총 동아리 잔액</div>
                  <div className="text-3xl font-black text-text-base">{totalBalance.toLocaleString()} <span className="text-lg text-text-muted font-bold">원</span></div>
                </div>
                <div className="bg-bg-surface border border-border-base p-6 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-500 mb-2 font-bold text-sm"><TrendingUp className="w-5 h-5" /> 누적 수입</div>
                  <div className="text-2xl font-black text-emerald-500">{totalIncome.toLocaleString()} <span className="text-lg opacity-70 font-bold">원</span></div>
                </div>
                <div className="bg-bg-surface border border-border-base p-6 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2 text-rose-500 mb-2 font-bold text-sm"><TrendingDown className="w-5 h-5" /> 누적 지출</div>
                  <div className="text-2xl font-black text-rose-500">{totalExpense.toLocaleString()} <span className="text-lg opacity-70 font-bold">원</span></div>
                </div>
              </div>

              <div className="bg-bg-surface p-6 rounded-2xl border border-border-base shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-text-base flex items-center gap-2"><Receipt className="w-5 h-5 text-primary" /> 입출금 내역</h3>
                  <button onClick={() => setIsAccModalOpen(true)} className="px-4 py-2 bg-primary hover:brightness-110 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4" /> 내역 추가
                  </button>
                </div>

                <div className="border border-border-base rounded-xl overflow-hidden">
                  <table className="w-full text-left min-w-150">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/50 border-b border-border-base">
                        <th className="p-4 text-xs font-bold text-text-muted">날짜</th>
                        <th className="p-4 text-xs font-bold text-text-muted">구분</th>
                        <th className="p-4 text-xs font-bold text-text-muted">적요(내역)</th>
                        <th className="p-4 text-xs font-bold text-text-muted text-right">금액</th>
                        <th className="p-4 text-xs font-bold text-text-muted text-center">증빙/영수증</th>
                        <th className="p-4 text-xs font-bold text-text-muted text-center w-16">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-base">
                      {transactions.length === 0 ? (
                        <tr><td colSpan={6} className="p-8 text-center text-text-muted">등록된 내역이 없습니다.</td></tr>
                      ) : (
                        transactions.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="p-4 text-sm font-medium text-text-base">{t.date}</td>
                            <td className="p-4 text-sm font-bold">
                              {t.type === 'income' ? <span className="text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded">수입</span> : <span className="text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded">지출</span>}
                            </td>
                            <td className="p-4 text-sm text-text-base">{t.description}</td>
                            <td className={`p-4 text-sm font-bold text-right ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString()}원
                            </td>
                            <td className="p-4 text-center">
                              {t.receipt_url ? (
                                <a href={t.receipt_url} target="_blank" rel="noreferrer" className="inline-block p-1.5 bg-slate-100 dark:bg-slate-800 text-text-muted hover:text-primary rounded-lg transition" title="영수증 보기">
                                  <ImageIcon className="w-4 h-4" />
                                </a>
                              ) : (
                                <span className="text-xs text-text-muted">-</span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              <button onClick={() => handleDeleteTransaction(t.id)} className="p-2 text-text-muted hover:text-rose-500 rounded-lg transition" title="삭제">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-6 animate-in fade-in duration-300">
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
                        <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider text-center w-24">관리</th>
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
                              value={profile.role} 
                              onChange={(e) => changeRole(profile.id, e.target.value)}
                              className="text-xs font-bold bg-bg-base border border-border-base rounded-lg px-2 py-1 outline-none focus:border-primary text-text-base"
                            >
                              <option value="member">부원</option>
                              <option value="leader">팀장</option>
                              <option value="admin">관리자</option>
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
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => handleOpenEditMember(profile)} className="p-2 text-text-muted hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title="정보 수정">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteMember(profile.id, profile.name)} className="p-2 text-text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors" title="부원 영구 삭제">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

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
                         <div className="flex items-center justify-between pt-4 border-t border-border-base">
                           <div className="flex gap-1.5">
                             <button onClick={() => openAssignTeamsModal(folder.id, folder.name)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-xs font-bold rounded-lg border border-indigo-200 dark:border-indigo-500/20 transition-colors">
                               <ListChecks className="w-3.5 h-3.5" /> 팀 배정
                             </button>
                             <button onClick={() => exportFolderDataToExcel(folder.id, folder.name)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-xs font-bold rounded-lg border border-emerald-200 dark:border-emerald-500/20 transition-colors">
                               <Download className="w-3.5 h-3.5" /> 엑셀 다운
                             </button>
                           </div>
                           
                           <div className="flex gap-1">
                             <button onClick={() => openEditFolderModal(folder.id, folder.name)} className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="이름 변경">
                               <Edit2 className="w-4 h-4" />
                             </button>
                             <button onClick={() => handleDeleteFolder(folder.id, folder.name)} className="p-2 text-text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors" title="삭제">
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </div>
                         </div>
                       </div>
                     ))
                   )}
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="space-y-6 animate-in fade-in duration-300">
               <div className="bg-bg-surface p-6 rounded-2xl border border-border-base shadow-sm transition-colors">
                 <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 transition-colors">
                   <div>
                     <h3 className="text-lg font-bold text-text-base flex items-center gap-2"><MessageSquare className="w-5 h-5 text-primary" /> 개설된 단체방 목록</h3>
                     <p className="text-xs text-text-muted mt-1 transition-colors">동아리 부원들이 개설한 단체 채팅방 목록입니다. 필요시 강제로 삭제할 수 있습니다.</p>
                   </div>
                   <button onClick={fetchCustomRooms} className="px-4 py-2 bg-bg-base border border-border-base text-text-base text-sm font-bold rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                     새로고침
                   </button>
                 </div>

                 <div className="border border-border-base rounded-xl overflow-hidden transition-colors">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/50 border-b border-border-base transition-colors">
                        <th className="p-4 text-xs font-bold text-text-muted tracking-wider">채팅방 이름</th>
                        <th className="p-4 text-xs font-bold text-text-muted tracking-wider text-center">개설자</th>
                        <th className="p-4 text-xs font-bold text-text-muted tracking-wider text-center">참여 인원</th>
                        <th className="p-4 text-xs font-bold text-text-muted tracking-wider text-center">개설일</th>
                        <th className="p-4 text-xs font-bold text-text-muted tracking-wider text-center w-24">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-base">
                      {customRooms.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-text-muted transition-colors">개설된 단체방이 없습니다.</td></tr> : 
                       customRooms.map((room) => (
                        <tr key={room.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 border-b border-border-base transition-colors last:border-0">
                          <td className="p-4 text-sm font-bold text-text-base transition-colors">{room.name}</td>
                          <td className="p-4 text-sm text-text-muted text-center transition-colors">{room.profiles?.name || '알 수 없음'}</td>
                          <td className="p-4 text-sm text-text-base text-center font-medium transition-colors">{room.member_count}명</td>
                          <td className="p-4 text-xs text-text-muted text-center transition-colors">{new Date(room.created_at).toLocaleDateString()}</td>
                          <td className="p-4 text-center transition-colors">
                            <button onClick={() => handleDeleteCustomRoom(room.id, room.name)} className="p-2 text-text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors" title="방 강제 폭파">
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

      <Transition appear show={isEditMemberModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsEditMemberModalOpen(false)}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-md rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <Dialog.Title className="text-xl font-bold text-text-base flex items-center gap-2"><Edit2 className="w-5 h-5 text-primary" /> 회원 정보 수정</Dialog.Title>
                <button onClick={() => setIsEditMemberModalOpen(false)} className="text-text-muted hover:text-text-base"><CloseIcon className="w-5 h-5"/></button>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-muted mb-1 block">이름</label>
                    <input type="text" value={editProfile?.name || ''} onChange={e => setEditProfile(prev => prev ? {...prev, name: e.target.value} : null)} className="w-full bg-bg-base border border-border-base p-3 rounded-xl text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted mb-1 block">학번</label>
                    <input type="text" value={editProfile?.student_id || ''} onChange={e => setEditProfile(prev => prev ? {...prev, student_id: e.target.value} : null)} className="w-full bg-bg-base border border-border-base p-3 rounded-xl text-sm outline-none focus:border-primary" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-muted mb-1 block">전화번호</label>
                    <input type="text" value={editProfile?.phone || ''} onChange={e => setEditProfile(prev => prev ? {...prev, phone: e.target.value} : null)} className="w-full bg-bg-base border border-border-base p-3 rounded-xl text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted mb-1 block">권한 등급</label>
                    <select value={editProfile?.role || 'member'} onChange={e => setEditProfile(prev => prev ? {...prev, role: e.target.value} : null)} className="w-full bg-bg-base border border-border-base p-3 rounded-xl text-sm outline-none focus:border-primary">
                      <option value="member">부원</option>
                      <option value="leader">팀장</option>
                      <option value="admin">관리자</option>
                      <option value="president">회장</option>
                    </select>
                  </div>
                </div>

                <hr className="border-border-base my-2" />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-muted mb-1 block">단과대학</label>
                    <input type="text" value={editProfile?.college || ''} onChange={e => setEditProfile(prev => prev ? {...prev, college: e.target.value} : null)} className="w-full bg-bg-base border border-border-base p-3 rounded-xl text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted mb-1 block">학과(부)</label>
                    <input type="text" value={editProfile?.major || ''} onChange={e => setEditProfile(prev => prev ? {...prev, major: e.target.value} : null)} className="w-full bg-bg-base border border-border-base p-3 rounded-xl text-sm outline-none focus:border-primary" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-muted mb-1 block">학년</label>
                    <select value={editProfile?.grade || ''} onChange={e => setEditProfile(prev => prev ? {...prev, grade: e.target.value} : null)} className="w-full bg-bg-base border border-border-base p-3 rounded-xl text-sm outline-none focus:border-primary">
                      <option value="">선택</option>
                      <option value="1">1학년</option><option value="2">2학년</option><option value="3">3학년</option><option value="4">4학년</option><option value="5">5학년</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted mb-1 block">재학/휴학</label>
                    <select value={editProfile?.enrollment_status || '재학'} onChange={e => setEditProfile(prev => prev ? {...prev, enrollment_status: e.target.value} : null)} className="w-full bg-bg-base border border-border-base p-3 rounded-xl text-sm outline-none focus:border-primary">
                      <option value="재학">재학</option>
                      <option value="휴학">휴학</option>
                      <option value="졸업">졸업</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted mb-1 block">주 세션</label>
                  <select value={editProfile?.session || '미정'} onChange={e => setEditProfile(prev => prev ? {...prev, session: e.target.value} : null)} className="w-full bg-bg-base border border-border-base p-3 rounded-xl text-sm outline-none focus:border-primary">
                    <option value="미정">미정</option>
                    <option value="보컬">보컬</option><option value="일렉기타">일렉기타</option>
                    <option value="베이스">베이스</option><option value="드럼">드럼</option>
                    <option value="키보드">키보드</option><option value="어쿠스틱기타">어쿠스틱기타</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setIsEditMemberModalOpen(false)} className="flex-1 py-3.5 bg-bg-base border border-border-base text-text-base font-bold rounded-xl hover:brightness-95 transition">취소</button>
                <button onClick={handleSaveEditMember} disabled={isSubmitting} className="flex-1 py-3.5 bg-primary text-white font-bold rounded-xl hover:brightness-110 disabled:opacity-50 transition shadow-lg shadow-primary/20">
                  {isSubmitting ? '저장 중...' : '수정 완료'}
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      <Transition appear show={isAccModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsAccModalOpen(false)}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <Dialog.Title className="text-xl font-bold text-text-base flex items-center gap-2"><Receipt className="w-5 h-5 text-primary" /> 회계 내역 추가</Dialog.Title>
                <button onClick={() => setIsAccModalOpen(false)} className="text-text-muted hover:text-text-base"><CloseIcon className="w-5 h-5"/></button>
              </div>

              <div className="space-y-4">
                <div className="flex bg-bg-base p-1 rounded-xl border border-border-base">
                  <button onClick={() => setAccType('income')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${accType === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 shadow-sm' : 'text-text-muted'}`}>수입 (+)</button>
                  <button onClick={() => setAccType('expense')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${accType === 'expense' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 shadow-sm' : 'text-text-muted'}`}>지출 (-)</button>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1.5">날짜</label>
                  <input type="date" value={accDate} onChange={e => setAccDate(e.target.value)} className="w-full bg-bg-base border border-border-base p-3.5 rounded-xl text-sm outline-none focus:border-primary scheme-light dark:scheme-dark" />
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1.5">금액</label>
                  <div className="flex items-center bg-bg-base border border-border-base rounded-xl pr-4 focus-within:border-primary">
                    <input type="number" placeholder="예: 50000" value={accAmount} onChange={e => setAccAmount(e.target.value)} className="w-full bg-transparent p-3.5 text-sm outline-none text-right" />
                    <span className="text-text-muted font-bold text-sm ml-2">원</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1.5">적요 (내역 설명)</label>
                  <input type="text" placeholder="예: 3월 정기 회비, 대관료 등" value={accDesc} onChange={e => setAccDesc(e.target.value)} className="w-full bg-bg-base border border-border-base p-3.5 rounded-xl text-sm outline-none focus:border-primary" />
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1.5">영수증 / 증빙 자료 첨부 (선택)</label>
                  <input type="file" accept="image/*" ref={receiptInputRef} className="w-full text-xs text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                </div>
              </div>

              <button onClick={handleSaveTransaction} disabled={isSubmitting} className="w-full py-4 mt-8 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 transition">
                {isSubmitting ? '저장 중...' : '내역 저장하기'}
              </button>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

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

      <Transition appear show={isAddMemberModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsAddMemberModalOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-sm rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl transition-colors">
                <div className="flex justify-between items-center mb-6 transition-colors">
                  <Dialog.Title className="text-xl font-bold text-text-base flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary"/> 신규 부원 등록</Dialog.Title>
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
                      <option value="admin">관리자 (부회장/임원)</option>
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

      <Transition appear show={isBatchOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsBatchOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-md rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl transition-colors relative overflow-hidden">
                
                {uploadProgress.isUploading && (
                  <div className="absolute inset-0 bg-bg-surface/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="font-bold text-text-base">부원 계정 생성 및 수정 중...</p>
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
                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleBatchUpload} />
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

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

      <Transition appear show={isAssignTeamsModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsAssignTeamsModalOpen(false)}>
          <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-md rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl transition-colors">
              <div className="flex justify-between items-center mb-6">
                <Dialog.Title className="text-xl font-bold text-text-base flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-indigo-500" /> [{assignFolderName}] 팀 배정
                </Dialog.Title>
                <button onClick={() => setIsAssignTeamsModalOpen(false)} className="text-text-muted hover:text-text-base transition p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50"><CloseIcon className="w-5 h-5"/></button>
              </div>

              <div className="mb-4 bg-bg-base border border-border-base p-3 rounded-xl text-sm text-text-muted">
                이 폴더에 넣을 팀들을 체크해주세요. <br/>
                <span className="text-xs">(다른 폴더에 속해있던 팀을 체크하면 이 폴더로 소속이 옮겨집니다.)</span>
              </div>

              <div className="max-h-60 overflow-y-auto custom-scrollbar border border-border-base rounded-xl p-2 bg-bg-base space-y-1">
                {allTeamsList.length === 0 ? (
                  <div className="text-center py-4 text-sm text-text-muted">생성된 팀이 없습니다.</div>
                ) : (
                  allTeamsList.map(team => (
                    <label key={team.id} className="flex items-center gap-3 p-3 hover:bg-bg-surface rounded-lg cursor-pointer transition-colors border border-transparent hover:border-border-base">
                      <input 
                        type="checkbox" 
                        checked={selectedTeamIds.includes(team.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTeamIds([...selectedTeamIds, team.id]);
                          else setSelectedTeamIds(selectedTeamIds.filter(id => id !== team.id));
                        }}
                        className="w-4 h-4 accent-primary" 
                      />
                      <span className="text-sm font-bold text-text-base flex-1">{team.name}</span>
                      {team.folder_id && team.folder_id !== assignFolderId && !selectedTeamIds.includes(team.id) && (
                        <span className="text-[10px] text-text-muted bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">다른 폴더 소속</span>
                      )}
                    </label>
                  ))
                )}
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={handleSaveTeamAssignments} disabled={isLoading} className="w-full py-4 bg-primary hover:brightness-110 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition disabled:opacity-50">
                  {isLoading ? '저장 중...' : '선택한 팀 넣기'}
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

    </div>
  );
}