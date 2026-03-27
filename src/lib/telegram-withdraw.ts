/**
 * Telegram Withdrawal Bot — Semi-Auto Withdrawal via Telegram
 * 
 * Flow:
 * 1. Seller creates withdrawal → sendWithdrawalNotification() → all admin IDs get message
 * 2. Admin clicks "Duyệt" → showTransferDetails() → shows bank info
 * 3. Admin clicks "Đã chuyển tiền" → confirmTransfer() → updates web status
 * 4. Admin clicks "Từ chối" → rejectWithdrawal() → refunds wallet
 */

const BOT_TOKEN = process.env.WITHDRAW_BOT_TOKEN || '';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://chotainguyenmmo.com';

interface WithdrawalInfo {
    id: string;
    sellerName: string;
    amount: number;
    fee: number;
    netAmount: number;
    bankName: string;
    accountNumber: string;
    accountName: string;
}

/** Get admin Chat IDs from platform_settings JSON */
export async function getWithdrawAdminChatIds(): Promise<string[]> {
    try {
        const prisma = (await import('@/lib/prisma')).default;
        const record = await prisma.setting.findUnique({
            where: { key: 'platform_settings' },
        });
        if (record?.value) {
            const settings = JSON.parse(record.value);
            const ids = settings.withdrawTelegramChatIds;
            return Array.isArray(ids) ? ids.filter((id: string) => id.trim()) : [];
        }
    } catch (e) {
        console.error('[Telegram Withdraw] Error loading admin IDs:', e);
    }
    return [];
}

/** Send Telegram message */
async function sendTelegramMessage(chatId: string, text: string, replyMarkup?: any): Promise<any> {
    if (!BOT_TOKEN) {
        console.error('[Telegram Withdraw] BOT_TOKEN not set');
        return null;
    }
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
            }),
        });
        return await res.json();
    } catch (e) {
        console.error('[Telegram Withdraw] Send error:', e);
        return null;
    }
}

/** Edit existing Telegram message */
async function editTelegramMessage(chatId: string, messageId: number, text: string, replyMarkup?: any): Promise<any> {
    if (!BOT_TOKEN) return null;
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text,
                parse_mode: 'HTML',
                ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
            }),
        });
        return await res.json();
    } catch (e) {
        console.error('[Telegram Withdraw] Edit error:', e);
        return null;
    }
}

/** Answer callback query (remove loading state) */
async function answerCallback(callbackQueryId: string, text?: string): Promise<void> {
    if (!BOT_TOKEN) return;
    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                callback_query_id: callbackQueryId,
                text: text || '',
            }),
        });
    } catch { }
}

/** Format VND */
function fmtVND(n: number): string {
    return n.toLocaleString('vi-VN') + 'đ';
}

/**
 * Step 1: Notify all admins about new withdrawal request
 */
export async function sendWithdrawalNotification(info: WithdrawalInfo): Promise<void> {
    const chatIds = await getWithdrawAdminChatIds();
    if (chatIds.length === 0) {
        console.warn('[Telegram Withdraw] No admin Chat IDs configured');
        return;
    }

    const text = `🏦 <b>YÊU CẦU RÚT TIỀN MỚI</b>\n\n` +
        `👤 Seller: <b>${info.sellerName}</b>\n` +
        `💰 Số tiền: <b>${fmtVND(info.amount)}</b>\n` +
        `📉 Phí: ${fmtVND(info.fee)}\n` +
        `✅ Thực nhận: <b>${fmtVND(info.netAmount)}</b>\n\n` +
        `🏛 Ngân hàng: ${info.bankName}\n` +
        `🔢 STK: <code>${info.accountNumber}</code>\n` +
        `👤 Tên TK: ${info.accountName}\n\n` +
        `⏰ ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`;

    const replyMarkup = {
        inline_keyboard: [[
            { text: '✅ Duyệt', callback_data: `wd_approve:${info.id}` },
            { text: '❌ Từ chối', callback_data: `wd_reject:${info.id}` },
        ]],
    };

    for (const chatId of chatIds) {
        await sendTelegramMessage(chatId, text, replyMarkup);
    }
}

/**
 * Step 2: Show transfer details after admin approves
 */
export async function showTransferDetails(
    chatId: string,
    messageId: number,
    callbackQueryId: string,
    info: WithdrawalInfo,
    adminName: string
): Promise<void> {
    await answerCallback(callbackQueryId, '✅ Đã duyệt! Vui lòng chuyển tiền.');

    const text = `✅ <b>ĐÃ DUYỆT — CHUYỂN TIỀN</b>\n` +
        `Được duyệt bởi: ${adminName}\n\n` +
        `━━━ THÔNG TIN CHUYỂN KHOẢN ━━━\n\n` +
        `🏛 Ngân hàng: <b>${info.bankName}</b>\n` +
        `🔢 STK: <code>${info.accountNumber}</code>\n` +
        `👤 Tên: <b>${info.accountName}</b>\n` +
        `💰 Số tiền: <b>${fmtVND(info.netAmount)}</b>\n` +
        `📝 Nội dung: <code>RUT ${info.id.slice(-6).toUpperCase()}</code>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ Sau khi chuyển xong, bấm nút bên dưới.`;

    const replyMarkup = {
        inline_keyboard: [[
            { text: '💰 Đã chuyển tiền', callback_data: `wd_done:${info.id}` },
        ], [
            { text: '↩️ Hủy duyệt', callback_data: `wd_reject:${info.id}` },
        ]],
    };

    await editTelegramMessage(chatId, messageId, text, replyMarkup);
}

/**
 * Step 3: Confirm transfer done
 */
export async function confirmTransferDone(
    chatId: string,
    messageId: number,
    callbackQueryId: string,
    info: WithdrawalInfo,
    adminName: string
): Promise<void> {
    await answerCallback(callbackQueryId, '💰 Đã xác nhận chuyển tiền!');

    const text = `💰 <b>ĐÃ CHUYỂN TIỀN THÀNH CÔNG</b>\n\n` +
        `👤 Seller: ${info.sellerName}\n` +
        `💰 Số tiền: ${fmtVND(info.netAmount)}\n` +
        `🏛 ${info.bankName} — ${info.accountNumber}\n` +
        `✅ Xác nhận bởi: ${adminName}\n` +
        `⏰ ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`;

    await editTelegramMessage(chatId, messageId, text);
}

/**
 * Reject withdrawal
 */
export async function showRejected(
    chatId: string,
    messageId: number,
    callbackQueryId: string,
    info: WithdrawalInfo,
    adminName: string
): Promise<void> {
    await answerCallback(callbackQueryId, '❌ Đã từ chối và hoàn tiền.');

    const text = `❌ <b>ĐÃ TỪ CHỐI RÚT TIỀN</b>\n\n` +
        `👤 Seller: ${info.sellerName}\n` +
        `💰 Số tiền: ${fmtVND(info.amount)} — đã hoàn về ví\n` +
        `❌ Từ chối bởi: ${adminName}\n` +
        `⏰ ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`;

    await editTelegramMessage(chatId, messageId, text);
}
