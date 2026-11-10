import fs from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import type { MediaAsset } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 25 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Send a file with multipart/form-data.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose an image or video first.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Files must be 25 MB or smaller.' }, { status: 413 });
  }
  const extension = EXTENSIONS[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: 'Use a JPG, PNG, WEBP, GIF, AVIF, MP4, MOV or WEBM file.' },
      { status: 415 },
    );
  }

  const isVideo = file.type.startsWith('video/');
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  const filename = `${isVideo ? 'video' : 'image'}_${crypto.randomUUID().slice(0, 12)}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(uploadDir, filename), buffer);

  const asset: MediaAsset = {
    id: crypto.randomUUID(),
    url: `/uploads/${filename}`,
    type: isVideo ? 'video' : 'image',
    alt: file.name,
  };
  return NextResponse.json({ asset }, { status: 201 });
}
