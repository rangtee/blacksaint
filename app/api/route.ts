// app/api/send-notification/route.ts
import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// VAPID 키 설정 (이메일은 본인 이메일이나 더미 이메일로 변경)
webpush.setVapidDetails(
  'mailto:blacksaint@example.com', 
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// 🌟 서비스 역할 키(Service Role Key)가 필요합니다. 
// 보안 규칙(RLS)을 무시하고 알림을 쏠 수 있는 마스터 키입니다. (.env.local에 추가해야 함)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const { targetUserId, senderName, type, message, link } = await req.json();

    // 1. 인앱 종모양 알림을 위해 DB에 저장
    const { error: dbError } = await supabase.from('notifications').insert([{
      user_id: targetUserId, 
      sender_name: senderName, 
      type, 
      message, 
      link
    }]);

    if (dbError) {
      console.error('DB 알림 저장 에러:', dbError);
    }

    // 2. 백그라운드 푸시 알림 발송을 위해 해당 유저의 기기 주소 조회
    const { data: subData } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', targetUserId)
      .single();

    if (subData && subData.subscription) {
      // 3. 꺼져있는 핸드폰으로 푸시 전송!
      const payload = JSON.stringify({
        title: `${senderName}님의 새 알림`,
        body: message,
        url: link || '/'
      });

      await webpush.sendNotification(subData.subscription, payload);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('푸시 발송 서버 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}