import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// 🌟 1. Vercel Build 에러를 막기 위한 안전장치 (if문)
if (
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && 
  process.env.VAPID_PRIVATE_KEY && 
  process.env.VAPID_SUBJECT
) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT, // mailto: 이메일 형식
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// 🌟 2. Supabase 어드민 권한 클라이언트 셋업
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 🌟 3. 실제 알림을 발송하는 메인 함수 (이 부분은 지워지면 안 됩니다!)
export async function POST(request: Request) {
  try {
    const { targetUserId, senderName, type, message, link } = await request.json();

    // 데이터베이스에서 해당 유저의 푸시 구독 정보(기기 정보) 가져오기
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', targetUserId);

    if (error || !subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: false, message: '등록된 푸시 구독 정보가 없습니다.' });
    }

    // 보낼 알림 내용 포장
    const payload = JSON.stringify({
      title: senderName ? `${senderName}님의 메시지` : '새로운 알림',
      body: message || '새로운 알림이 도착했습니다.',
      url: link || '/',
    });

    // 유저가 로그인한 모든 기기에 푸시 알림 전송
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };
        await webpush.sendNotification(pushSubscription, payload);
      } catch (err: any) {
        console.error('푸시 전송 에러 (기기 1대):', err);
        // 브라우저에서 권한을 취소했거나 만료된 구독 정보라면 DB에서 삭제
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('푸시 알림 서버 에러:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}