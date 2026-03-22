// app/api/deezer/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ error: '검색어가 필요합니다.' }, { status: 400 });
  }

  try {
    // Deezer API로 검색어(q)를 전송
    const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}`);
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Deezer API 호출 중 오류가 발생했습니다.' }, { status: 500 });
  }
}