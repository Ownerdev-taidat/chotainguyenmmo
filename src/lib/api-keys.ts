/**
 * API Key Management System — Database-backed (Prisma)
 * Supports both Seller & Customer API keys
 */

import crypto from 'crypto';
import prisma from '@/lib/prisma';

export interface ApiKeyResult {
    id: string;
    keyPrefix: string;
    userId: string;
    label: string;
    type: string;
    permissions: string[];
    isActive: boolean;
    rateLimit: number;
    usageCount: number;
    lastUsedAt: string | null;
    createdAt: string;
}

function hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(prefix: string = 'ctn'): string {
    const random = crypto.randomBytes(24).toString('base64url');
    return `${prefix}_live_${random}`;
}

export async function createApiKey(data: {
    userId: string;
    label: string;
    type: 'SELLER' | 'CUSTOMER';
    permissions: string[];
}): Promise<{ apiKey: ApiKeyResult; rawKey: string }> {
    const rawKey = generateApiKey();
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12) + '****';

    const record = await prisma.apiKeyDb.create({
        data: {
            keyHash,
            keyPrefix,
            userId: data.userId,
            label: data.label,
            type: data.type,
            permissions: JSON.stringify(data.permissions),
            isActive: true,
            rateLimit: data.type === 'SELLER' ? 120 : 60,
        },
    });

    return {
        apiKey: {
            id: record.id,
            keyPrefix: record.keyPrefix,
            userId: record.userId,
            label: record.label,
            type: record.type,
            permissions: JSON.parse(record.permissions),
            isActive: record.isActive,
            rateLimit: record.rateLimit,
            usageCount: record.usageCount,
            lastUsedAt: record.lastUsedAt?.toISOString() || null,
            createdAt: record.createdAt.toISOString(),
        },
        rawKey,
    };
}

export async function validateApiKey(rawKey: string): Promise<{
    userId: string;
    type: string;
    permissions: string[];
    rateLimit: number;
} | null> {
    const hash = hashKey(rawKey);
    const found = await prisma.apiKeyDb.findFirst({
        where: { keyHash: hash, isActive: true },
    });
    if (!found) return null;

    // Update usage stats (fire and forget)
    prisma.apiKeyDb.update({
        where: { id: found.id },
        data: {
            lastUsedAt: new Date(),
            usageCount: { increment: 1 },
        },
    }).catch(() => { });

    return {
        userId: found.userId,
        type: found.type,
        permissions: JSON.parse(found.permissions),
        rateLimit: found.rateLimit,
    };
}

export async function getApiKeysByUser(userId: string): Promise<ApiKeyResult[]> {
    const keys = await prisma.apiKeyDb.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    });
    return keys.map(k => ({
        id: k.id,
        keyPrefix: k.keyPrefix,
        userId: k.userId,
        label: k.label,
        type: k.type,
        permissions: JSON.parse(k.permissions),
        isActive: k.isActive,
        rateLimit: k.rateLimit,
        usageCount: k.usageCount,
        lastUsedAt: k.lastUsedAt?.toISOString() || null,
        createdAt: k.createdAt.toISOString(),
    }));
}

export async function getOrCreateUserApiKey(userId: string): Promise<{ apiKey: ApiKeyResult; rawKey?: string }> {
    const existing = await prisma.apiKeyDb.findFirst({
        where: { userId, isActive: true, type: 'CUSTOMER' },
        orderBy: { createdAt: 'desc' },
    });
    if (existing) {
        return {
            apiKey: {
                id: existing.id,
                keyPrefix: existing.keyPrefix,
                userId: existing.userId,
                label: existing.label,
                type: existing.type,
                permissions: JSON.parse(existing.permissions),
                isActive: existing.isActive,
                rateLimit: existing.rateLimit,
                usageCount: existing.usageCount,
                lastUsedAt: existing.lastUsedAt?.toISOString() || null,
                createdAt: existing.createdAt.toISOString(),
            },
        };
    }
    // Auto-create
    return createApiKey({
        userId,
        label: 'Auto-generated',
        type: 'CUSTOMER',
        permissions: ['products:read', 'purchase', 'orders:read', 'balance:read'],
    });
}

export async function revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    const key = await prisma.apiKeyDb.findFirst({
        where: { id: keyId, userId },
    });
    if (!key) return false;
    await prisma.apiKeyDb.update({
        where: { id: keyId },
        data: { isActive: false },
    });
    return true;
}

// Permission definitions
export const CUSTOMER_PERMISSIONS = [
    { id: 'products:read', label: 'Xem sản phẩm', description: 'Tìm kiếm & xem chi tiết sản phẩm' },
    { id: 'purchase', label: 'Mua hàng', description: 'Mua sản phẩm bằng số dư ví' },
    { id: 'orders:read', label: 'Xem đơn hàng', description: 'Xem lịch sử đơn hàng' },
    { id: 'balance:read', label: 'Xem số dư', description: 'Xem số dư ví' },
];

export const SELLER_PERMISSIONS = [
    ...CUSTOMER_PERMISSIONS,
    { id: 'products:write', label: 'Quản lý sản phẩm', description: 'Tạo/sửa/xóa sản phẩm' },
    { id: 'stock:read', label: 'Xem tồn kho', description: 'Xem số lượng tồn kho' },
    { id: 'stock:write', label: 'Quản lý tồn kho', description: 'Thêm/xóa stock từ kho' },
    { id: 'orders:manage', label: 'Quản lý đơn hàng', description: 'Xử lý đơn hàng của shop' },
];
