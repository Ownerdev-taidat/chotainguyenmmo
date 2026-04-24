export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ success: false, message: 'Chưa chọn file' }, { status: 400 });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ success: false, message: 'Chỉ hỗ trợ JPG, PNG, WebP, GIF' }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ success: false, message: 'File quá lớn (tối đa 5MB)' }, { status: 400 });
        }

        // Convert to Base64 data URL — persists in DB, no filesystem dependency
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString('base64');
        const mimeType = file.type;
        const dataUrl = `data:${mimeType};base64,${base64}`;

        return NextResponse.json({ success: true, url: dataUrl });
    } catch (error) {
        console.error('[Upload] Error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi upload file' }, { status: 500 });
    }
}
