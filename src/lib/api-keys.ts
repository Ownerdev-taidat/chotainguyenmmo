/**
 * API Key Management System
 * Supports both Seller & Customer API keys
 * In-memory store (replace with database later)
 */

import crypto from 'crypto';

export interface ApiKey {
    id: string;
    key: string;           // The actual API key (shown once)
    keyHash: string;       // SHA256 hash for lookup
    userId: string;
    username: string;
    label: string;         // User-defined label e.g. "My Bot", "Telegram Bot"
    type: 'SELLER' | 'CUSTOMER';
    permissions: string[]; // e.g. ['products:read', 'purchase', 'orders:read']
    isActive: boolean;
    createdAt: string;
    lastUsed?: string;
    usageCount: number;
    rateLimit: number;     // Requests per minute
    // Google Sheets config (for sellers)
    googleSheetUrl?: string;
    googleSheetSyncEnabled?: boolean;
    googleSheetLastSync?: string;
}

// In-memory store — không có demo key mặc định (bảo mật)
// TODO: Migrate sang database (Prisma) để persist qua restart
let apiKeys: ApiKey[] = [];

function hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(prefix: string = 'ctn'): string {
    const random = crypto.randomBytes(24).toString('base64url');
    return `${prefix}_live_${random}`;
}

export function createApiKey(data: {
    userId: string;
    username: string;
    label: string;
    type: 'SELLER' | 'CUSTOMER';
    permissions: string[];
    googleSheetUrl?: string;
}): { apiKey: ApiKey; rawKey: string } {
    const rawKey = generateApiKey();
    const apiKey: ApiKey = {
        id: `apk_${Date.now()}`,
        key: rawKey.substring(0, 12) + '****', // Masked for storage
        keyHash: hashKey(rawKey),
        userId: data.userId,
        username: data.username,
        label: data.label,
        type: data.type,
        permissions: data.permissions,
        isActive: true,
        createdAt: new Date().toISOString(),
        usageCount: 0,
        rateLimit: data.type === 'SELLER' ? 120 : 60,
        googleSheetUrl: data.googleSheetUrl,
        googleSheetSyncEnabled: !!data.googleSheetUrl,
    };
    apiKeys.push(apiKey);
    return { apiKey, rawKey };
}

export function validateApiKey(rawKey: string): ApiKey | null {
    const hash = hashKey(rawKey);
    const found = apiKeys.find(k => k.keyHash === hash && k.isActive);
    if (found) {
        found.lastUsed = new Date().toISOString();
        found.usageCount++;
    }
    return found || null;
}

export function getApiKeysByUser(userId: string): ApiKey[] {
    return apiKeys.filter(k => k.userId === userId);
}

export function revokeApiKey(keyId: string, userId: string): boolean {
    const key = apiKeys.find(k => k.id === keyId && k.userId === userId);
    if (key) {
        key.isActive = false;
        return true;
    }
    return false;
}

export function updateApiKeyGoogleSheet(keyId: string, userId: string, sheetUrl: string, syncEnabled: boolean): boolean {
    const key = apiKeys.find(k => k.id === keyId && k.userId === userId);
    if (key) {
        key.googleSheetUrl = sheetUrl;
        key.googleSheetSyncEnabled = syncEnabled;
        return true;
    }
    return false;
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
    { id: 'sheets:sync', label: 'Google Sheets Sync', description: 'Đồng bộ tồn kho từ Google Sheets' },
    { id: 'webhook', label: 'Webhook', description: 'Nhận thông báo đơn hàng mới' },
];
