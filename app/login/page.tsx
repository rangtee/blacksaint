"use client";
import React, { useState, useEffect } from 'react'; // 🌟 useEffect 추가됨[cite: 6]
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 🌟 자동 로그인 검문소 (세션 체크) 추가[cite: 6]
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // 이미 주머니에 토큰(세션)이 있으면 로그인 화면을 스킵하고 바로 메인으로 패스!
        window.location.href = '/';
      }
    };
    checkSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // 학번을 내부적으로 이메일 형식으로 변환하여 사용[cite: 6]
    const pseudoEmail = `${studentId}@bandon.com`;

    try {
      // 🌟 오직 '로그인'만 수행 (회원가입 로직 전면 제거)[cite: 6]
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: pseudoEmail, 
        password 
      });

      if (error) {
        alert("❌ 로그인 실패: 학번이나 비밀번호를 확인해주세요.\n(계정이 없다면 회장에게 발급을 문의하세요.)");
        setLoading(false);
        return;
      }

      if (data?.session) {
        window.location.href = '/'; // 로그인 성공 시 메인으로 이동[cite: 6]
      }

    } catch (err) {
      alert("서버와 통신 중 알 수 없는 오류가 발생했습니다.");
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-base text-text-base px-4 relative transition-colors duration-300">
      
      <div className="bg-bg-surface p-8 lg:p-10 rounded-3xl border border-border-base w-full max-w-md shadow-2xl transition-colors">
        <h1 className="text-4xl font-black text-primary mb-2 text-center tracking-tighter">Blacksaint</h1>
        <p className="text-text-muted text-center mb-8 transition-colors">동아리 전용 계정으로 로그인하세요</p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wider transition-colors">학번 (아이디)</label>
            <input 
              type="text" 
              required 
              placeholder="학번을 입력하세요" 
              value={studentId} 
              onChange={(e) => setStudentId(e.target.value)} 
              className="w-full bg-bg-base border border-border-base rounded-xl px-4 py-3 text-text-base focus:outline-none focus:border-primary transition-colors shadow-inner" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wider transition-colors">비밀번호</label>
            <input 
              type="password" 
              required 
              placeholder="비밀번호 입력" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full bg-bg-base border border-border-base rounded-xl px-4 py-3 text-text-base focus:outline-none focus:border-primary transition-colors shadow-inner" 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full py-4 mt-4 rounded-xl bg-primary text-white font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}