export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createApiKey, getApiKeysByUser, getOrCreateUserApiKey, revokeApiKey, CUSTOMER_PERMISSIONS, SELLER_PERMISSIONS } from '@/lib/api-keys';

/**
 * API Keys Management — Database-backed
 * GET    — List user's API keys
 * POST   — Create new key
 * DELETE — Revoke key
 */

export async function GET(req: NextRequest) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const keys = await getApiKeysByUser(authResult.userId);
        const isAutoCreate = new URL(req.url).searchParams.get('auto') === '1';

        // Auto-create a key if requested and none exist
        if (isAutoCreate && keys.length === 0) {
            const { apiKey, rawKey } = await getOrCreateUserApiKey(authResult.userId);
            return NextResponse.json({
                success: true,
                data: [apiKey],
                newKey: rawKey, // Only returned on first auto-creation
                permissionOptions: { CUSTOMER: CUSTOMER_PERMISSIONS, SELLER: SELLER_PERMISSIONS },
            });
        }

        return NextResponse.json({
            success: true,
            data: keys,
            permissionOptions: { CUSTOMER: CUSTOMER_PERMISSIONS, SELLER: SELLER_PERMISSIONS },
        });
    } catch (error) {
        console.error('[API Keys] GET error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const body = await req.json();
        const { label, type, permissions } = body;

        if (!label || !type) {
            return NextResponse.json({ success: false, message: 'Cần label và type' }, { status: 400 });
        }

        const validPerms = type === 'SELLER'
            ? SELLER_PERMISSIONS.map(p => p.id)
            : CUSTOMER_PERMISSIONS.map(p => p.id);

        const filteredPerms = (permissions || validPerms).filter((p: string) => validPerms.includes(p));

        const { apiKey, rawKey } = await createApiKey({
            userId: authResult.userId,
            label,
            type,
            permissions: filteredPerms,
        });

        return NextResponse.json({
            success: true,
            message: 'API Key đã được tạo thành công',
            data: { ...apiKey, key: rawKey },
            warning: '⚠️ Lưu API Key này ngay! Bạn sẽ không thể xem lại key đầy đủ sau khi đóng trang này.',
        }, { status: 201 });
    } catch (error) {
        console.error('[API Keys] POST error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi tạo API Key' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { searchParams } = new URL(req.url);
        const keyId = searchParams.get('id');

        if (!keyId) {
            return NextResponse.json({ success: false, message: 'Missing key ID' }, { status: 400 });
        }

        const result = await revokeApiKey(keyId, authResult.userId);
        if (result) {
            return NextResponse.json({ success: true, message: 'API Key đã bị thu hồi' });
        }
        return NextResponse.json({ success: false, message: 'Không tìm thấy API Key' }, { status: 404 });
    } catch (error) {
        console.error('[API Keys] DELETE error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi thu hồi' }, { status: 500 });
    }
}
