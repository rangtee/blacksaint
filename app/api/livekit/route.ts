// app/api/livekit/route.ts
import { AccessToken } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // 프론트엔드에서 보낸 채팅방 이름과 유저 이름을 가져옵니다.
  const { searchParams } = new URL(request.url);
  const room = searchParams.get('room');
  const username = searchParams.get('username');

  if (!room || !username) {
    return NextResponse.json({ error: '방 이름과 유저 이름이 필요합니다.' }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'LiveKit API 키가 설정되지 않았습니다.' }, { status: 500 });
  }

  // LiveKit 입장 티켓(토큰) 생성
  const at = new AccessToken(apiKey, apiSecret, {
    identity: username, // 통화방에 표시될 내 이름
  });

  // 해당 방에 들어갈 권한, 말할 권한(publish), 들을 권한(subscribe)을 부여합니다.
  at.addGrant({ roomJoin: true, room: room, canPublish: true, canSubscribe: true });

  // 완성된 토큰을 프론트엔드로 전달합니다.
  return NextResponse.json({ token: await at.toJwt() });
}