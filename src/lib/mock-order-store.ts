/**
 * Mock Order Store — Quản lý đơn hàng + ví với file persistence
 * Có phí sàn (commission) — admin điều chỉnh được
 */
import fs from 'fs';
import path from 'path';
import { products } from '@/lib/mock-data';

export interface MockOrder {
    id: string;
    orderCode: string;
    userId: string;
    productId: string;
    productName: string;
    shopName: string;
    sellerId?: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    platformFee: number;        // Phí sàn thu được
    sellerEarning: number;      // Seller nhận (totalAmount - platformFee)
    commissionRate: number;     // % phí sàn tại thời điểm mua
    status: 'pending' | 'paid' | 'delivered' | 'completed' | 'cancelled' | 'complaint';
    deliveryType: string;
    deliveredContent?: string;
    createdAt: string;
}

export interface MockTransaction {
    id: string;
    userId: string;
    type: 'deposit' | 'purchase' | 'refund' | 'sale_earning' | 'platform_fee' | 'withdrawal';
    direction: 'credit' | 'debit';
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
}

// ==================== FILE PERSISTENCE ====================
const DATA_DIR = path.join(process.cwd(), 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const TXN_FILE = path.join(DATA_DIR, 'transactions.json');
const BALANCES_FILE = path.join(DATA_DIR, 'balances.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'admin-settings.json');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJson<T>(file: string, fallback: T): T {
    try {
        ensureDataDir();
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) { console.error(`Failed to load ${file}:`, e); }
    return fallback;
}

function saveJson(file: string, data: unknown) {
    try {
        ensureDataDir();
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) { console.error(`Failed to save ${file}:`, e); }
}

// Initialize from files
let orders: MockOrder[] = loadJson(ORDERS_FILE, []);
let transactions: MockTransaction[] = loadJson(TXN_FILE, []);
let userBalances: Record<string, number> = loadJson(BALANCES_FILE, {});

// ==================== ADMIN SETTINGS ====================
export interface AdminPlatformSettings {
    commissionRate: number;      // % phí sàn trên doanh thu seller (default 5)
    withdrawalFee: number;       // Phí rút tiền cố định / lần (VNĐ) — chỉ thu seller
    minWithdraw: number;         // Rút tối thiểu
    minDeposit: number;          // Nạp tối thiểu
    bankName: string;            // Ngân hàng nhận nạp tiền
    bankAccount: string;         // STK nhận nạp tiền
    bankOwner: string;           // Chủ tài khoản
    platformTotalEarnings: number; // Tổng phí sàn đã thu
}

const DEFAULT_SETTINGS: AdminPlatformSettings = {
    commissionRate: 5,
    withdrawalFee: 15000,
    minWithdraw: 500000,
    minDeposit: 10000,
    bankName: 'MB Bank',
    bankAccount: '0393959643',
    bankOwner: 'NGUYEN TAI DAT',
    platformTotalEarnings: 0,
};

let platformSettings: AdminPlatformSettings = loadJson(SETTINGS_FILE, DEFAULT_SETTINGS);

export function getPlatformSettings(): AdminPlatformSettings {
    return { ...platformSettings };
}

export function updatePlatformSettings(updates: Partial<AdminPlatformSettings>): AdminPlatformSettings {
    platformSettings = { ...platformSettings, ...updates };
    saveJson(SETTINGS_FILE, platformSettings);
    return platformSettings;
}

// ==================== BALANCE ====================

function generateOrderCode() {
    const d = new Date();
    const date = `${d.getFullYear().toString().slice(2)}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `CTN-${date}-${rand}`;
}

export function getUserBalance(userId: string): number {
    return userBalances[userId] ?? 0;
}

export function setUserBalance(userId: string, amount: number) {
    userBalances[userId] = amount;
    saveJson(BALANCES_FILE, userBalances);
}

export function getUserOrders(userId: string): MockOrder[] {
    return orders.filter(o => o.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getAllOrders(): MockOrder[] {
    return [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getUserTransactions(userId: string): MockTransaction[] {
    return transactions.filter(t => t.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getAllTransactions(): MockTransaction[] {
    return [...transactions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ==================== PURCHASE WITH PLATFORM FEE ====================

export function createPurchase(userId: string, productId: string, quantity: number): { success: boolean; message: string; order?: MockOrder; balance?: number } {
    const product = products.find(p => p.id === productId);
    if (!product) return { success: false, message: 'Sản phẩm không tồn tại' };

    if (product.stockCount < quantity) return { success: false, message: 'Sản phẩm hết hàng hoặc không đủ số lượng' };

    const total = product.price * quantity;
    const balance = getUserBalance(userId);

    if (balance < total) return { success: false, message: `Số dư không đủ. Cần ${total.toLocaleString('vi-VN')}đ, hiện có ${balance.toLocaleString('vi-VN')}đ` };

    // Calculate platform fee
    const rate = platformSettings.commissionRate;
    const platformFee = Math.floor(total * rate / 100);
    const sellerEarning = total - platformFee;

    // Deduct buyer balance
    const newBalance = balance - total;
    setUserBalance(userId, newBalance);

    // Create order
    const order: MockOrder = {
        id: `order_${Date.now()}`,
        orderCode: generateOrderCode(),
        userId,
        productId,
        productName: product.name,
        shopName: product.shopName,
        sellerId: product.sellerId,
        quantity,
        unitPrice: product.price,
        totalAmount: total,
        platformFee,
        sellerEarning,
        commissionRate: rate,
        status: product.deliveryType === 'auto' ? 'delivered' : 'paid',
        deliveryType: product.deliveryType,
        deliveredContent: product.deliveryType === 'auto'
            ? `Tài khoản: ${product.slug}-acc${Math.floor(Math.random() * 9000 + 1000)}@mail.com\nMật khẩu: Pass${Math.random().toString(36).slice(2, 10)}\n\nHướng dẫn sử dụng:\n1. Đăng nhập tại trang chủ dịch vụ\n2. Không đổi mật khẩu trong 30 ngày đầu\n3. Liên hệ shop nếu gặp vấn đề`
            : undefined,
        createdAt: new Date().toISOString(),
    };
    orders.push(order);

    // Buyer transaction
    const buyerTxn: MockTransaction = {
        id: `txn_${Date.now()}_buy`,
        userId,
        type: 'purchase',
        direction: 'debit',
        amount: total,
        balanceAfter: newBalance,
        description: `Thanh toán đơn hàng ${order.orderCode} — ${product.name} x${quantity}`,
        createdAt: new Date().toISOString(),
    };
    transactions.push(buyerTxn);

    // Credit seller (if has sellerId)
    if (product.sellerId) {
        const sellerBal = getUserBalance(product.sellerId);
        const newSellerBal = sellerBal + sellerEarning;
        setUserBalance(product.sellerId, newSellerBal);

        const sellerTxn: MockTransaction = {
            id: `txn_${Date.now()}_sell`,
            userId: product.sellerId,
            type: 'sale_earning',
            direction: 'credit',
            amount: sellerEarning,
            balanceAfter: newSellerBal,
            description: `Bán ${product.name} x${quantity} — sau phí sàn ${rate}% (${platformFee.toLocaleString('vi-VN')}đ)`,
            createdAt: new Date().toISOString(),
        };
        transactions.push(sellerTxn);
    }

    // Track platform earnings
    platformSettings.platformTotalEarnings += platformFee;
    saveJson(SETTINGS_FILE, platformSettings);

    // Decrease stock
    product.stockCount = Math.max(0, product.stockCount - quantity);
    product.soldCount += quantity;

    // Save all data
    saveJson(ORDERS_FILE, orders);
    saveJson(TXN_FILE, transactions);

    return { success: true, message: `Mua hàng thành công! Phí sàn ${rate}%: ${platformFee.toLocaleString('vi-VN')}đ`, order, balance: newBalance };
}

// ==================== DEPOSIT ====================

export function addDeposit(userId: string, amount: number): { success: boolean; balance: number } {
    const current = getUserBalance(userId);
    const newBalance = current + amount;
    setUserBalance(userId, newBalance);

    const txn: MockTransaction = {
        id: `txn_${Date.now()}_dep`,
        userId,
        type: 'deposit',
        direction: 'credit',
        amount,
        balanceAfter: newBalance,
        description: `Nạp tiền qua chuyển khoản ngân hàng`,
        createdAt: new Date().toISOString(),
    };
    transactions.push(txn);
    saveJson(TXN_FILE, transactions);

    return { success: true, balance: newBalance };
}

// ==================== STATS ====================

export function getPlatformStats() {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalPlatformFees = orders.reduce((sum, o) => sum + (o.platformFee || 0), 0);
    const totalSellerEarnings = orders.reduce((sum, o) => sum + (o.sellerEarning || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'paid' || o.status === 'pending').length;
    const completedOrders = orders.filter(o => o.status === 'delivered' || o.status === 'completed').length;

    return {
        totalOrders,
        totalRevenue,
        totalPlatformFees,
        totalSellerEarnings,
        pendingOrders,
        completedOrders,
        commissionRate: platformSettings.commissionRate,
    };
}
