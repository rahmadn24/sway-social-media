import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = readDb();
  return NextResponse.json({
    notifications: [...db.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    unread: db.notifications.filter((notification) => !notification.read).length,
  });
}

export async function PATCH(request: NextRequest) {
  let body: { action?: string; id?: string };
  try {
    body = (await request.json()) as { action?: string; id?: string };
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }

  const db = readDb();
  if (body.action === 'read-all') {
    db.notifications.forEach((notification) => {
      notification.read = true;
    });
  } else if (body.action === 'read' && body.id) {
    const notification = db.notifications.find((candidate) => candidate.id === body.id);
    if (notification) notification.read = true;
  } else {
    return NextResponse.json({ error: 'Unknown notification action.' }, { status: 400 });
  }

  writeDb(db);
  return NextResponse.json({ ok: true, unread: db.notifications.filter((item) => !item.read).length });
}
