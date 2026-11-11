import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getNotifications } from '@/lib/db';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  const notifications = await getNotifications();
  return NextResponse.json({
    notifications,
    unread: notifications.filter((notification) => !notification.read).length,
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  let body: { action?: string; id?: string };
  try {
    body = (await request.json()) as { action?: string; id?: string };
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }

  if (body.action === 'read-all') {
    await prisma.appNotification.updateMany({ data: { read: true } });
  } else if (body.action === 'read' && body.id) {
    await prisma.appNotification.updateMany({
      where: { id: body.id },
      data: { read: true },
    });
  } else {
    return NextResponse.json({ error: 'Unknown notification action.' }, { status: 400 });
  }

  const unread = await prisma.appNotification.count({ where: { read: false } });
  return NextResponse.json({ ok: true, unread });
}
