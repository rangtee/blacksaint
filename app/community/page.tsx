"use client";
import React, { useState, useEffect, Fragment, useRef } from 'react';
import { MessageSquare, Plus, Search, User, Clock, Trash2, X, MessageCircle, ImageIcon, Megaphone, Hash, BarChart2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, CheckCircle2, Circle, CheckSquare, Square, Reply, Edit3 } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../../lib/supabase';
import dynamic from 'next/dynamic';
import DOMPurify from 'dompurify'; // 🌟 XSS 방어용 소독(Sanitize) 라이브러리 추가

interface BoardCategory { id: number; name: string; parent_id: number | null; is_admin_only: boolean; }
interface Post { 
  id: number; title: string; content: string; 
  category_id: number; sub_category_id: number | null; 
  author_name: string; author_session: string; author_id?: string; 
  created_at: string; comment_count: number; 
  profiles?: { profile_image_url: string; generation?: string }; 
}
interface Comment { id: number; content: string; author_name: string; author_session: string; created_at: string; author_id?: string; profiles?: { profile_image_url: string; generation?: string }; }

const BlogEditor = dynamic(() => import('./BlogEditor'), { ssr: false });

const ToggleRow = ({ label, description, checked, onChange }: any) => (
  <div className="flex items-center justify-between py-2">
    <div>
      <p className="text-sm font-bold text-text-base">{label}</p>
      <p className="text-[10px] text-text-muted mt-0.5">{description}</p>
    </div>
    <button type="button" onClick={() => onChange(!checked)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/50 transition">
      {checked ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-text-muted opacity-50" />}
    </button>
  </div>
);

const formatNameWithGen = (name: string, gen?: string | null) => {
  return gen && gen.trim() !== '' ? `${name}(${gen})` : name;
};

export default function CommunityPage() {
  const [categories, setCategories] = useState<BoardCategory[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const [activeMainCatId, setActiveMainCatId] = useState<number | 'all'>('all');
  const [activeSubCatId, setActiveSubCatId] = useState<number | 'all'>('all');

  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editPostId, setEditPostId] = useState<number | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [writeMainCatId, setWriteMainCatId] = useState<string>(''); 
  const [writeSubCatId, setWriteSubCatId] = useState<string>('');
  
  const [newComment, setNewComment] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);

  const [isAddingSubCat, setIsAddingSubCat] = useState(false);
  const [customSubCatName, setCustomSubCatName] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isVotingEnabled, setIsVotingEnabled] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [allowUserOptions, setAllowUserOptions] = useState(false);
  const [hideResultsUntilVoted, setHideResultsUntilVoted] = useState(false);
  const [allowVoteChange, setAllowVoteChange] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');

  const [currentPoll, setCurrentPoll] = useState<any>(null);
  const [currentPollOptions, setCurrentPollOptions] = useState<any[]>([]);
  const [currentPollVotes, setCurrentPollVotes] = useState<any[]>([]);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        setUserProfile(profile);
      }
      fetchCategories();
      fetchPosts();
    };
    init();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('board_categories').select('*').order('id');
    if (data) setCategories(data);
  };

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*, comments(count)') 
        .order('created_at', { ascending: false });
        
      if (postsError) throw postsError;

      const { data: profilesData } = await supabase.from('profiles').select('id, profile_image_url, generation');

      if (postsData) {
        const mappedPosts = postsData.map((p: any) => {
          const authorProfile = profilesData?.find(profile => profile.id === p.author_id);
          return { 
            ...p, 
            comment_count: p.comments[0]?.count || 0,
            profiles: authorProfile ? { profile_image_url: authorProfile.profile_image_url, generation: authorProfile.generation } : null
          };
        });
        setPosts(mappedPosts);
      }
    } catch (err: any) { 
      console.error('게시글 불러오기 에러:', err.message || err); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const fetchComments = async (postId: number) => {
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('id, content, author_name, author_session, created_at, author_id') 
        .eq('post_id', postId).order('created_at', { ascending: true });
        
      if (commentsError) throw commentsError;

      const { data: profilesData } = await supabase.from('profiles').select('name, profile_image_url, generation');
      
      if (commentsData) {
        const mappedComments = commentsData.map((c: any) => {
          const authorProfile = profilesData?.find(p => p.name === c.author_name);
          return { ...c, profiles: authorProfile ? { profile_image_url: authorProfile.profile_image_url, generation: authorProfile.generation } : null };
        });
        setComments(mappedComments);
      }
    } catch (err: any) { 
      console.error('댓글 불러오기 에러:', err.message || err); 
    }
  };

  const fetchPollData = async (postId: number) => {
    try {
      const { data: pollData } = await supabase.from('polls').select('*').eq('post_id', postId).single();
      if (pollData) {
        setCurrentPoll(pollData);
        const { data: optionsData } = await supabase.from('poll_options').select('*').eq('poll_id', pollData.id).order('id');
        setCurrentPollOptions(optionsData || []);
        const { data: votesData } = await supabase.from('poll_votes').select('*').eq('poll_id', pollData.id);
        setCurrentPollVotes(votesData || []);
        if (currentUser) {
          setSelectedOptionIds((votesData || []).filter((v: any) => v.user_id === currentUser.id).map((v: any) => v.option_id));
        }
      } else {
        setCurrentPoll(null); setCurrentPollOptions([]); setCurrentPollVotes([]); setSelectedOptionIds([]);
      }
    } catch (err: any) {
      console.error('투표 데이터 불러오기 에러:', err.message || err);
    }
  };

  const handleCreateSubCategory = async () => {
    if (!customSubCatName.trim()) return alert('카테고리 이름을 입력해주세요!');
    if (!writeMainCatId) return alert('먼저 게시판을 선택해주세요!');

    const { data, error } = await supabase.from('board_categories').insert([{
      name: customSubCatName,
      parent_id: parseInt(writeMainCatId),
      is_admin_only: false
    }]).select().single();

    if (error) alert('카테고리 생성 실패: ' + error.message);
    else { await fetchCategories(); setWriteSubCatId(data.id.toString()); setIsAddingSubCat(false); setCustomSubCatName(''); }
  };

  const handleWritePost = async () => {
    if (isSubmitting) return; 
    if (!currentUser || !userProfile) return alert('사용자 정보를 불러오는 중입니다. 잠시 후 다시 눌러주세요.');
    
    if (!isEditingPost && !writeMainCatId) return alert('게시판(카테고리)을 먼저 선택해주세요!');
    if (!newTitle.trim()) return alert('게시글 제목을 입력해주세요!');
    
    const plainText = newContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
    if (plainText === '' && !newContent.includes('<img')) return alert('게시글 내용을 입력해주세요!');
    
    setIsSubmitting(true); 

    try {
      if (isEditingPost && editPostId) {
        const { error: updateError } = await supabase.from('posts').update({
          title: newTitle,
          content: newContent
        }).eq('id', editPostId);

        if (updateError) throw updateError;
        
        if (selectedPost) {
          setSelectedPost({ ...selectedPost, title: newTitle, content: newContent });
        }
        alert('게시글이 수정되었습니다.');

      } else {
        let willCreatePoll = isVotingEnabled;
        let validOptions: string[] = [];

        if (isVotingEnabled) {
          validOptions = pollOptions.filter(o => o.trim() !== '');
          if (validOptions.length === 1) return alert('투표 항목을 2개 이상 입력해주세요.\n(투표 없이 글만 올리시려면 항목을 모두 지워주시면 됩니다!)');
          if (validOptions.length === 0) willCreatePoll = false; 
        }

        const targetCat = categories.find(c => c.id === parseInt(writeMainCatId));
        if (targetCat?.is_admin_only && userProfile?.role !== 'admin' && userProfile?.role !== 'president') {
          setIsSubmitting(false); return alert('해당 카테고리는 관리자만 글을 작성할 수 있습니다.');
        }

        const { data: newPostData, error: postError } = await supabase.from('posts').insert([{ 
          title: newTitle, 
          content: newContent, 
          type: 'free',
          category_id: parseInt(writeMainCatId),
          sub_category_id: writeSubCatId ? parseInt(writeSubCatId) : null,
          author_name: userProfile.name, 
          author_session: userProfile.session || '미정', 
          author_id: currentUser.id
        }]).select(); 

        if (postError) throw postError;
        
        const newPostId = newPostData?.[0]?.id; 

        if (newPostId && willCreatePoll) {
          const { data: newPollData, error: pollError } = await supabase.from('polls').insert([{
            post_id: newPostId, is_anonymous: isAnonymous, allow_multiple_votes: allowMultipleVotes, allow_user_options: allowUserOptions, hide_results_until_voted: hideResultsUntilVoted, allow_vote_change: allowVoteChange, expires_at: expiresAt || null
          }]).select();

          if (!pollError && newPollData && newPollData.length > 0) {
              const newPollId = newPollData[0].id;
              const optionsToInsert = validOptions.map(opt => ({ poll_id: newPollId, content: opt }));
              await supabase.from('poll_options').insert(optionsToInsert);
          }
        }
      }

      setNewTitle(''); setNewContent(''); setWriteMainCatId(''); setWriteSubCatId(''); setIsAddingSubCat(false); setCustomSubCatName(''); setIsVotingEnabled(false); setPollOptions(['', '']); setIsAnonymous(false); setAllowMultipleVotes(false); setAllowUserOptions(false); setHideResultsUntilVoted(false); setAllowVoteChange(true); setExpiresAt('');
      setIsEditingPost(false);
      setEditPostId(null);
      setIsWriteModalOpen(false); 
      fetchPosts(); 
      
    } catch (err: any) { 
      alert('처리 중 오류가 발생했습니다: ' + err.message); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleOpenEditPost = () => {
    if (!selectedPost) return;
    setNewTitle(selectedPost.title);
    setNewContent(selectedPost.content);
    setEditPostId(selectedPost.id);
    setIsEditingPost(true);
    setIsDetailModalOpen(false); 
    setIsWriteModalOpen(true); 
  };

  const handleDeletePost = async (postId: number) => {
    if (!confirm('삭제하시겠습니까? (첨부된 투표도 함께 삭제됩니다)')) return;
    await supabase.from('posts').delete().eq('id', postId);
    setIsDetailModalOpen(false); fetchPosts();
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('댓글을 정말 삭제하시겠습니까?')) return;
    await supabase.from('comments').delete().eq('id', commentId);
    fetchComments(selectedPost!.id); fetchPosts(); 
  };

  const handleWriteComment = async (e?: React.KeyboardEvent) => {
    if (e && e.key !== 'Enter') return;
    if (!newComment.trim() || !selectedPost || !currentUser) return;
    
    await supabase.from('comments').insert([{ 
      post_id: selectedPost.id, 
      content: newComment, 
      author_name: userProfile.name, 
      author_session: userProfile.session,
      author_id: currentUser.id 
    }]);

    if (selectedPost.author_id && selectedPost.author_id !== currentUser.id) {
      try {
        await fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUserId: selectedPost.author_id,
            senderName: userProfile.name,
            type: 'comment',
            message: '회원님의 게시글에 새 댓글을 남겼습니다.',
            link: '/community'
          })
        });
      } catch (error) {
        console.error('알림 발송 실패:', error);
      }
    }
    
    setNewComment(''); fetchComments(selectedPost.id); fetchPosts();
  };

  const handleMention = (authorName: string) => {
    setNewComment(`@${authorName} ` + newComment);
    commentInputRef.current?.focus();
  };

  const renderCommentContent = (content: string) => {
    const mentionRegex = /(@[^\s]+)/g;
    const parts = content.split(mentionRegex);
    return parts.map((part, i) => {
      if (part.match(mentionRegex)) {
        return <span key={i} className="text-primary font-bold">{part}</span>;
      }
      return part;
    });
  };

  const handleVoteSubmit = async () => {
    if (selectedOptionIds.length === 0) return alert('항목을 선택해주세요.');
    if (!currentUser || !currentPoll) return;

    await supabase.from('poll_votes').delete().eq('poll_id', currentPoll.id).eq('user_id', currentUser.id);

    const inserts = selectedOptionIds.map(optId => ({ poll_id: currentPoll.id, option_id: optId, user_id: currentUser.id }));
    const { error } = await supabase.from('poll_votes').insert(inserts);
    if (error) alert('투표 실패: ' + error.message); else fetchPollData(selectedPost!.id);
  };

  const mainCategories = categories.filter(c => c.parent_id === null);
  const currentSubCategories = activeMainCatId !== 'all' ? categories.filter(c => c.parent_id === activeMainCatId) : [];
  const writeSubCategories = writeMainCatId ? categories.filter(c => c.parent_id === parseInt(writeMainCatId)) : [];

  const filteredPosts = posts.filter(post => {
    if (activeMainCatId === 'all') return true;
    if (post.category_id !== activeMainCatId) return false;
    if (activeSubCatId !== 'all' && post.sub_category_id !== activeSubCatId) return false;
    return true;
  });

  const getCategoryName = (id: number | null) => categories.find(c => c.id === id)?.name || '기타';
  const extractFirstImageUrl = (html: string) => { const match = /<img [^>]*src="([^"]*)"/i.exec(html); return match ? match[1] : null; };

  const uniqueVoters = new Set(currentPollVotes.map(v => v.user_id)).size;
  const hasVoted = currentPollVotes.some(v => v.user_id === currentUser?.id);
  const isExpired = currentPoll?.expires_at && new Date(currentPoll.expires_at) < new Date();
  const showResults = currentPoll && (!currentPoll.hide_results_until_voted || hasVoted || isExpired);
  const canVote = currentPoll && (!hasVoted || currentPoll.allow_vote_change) && !isExpired;

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base text-text-base font-sans overflow-hidden transition-colors duration-300">
      
      <header className="h-16 shrink-0 border-b border-border-base flex items-center justify-between px-6 lg:px-8 bg-bg-surface/80 backdrop-blur-md z-10 transition-colors">
        <h2 className="text-xl font-bold flex items-center gap-2 text-text-base"><MessageSquare className="w-5 h-5 text-primary" /> 커뮤니티</h2>
        <button onClick={() => {
            setIsEditingPost(false); 
            setEditPostId(null); 
            setNewTitle(''); 
            setNewContent(''); 
            setIsWriteModalOpen(true);
          }} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:brightness-110 text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 transition shrink-0">
          <Plus className="w-4 h-4" /> 글쓰기
        </button>
      </header>

      <div className="flex px-6 lg:px-8 border-b border-border-base bg-bg-surface shrink-0 overflow-x-auto custom-scrollbar transition-colors">
        <button onClick={() => { setActiveMainCatId('all'); setActiveSubCatId('all'); }} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors shrink-0 ${activeMainCatId === 'all' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-base'}`}>전체보기</button>
        {mainCategories.map(cat => (
          <button key={cat.id} onClick={() => { setActiveMainCatId(cat.id); setActiveSubCatId('all'); }} className={`px-4 py-4 text-sm font-bold border-b-2 transition-colors shrink-0 ${activeMainCatId === cat.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-base'}`}>
            {cat.name} {cat.is_admin_only && <Megaphone className="w-3 h-3 inline-block ml-1 text-amber-500"/>}
          </button>
        ))}
      </div>

      {currentSubCategories.length > 0 && (
        <div className="px-6 lg:px-8 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-b border-border-base flex gap-2 overflow-x-auto custom-scrollbar shrink-0 transition-colors">
          <button onClick={() => setActiveSubCatId('all')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors shrink-0 ${activeSubCatId === 'all' ? 'bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:border-primary/30' : 'bg-bg-surface text-text-muted border-border-base hover:border-slate-400 dark:hover:border-slate-500 shadow-sm'}`}>전체</button>
          {currentSubCategories.map(sub => (
            <button key={sub.id} onClick={() => setActiveSubCatId(sub.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors shrink-0 ${activeSubCatId === sub.id ? 'bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:border-primary/30' : 'bg-bg-surface text-text-muted border-border-base hover:border-slate-400 dark:hover:border-slate-500 shadow-sm'}`}>
              {sub.name}
            </button>
          ))}
        </div>
      )}

      <main className="flex-1 overflow-auto custom-scrollbar p-4 lg:p-8 relative">
        <div className="max-w-6xl mx-auto pb-20">
          {isLoading ? <div className="text-center p-12 text-text-muted">불러오는 중...</div> : 
           filteredPosts.length === 0 ? <div className="text-center p-12 text-text-muted border border-border-base border-dashed rounded-2xl bg-bg-surface/50 transition-colors">게시글이 없습니다.</div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {filteredPosts.map(post => {
                const mainName = getCategoryName(post.category_id);
                const subName = post.sub_category_id ? getCategoryName(post.sub_category_id) : null;
                const isAdminOnly = categories.find(c => c.id === post.category_id)?.is_admin_only;

                return (
                <div key={post.id} onClick={() => { setSelectedPost(post); fetchComments(post.id); fetchPollData(post.id); setIsDetailModalOpen(true); }} className={`bg-bg-surface border ${isAdminOnly ? 'border-amber-500/30' : 'border-border-base'} rounded-2xl overflow-hidden cursor-pointer group hover:border-slate-400 dark:hover:border-slate-500 transition shadow-sm hover:shadow-md dark:shadow-none flex flex-col`}>
                  
                  <div className="h-32 lg:h-40 bg-slate-200 dark:bg-slate-800 border-b border-border-base flex items-center justify-center relative overflow-hidden transition-colors">
                    {extractFirstImageUrl(post.content) ? <img src={extractFirstImageUrl(post.content)!} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : (isAdminOnly ? <Megaphone className="w-10 h-10 text-amber-500/40" /> : <MessageSquare className="w-10 h-10 text-slate-400 dark:text-slate-600 opacity-50" />)}
                    <div className={`absolute top-2 lg:top-3 left-2 lg:left-3 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border flex items-center gap-1 ${isAdminOnly ? 'bg-amber-100/90 text-amber-600 border-amber-200 dark:bg-amber-500/20 dark:text-amber-500 dark:border-amber-500/30' : 'bg-bg-surface/90 text-text-base border-border-base backdrop-blur-md'}`}>
                      {isAdminOnly && <Megaphone className="w-3 h-3" />}
                      {mainName} {subName && <span className="text-text-muted font-normal">| {subName}</span>}
                    </div>
                  </div>

                  <div className="p-4 lg:p-5 flex-1 flex flex-col justify-between">
                    <div><h3 className="text-sm lg:text-base font-bold text-text-base mb-1 lg:mb-2 leading-tight line-clamp-2">{post.title}</h3><p className="text-xs lg:text-sm text-text-muted mb-3 lg:mb-4 line-clamp-2">{post.content.replace(/<[^>]*>?/gm, '')}</p></div>
                    <div className="flex items-center justify-between text-[10px] lg:text-xs text-text-muted border-t border-border-base pt-2 lg:pt-3 transition-colors">
                      <div className="flex items-center gap-1.5 lg:gap-2">
                        <div className="w-5 h-5 lg:w-6 lg:h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden font-bold text-text-muted text-[10px] transition-colors">
                          {post.profiles?.profile_image_url ? <img src={post.profiles.profile_image_url} className="w-full h-full object-cover" alt="author" /> : post.author_name[0]}
                        </div>
                        <span className="truncate max-w-24">{formatNameWithGen(post.author_name, post.profiles?.generation)}</span>
                      </div>
                      <div className="flex items-center gap-2 lg:gap-3 shrink-0"><span>{new Date(post.created_at).toLocaleDateString()}</span><span className="flex items-center gap-1 text-primary"><MessageCircle className="w-3 h-3 lg:w-3.5 lg:h-3.5" /> {post.comment_count}</span></div>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      </main>

      <Transition appear show={isWriteModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsWriteModalOpen(false)}>
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-3xl bg-bg-surface border border-border-base p-6 shadow-2xl relative transition-colors">
              <div className="flex justify-between items-center mb-6">
                <Dialog.Title className="text-xl font-bold text-text-base flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary"/> 
                  {isEditingPost ? '게시글 수정' : '새 글 작성'}
                </Dialog.Title>
                <button onClick={() => setIsWriteModalOpen(false)} className="text-text-muted hover:text-text-base transition p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50"><X className="w-5 h-5"/></button>
              </div>
              
              <div className="space-y-4">
                {!isEditingPost && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">게시판 선택</label>
                      <select value={writeMainCatId} onChange={e => { setWriteMainCatId(e.target.value); setWriteSubCatId(''); setIsAddingSubCat(false); }} className="w-full bg-bg-base border border-border-base rounded-xl p-3 text-text-base outline-none focus:border-primary transition-colors">
                        <option value="">선택</option>
                        {mainCategories.map(c => {
                          if (c.is_admin_only && userProfile?.role !== 'admin' && userProfile?.role !== 'president') return null; 
                          return <option key={c.id} value={c.id}>{c.name}</option>
                        })}
                      </select>
                    </div>

                    {writeMainCatId && (
                      <div className="animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] font-bold text-text-muted uppercase block">세부 카테고리 (선택)</label>
                          <button onClick={() => setIsAddingSubCat(!isAddingSubCat)} className="text-[10px] text-primary font-bold hover:underline transition">
                            {isAddingSubCat ? '취소' : '+ 새 카테고리'}
                          </button>
                        </div>

                        {isAddingSubCat ? (
                          <div className="flex gap-2">
                            <input type="text" placeholder="이름" value={customSubCatName} onChange={e => setCustomSubCatName(e.target.value)} className="flex-1 bg-bg-base border border-border-base rounded-xl p-3 text-text-base outline-none focus:border-primary text-sm transition-colors" />
                            <button onClick={handleCreateSubCategory} className="bg-primary hover:brightness-110 px-4 py-2 rounded-xl text-white font-bold text-sm shrink-0 transition">추가</button>
                          </div>
                        ) : (
                          <select value={writeSubCatId} onChange={e => setWriteSubCatId(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-3 text-text-base outline-none focus:border-primary transition-colors">
                            <option value="">선택 안함</option>
                            {writeSubCategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div><input type="text" placeholder="제목을 입력하세요" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full bg-bg-base border border-border-base rounded-xl p-4 text-text-base focus:border-primary outline-none transition-colors" /></div>
                <div><BlogEditor value={newContent} onChange={setNewContent} /></div>

                {!isEditingPost && (
                  <div className="mt-8 pt-4 border-t border-border-base transition-colors">
                    <button onClick={() => setIsVotingEnabled(!isVotingEnabled)} className={`flex items-center gap-2 text-sm font-bold transition-colors w-full p-4 rounded-xl border ${isVotingEnabled ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-bg-base border-border-base text-text-base hover:border-primary/50'}`}>
                      <BarChart2 className="w-5 h-5 text-primary" />
                      투표 첨부하기
                      {isVotingEnabled ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                    </button>

                    {isVotingEnabled && (
                      <div className="mt-4 p-5 bg-bg-base border border-border-base rounded-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200 shadow-inner">
                        <div>
                          <label className="text-[10px] font-bold text-text-muted uppercase mb-3 block">투표 항목</label>
                          <div className="space-y-3">
                            {pollOptions.map((opt, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <input type="text" value={opt} onChange={(e) => { const newOpts = [...pollOptions]; newOpts[idx] = e.target.value; setPollOptions(newOpts); }} placeholder={`항목 ${idx + 1}을 입력하세요`} className="flex-1 bg-bg-surface border border-border-base rounded-xl p-3.5 text-text-base text-sm focus:border-primary outline-none transition-colors shadow-sm" />
                                {pollOptions.length > 2 && (
                                  <button onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))} className="p-3 text-text-muted hover:text-rose-500 bg-bg-surface border border-border-base rounded-xl hover:border-rose-200 dark:hover:border-rose-500/30 transition-colors shadow-sm">
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button onClick={() => setPollOptions([...pollOptions, ''])} className="w-full py-3.5 border-2 border-dashed border-border-base rounded-xl text-text-muted text-sm font-bold flex items-center justify-center gap-2 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors">
                              <Plus className="w-4 h-4" /> 항목 추가
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1 pt-4 border-t border-border-base">
                          <label className="text-[10px] font-bold text-text-muted uppercase block mb-2">상세 설정</label>
                          <ToggleRow label="익명 투표" description="누가 투표했는지 숨깁니다." checked={isAnonymous} onChange={setIsAnonymous} />
                          <ToggleRow label="복수 선택 가능" description="한 사람이 여러 항목에 투표 가능" checked={allowMultipleVotes} onChange={setAllowMultipleVotes} />
                          <ToggleRow label="선택지 추가 허용" description="멤버들이 자유롭게 새 항목 추가" checked={allowUserOptions} onChange={setAllowUserOptions} />
                          <ToggleRow label="투표 전 결과 숨기기" description="자신이 투표해야 결과를 볼 수 있습니다." checked={hideResultsUntilVoted} onChange={setHideResultsUntilVoted} />
                          <ToggleRow label="다시 투표 허용" description="투표를 취소하고 다시 할 수 있습니다." checked={allowVoteChange} onChange={setAllowVoteChange} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button 
                onClick={handleWritePost} 
                disabled={isSubmitting}
                className="w-full py-4 mt-8 bg-primary hover:brightness-110 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition"
              >
                {isSubmitting ? '처리 중...' : (isEditingPost ? '수정 완료' : '등록하기')}
              </button>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      <Transition appear show={isDetailModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsDetailModalOpen(false)}>
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" />
          <div className="fixed inset-0 flex items-center justify-center sm:p-4">
            <Dialog.Panel className="w-full sm:max-w-2xl bg-bg-surface sm:rounded-3xl border border-border-base h-dvh sm:h-[85vh] flex flex-col shadow-2xl relative transition-colors overflow-hidden">
              
              {selectedPost && (<>
                {/* 1. 고정 헤더 */}
                <div className="p-5 lg:p-6 border-b border-border-base shrink-0 relative transition-colors bg-bg-surface z-10 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 pr-4">
                      <span className="inline-block mb-1.5 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border bg-bg-base text-text-muted border-border-base transition-colors">{getCategoryName(selectedPost.category_id)} {selectedPost.sub_category_id && `> ${getCategoryName(selectedPost.sub_category_id)}`}</span>
                      <h3 className="text-xl lg:text-2xl font-black text-text-base leading-snug wrap-break-word">{selectedPost.title}</h3>
                    </div>
                    <button onClick={() => setIsDetailModalOpen(false)} className="text-text-muted hover:text-text-base shrink-0 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50"><X className="w-6 h-6 lg:w-5 lg:h-5"/></button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden font-bold text-text-muted text-[10px] transition-colors">
                        {selectedPost.profiles?.profile_image_url ? <img src={selectedPost.profiles.profile_image_url} className="w-full h-full object-cover" alt="author" /> : selectedPost.author_name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-text-base text-sm">{formatNameWithGen(selectedPost.author_name, selectedPost.profiles?.generation)}</p>
                        <p className="text-[10px] lg:text-xs">{selectedPost.author_session}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2 lg:gap-3">
                      <span className="text-[10px] lg:text-xs">{new Date(selectedPost.created_at).toLocaleString('ko-KR')}</span>
                      
                      {(currentUser?.id === selectedPost.author_id || userProfile?.role === 'admin' || userProfile?.role === 'president') && (
                        <div className="flex gap-1">
                           <button onClick={handleOpenEditPost} className="p-1.5 lg:p-2 bg-slate-100 dark:bg-slate-800/50 text-text-muted rounded-lg hover:text-text-base transition">
                             <Edit3 className="w-4 h-4 lg:w-3.5 lg:h-3.5"/>
                           </button>
                           <button onClick={() => handleDeletePost(selectedPost.id)} className="p-1.5 lg:p-2 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition">
                             <Trash2 className="w-4 h-4 lg:w-3.5 lg:h-3.5"/>
                           </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. 스크롤 가능한 본문 및 댓글 영역 */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 lg:p-6 pb-6 relative">
                  
                  {/* 🌟 수정 포인트: dangerouslySetInnerHTML에 DOMPurify.sanitize() 적용하여 악성 스크립트 실행 방어 */}
                  <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed mb-8 blog-content wrap-break-word overflow-x-hidden" 
                       dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedPost.content) }} />
                  <style jsx global>{`.blog-content img { max-width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--border-color); margin: 16px auto; display: block; object-fit: contain; }`}</style>
                  
                  {currentPoll && (
                    <div className="mt-8 border border-border-base rounded-2xl p-4 lg:p-5 bg-bg-base shadow-inner transition-colors">
                      <div className="flex justify-between items-start mb-6">
                        <h4 className="font-bold text-text-base flex items-center gap-2 text-base lg:text-lg">
                          <BarChart2 className="w-5 h-5 text-primary" /> 투표 진행 중
                        </h4>
                        <div className="text-right">
                          {isExpired ? <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-2 py-1 rounded-md">투표 마감됨</span> : currentPoll.expires_at && <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-md border border-primary/20">{new Date(currentPoll.expires_at).toLocaleString('ko-KR')} 마감</span>}
                          <div className="text-[10px] text-text-muted mt-2 font-medium">{uniqueVoters}명 참여완료</div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {currentPollOptions.map(opt => {
                          const optionVotes = currentPollVotes.filter(v => v.option_id === opt.id);
                          const voteCount = optionVotes.length;
                          const percentage = uniqueVoters === 0 ? 0 : Math.round((voteCount / uniqueVoters) * 100); 
                          const isSelected = selectedOptionIds.includes(opt.id);

                          return (
                            <div key={opt.id} onClick={() => {
                              if (!canVote) return;
                              if (currentPoll.allow_multiple_votes) {
                                setSelectedOptionIds(prev => prev.includes(opt.id) ? prev.filter(id => id !== opt.id) : [...prev, opt.id]);
                              } else {
                                setSelectedOptionIds([opt.id]);
                              }
                            }} className={`relative overflow-hidden rounded-xl border ${isSelected ? 'border-primary shadow-sm' : 'border-border-base'} p-4 ${canVote ? 'cursor-pointer hover:border-primary/50' : ''} transition-colors group bg-bg-surface`}>
                              
                              {showResults && (
                                <div className="absolute inset-y-0 left-0 bg-primary/10 dark:bg-primary/20 transition-all duration-700 ease-out" style={{ width: `${percentage}%` }} />
                              )}
                              
                              <div className="relative z-10 flex items-center justify-between">
                                <div className="flex items-center gap-3 w-[70%]">
                                  {canVote && (
                                    <div className="text-primary shrink-0">
                                      {currentPoll.allow_multiple_votes 
                                        ? (isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-text-muted" />)
                                        : (isSelected ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5 text-text-muted" />)
                                      }
                                    </div>
                                  )}
                                  <span className={`text-sm wrap-break-word line-clamp-2 ${isSelected ? 'text-primary font-black' : 'text-text-base font-medium'}`}>{opt.content}</span>
                                </div>
                                {showResults && <span className="text-[10px] lg:text-xs font-bold text-text-muted bg-bg-base px-2 py-1 rounded-md shrink-0 ml-2">{percentage}% ({voteCount}표)</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {canVote && (
                        <div className="mt-6">
                          <button onClick={handleVoteSubmit} className="w-full py-3 bg-primary hover:brightness-110 text-white font-bold rounded-xl transition shadow-lg shadow-primary/20 text-sm">
                            {hasVoted ? '다시 투표하기' : '투표하기'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t border-border-base pt-6 mt-8 transition-colors">
                    <h4 className="font-bold text-text-base mb-6 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-primary" /> 댓글 {comments.length}</h4>
                    <div className="space-y-4 lg:space-y-5">
                      {comments.length === 0 ? <p className="text-center p-6 text-sm text-text-muted">아직 댓글이 없습니다.</p> : comments.map(comment => {
                        const canDeleteComment = currentUser?.id === comment.author_id || currentUser?.id === selectedPost.author_id || userProfile?.role === 'admin' || userProfile?.role === 'president';

                        return (
                        <div key={comment.id} className="flex gap-2.5 lg:gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center overflow-hidden font-bold text-text-muted text-xs mt-0.5 transition-colors">
                             {comment.profiles?.profile_image_url ? <img src={comment.profiles.profile_image_url} className="w-full h-full object-cover" alt="author" /> : comment.author_name[0]}
                          </div>
                          
                          <div className="flex-1 bg-bg-base border border-border-base p-3.5 lg:p-4 rounded-2xl rounded-tl-sm transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-text-base text-sm">{formatNameWithGen(comment.author_name, comment.profiles?.generation)}</p>
                                <p className="text-[10px] text-text-muted font-medium bg-bg-surface px-1.5 py-0.5 rounded border border-border-base">{comment.author_session}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-[10px] text-text-muted">{new Date(comment.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                            
                            <p className="text-sm text-text-base leading-relaxed wrap-break-word whitespace-pre-wrap mb-3">
                              {renderCommentContent(comment.content)}
                            </p>

                            <div className="flex items-center justify-end gap-3 mt-1">
                               <button onClick={() => handleMention(comment.author_name)} className="text-[10px] font-bold text-text-muted hover:text-primary flex items-center gap-1 transition">
                                 <Reply className="w-3 h-3" /> 답글달기
                               </button>
                               {canDeleteComment && (
                                 <button onClick={() => handleDeleteComment(comment.id)} className="text-[10px] font-bold text-rose-400 hover:text-rose-600 flex items-center gap-1 transition">
                                   <Trash2 className="w-3 h-3" /> 삭제
                                 </button>
                               )}
                            </div>
                          </div>
                        </div>
                      )})}
                    </div>
                  </div>
                </div>

                {/* 3. 고정 하단 (댓글 입력창) */}
                <div className="shrink-0 bg-bg-surface border-t border-border-base p-3 lg:p-4 z-20 transition-colors shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] relative">
                  <div className="max-w-2xl mx-auto flex items-end gap-2 bg-bg-base border border-border-base rounded-2xl p-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary shadow-inner transition-all">
                    <input 
                      ref={commentInputRef}
                      type="text" 
                      placeholder="댓글이나 @언급을 입력하세요..." 
                      value={newComment} 
                      onChange={e => setNewComment(e.target.value)} 
                      onKeyDown={e => { if (e.key === 'Enter') handleWriteComment(e); }} 
                      className="flex-1 bg-transparent text-text-base px-3 py-2 outline-none text-sm placeholder:text-text-muted" 
                    />
                    <button 
                      onClick={() => handleWriteComment()} 
                      disabled={!newComment.trim()}
                      className="px-4 lg:px-5 py-2 bg-primary hover:brightness-110 text-white text-sm font-bold rounded-xl transition shrink-0 shadow-sm mb-0.5 mr-0.5 disabled:opacity-50"
                    >
                      등록
                    </button>
                  </div>
                </div>

              </>)}
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

    </div>
  );
}