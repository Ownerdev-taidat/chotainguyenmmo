export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { fetchMBBankTransactionsFromWeb } from '@/lib/mbbank';

/**
 * POST /api/payment/mbbank/check — Check MBBank transactions
 * EXACT matching logic from shop-mmo
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { depositCode, amount, content } = body;

        // Support both field names
        const searchContent = content || depositCode || '';
        const searchAmount = parseInt(amount) || 0;

        console.log(`[MB Bank Check] ========================================`);
        console.log(`[MB Bank Check] Nhận request check:`, { searchContent, searchAmount });

        if (!searchContent) {
            return NextResponse.json({ success: false, status: 'error', message: 'Thiếu nội dung tìm kiếm' }, { status: 400 });
        }

        // Gọi MB Bank API (session + apicanhan fallback)
        let transactions: any[];
        try {
            transactions = await fetchMBBankTransactionsFromWeb();
        } catch (error: any) {
            console.error(`[MB Bank Check] ❌ Lỗi khi gọi MB Bank API:`, error);
            return NextResponse.json({
                success: false,
                status: 'error',
                message: 'Không thể kết nối đến MB Bank API: ' + error.message,
            }, { status: 500 });
        }

        console.log(`[MB Bank Check] Tìm kiếm trong ${transactions.length} giao dịch...`);

        // Tìm giao dịch khớp — EXACT shop-mmo logic
        const matchingTransaction = transactions.find((t: any) => {
            // So sánh số tiền (cho phép sai lệch 1000đ)
            const tAmount = parseInt(t.amount || '0');
            const amountDiff = Math.abs(tAmount - searchAmount);
            const isAmountMatch = amountDiff <= 1000;

            // So sánh nội dung (không phân biệt hoa thường, bỏ khoảng trắng)
            const tDescription = (t.description || '').toString().toUpperCase().replace(/\s/g, '');
            const targetContent = searchContent.toUpperCase().replace(/\s/g, '');
            const isContentMatch = tDescription.includes(targetContent) || targetContent.includes(tDescription);

            if (isAmountMatch && isContentMatch) {
                console.log(`[MB Bank Check] ✅ Tìm thấy giao dịch khớp:`, {
                    transactionID: t.transactionID,
                    amount: t.amount,
                    description: t.description,
                    date: t.transactionDate,
                });
            }

            return isAmountMatch && isContentMatch;
        });

        if (matchingTransaction) {
            console.log(`[MB Bank Check] ✅ PHÁT HIỆN GIAO DỊCH!`);
            console.log(`[MB Bank Check] ========================================`);

            return NextResponse.json({
                success: true,
                status: 'found',
                paid: true,
                transaction: {
                    transaction_id: matchingTransaction.transactionID || matchingTransaction.refNo || '',
                    amount: parseInt(matchingTransaction.amount || '0'),
                    description: matchingTransaction.description || '',
                    transaction_date: matchingTransaction.transactionDate || '',
                },
                message: `Tìm thấy giao dịch ${parseInt(matchingTransaction.amount || '0').toLocaleString('vi-VN')}đ`,
            });
        }

        console.log(`[MB Bank Check] ❌ Không tìm thấy giao dịch khớp`);
        console.log(`[MB Bank Check] ========================================`);

        return NextResponse.json({
            success: true,
            status: 'not_found',
            paid: false,
            message: 'Chưa phát hiện thanh toán',
            debug: { txCount: transactions.length },
        });
    } catch (error: any) {
        console.error('[MB Bank Check] Error:', error);
        return NextResponse.json({
            success: false,
            status: 'error',
            message: error.message,
        }, { status: 500 });
    }
}
