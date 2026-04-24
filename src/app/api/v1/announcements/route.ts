export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface Announcement {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'important';
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

async function loadAnnouncements(): Promise<Announcement[]> {
    try {
        const record = await prisma.setting.findUnique({ where: { key: 'announcements' } });
        if (record) return JSON.parse(record.value);
    } catch {}
    return [];
}

async function saveAnnouncements(data: Announcement[]) {
    try {
        await prisma.setting.upsert({
            where: { key: 'announcements' },
            update: { value: JSON.stringify(data) },
            create: { key: 'announcements', value: JSON.stringify(data), type: 'json', group: 'content' },
        });
    } catch (e) { console.error('saveAnnouncements error:', e); }
}

// GET — public: get active announcements, admin: get all
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    const announcements = await loadAnnouncements();

    if (all) {
        return NextResponse.json({ success: true, data: announcements });
    }

    // Public: only active announcements
    const active = announcements.filter(a => a.isActive);
    return NextResponse.json({ success: true, data: active });
}

// POST — create announcement (admin only)
export async function POST(request: NextRequest) {
    try {
        const { title, message, type } = await request.json();
        if (!title || !message) {
            return NextResponse.json({ success: false, message: 'Thiếu tiêu đề hoặc nội dung' }, { status: 400 });
        }

        const announcements = await loadAnnouncements();
        const now = new Date().toISOString();
        const newAnnouncement: Announcement = {
            id: `ann_${Date.now()}`,
            title,
            message,
            type: type || 'info',
            isActive: true,
            createdAt: now,
            updatedAt: now,
        };

        announcements.unshift(newAnnouncement);
        await saveAnnouncements(announcements);

        return NextResponse.json({ success: true, data: newAnnouncement });
    } catch (error) {
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

// PUT — toggle active/inactive or update
export async function PUT(request: NextRequest) {
    try {
        const { id, isActive, title, message, type } = await request.json();
        const announcements = await loadAnnouncements();
        const idx = announcements.findIndex(a => a.id === id);
        if (idx === -1) {
            return NextResponse.json({ success: false, message: 'Không tìm thấy thông báo' }, { status: 404 });
        }

        if (typeof isActive === 'boolean') announcements[idx].isActive = isActive;
        if (title) announcements[idx].title = title;
        if (message) announcements[idx].message = message;
        if (type) announcements[idx].type = type;
        announcements[idx].updatedAt = new Date().toISOString();

        await saveAnnouncements(announcements);
        return NextResponse.json({ success: true, data: announcements[idx] });
    } catch {
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

// DELETE — delete announcement
export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, message: 'Thiếu id' }, { status: 400 });

    const announcements = await loadAnnouncements();
    const filtered = announcements.filter(a => a.id !== id);
    await saveAnnouncements(filtered);

    return NextResponse.json({ success: true, message: 'Đã xóa' });
}
