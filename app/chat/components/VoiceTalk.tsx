// app/chat/components/VoiceTalk.tsx
"use client";
import React, { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  AudioConference,
} from '@livekit/components-react';
import '@livekit/components-styles'; // LiveKit 기본 테마 CSS
import { X, Loader2 } from 'lucide-react';

interface VoiceTalkProps {
  roomName: string;
  userName: string;
  onClose: () => void;
}

export default function VoiceTalk({ roomName, userName, onClose }: VoiceTalkProps) {
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    // 컴포넌트가 열리면 우리가 만든 API를 통해 입장 티켓(Token)을 발급받습니다.
    const fetchToken = async () => {
      try {
        const resp = await fetch(`/api/livekit?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(userName)}`);
        const data = await resp.json();
        
        if (data.token) {
          setToken(data.token);
        } else {
          alert('토큰 발급에 실패했습니다.');
          onClose();
        }
      } catch (e) {
        console.error("토큰 발급 중 오류 발생:", e);
        alert("통화 서버 연결에 실패했습니다.");
        onClose();
      }
    };
    fetchToken();
  }, [roomName, userName, onClose]);

  // 토큰을 받아오는 동안 보여줄 로딩 화면
  if (token === "") {
    return (
      <div className="fixed inset-0 bg-black/80 z-100 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
        <div className="text-white font-bold animate-pulse">보이스톡 연결 중... 🎧</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-100 flex flex-col items-center justify-center p-4 sm:p-8 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col h-[70vh] border border-slate-700">
        
        {/* 상단 헤더 영역 */}
        <div className="p-4 bg-slate-800 flex justify-between items-center border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            <h3 className="text-white font-bold tracking-tight">📞 {roomName}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-700 p-1.5 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* LiveKit 통화 UI 영역 */}
        <div className="flex-1 relative bg-slate-900/50">
          <LiveKitRoom
            video={false} // 보이스톡이므로 비디오는 끕니다.
            audio={true}  // 입장 시 자동으로 마이크 활성화
            token={token}
            serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
            data-lk-theme="default" 
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            onDisconnected={onClose} // 전화를 끊으면 모달이 자동으로 닫힙니다.
          >
            {/* 참가자들의 음성을 실제로 들려주는 숨은 엔진 */}
            <RoomAudioRenderer />
            
            {/* 화면 중앙에 참가자 프로필 아이콘을, 하단에 마이크 on/off 버튼을 그려줍니다 */}
            <AudioConference />
          </LiveKitRoom>
        </div>
        
      </div>
    </div>
  );
}