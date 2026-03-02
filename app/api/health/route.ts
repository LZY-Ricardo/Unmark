import { NextResponse } from 'next/server';

function getShortCommitSha(): string | null {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (!sha) {
    return null;
  }
  return sha.slice(0, 7);
}

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'unmark-web',
      time: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
      commit: getShortCommitSha(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
