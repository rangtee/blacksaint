import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // 1. 프론트엔드에서 보낸 헤더에서 'Authorization(출입증)' 토큰 꺼내기
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '인증 토큰이 없습니다.' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    // 2. 토큰이 조작되지 않은 진짜 토큰인지, 보낸 사람이 누군지 확인 (일반 클라이언트)
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json({ error: '유효하지 않은 접근입니다.' }, { status: 401 });
    }

    // 3. 토큰의 주인이 'president(회장)' 또는 'admin(관리자)' 등급인지 DB에서 2차 검증
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'president' && profile.role !== 'admin')) {
      return NextResponse.json({ error: '계정을 생성할 권한이 없습니다.' }, { status: 403 });
    }

    // --- 여기까지 무사히 통과했다면 진짜 관리자임이 증명됨! ---

    // 4. 서비스 롤(Service Role) 마스터 키를 사용해 강제로 계정 생성
    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { email, password } = await request.json();

    // 👇 이 줄을 추가해주세요!
    console.log("👉 [서버 도착 데이터]:", `[${email}]`, `[${password}]`);

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ user: data.user });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}