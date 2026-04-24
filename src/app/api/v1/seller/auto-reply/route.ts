export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

async function load(): Promise<Record<string, string>> {
    try {
        const record = await prisma.setting.findUnique({ where: { key: 'seller_auto_replies' } });
        if (record) return JSON.parse(record.value);
    } catch {}
    return {};
}

async function save(data: Record<string, string>) {
    try {
        await prisma.setting.upsert({
            where: { key: 'seller_auto_replies' },
            update: { value: JSON.stringify(data) },
            create: { key: 'seller_auto_replies', value: JSON.stringify(data), type: 'json', group: 'chat' },
        });
    } catch (e) { console.error('save auto-reply error:', e); }
}

// GET — get seller's auto-reply
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const data = await load();
    return NextResponse.json({
        success: true,
        data: { message: data[authResult.userId] || '' },
    });
}

// POST — set seller's auto-reply
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { message } = await request.json();
    const data = await load();

    if (message?.trim()) {
        data[authResult.userId] = message.trim();
    } else {
        delete data[authResult.userId];
    }

    await save(data);
    return NextResponse.json({ success: true, message: 'Đã lưu tin nhắn tự động' });
}
