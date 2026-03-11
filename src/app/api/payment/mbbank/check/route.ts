import { NextRequest, NextResponse } from 'next/server';
import { getMBBankService } from '@/lib/mbbank';

// POST /api/payment/mbbank/check — Public deposit check (no auth required)
// Just checks if a transaction with the given code and amount exists
export async function POST(request: NextRequest) {
    try {
        const { depositCode, amount } = await request.json();

        if (!depositCode || !amount) {
            return NextResponse.json(
                { status: 'error', message: 'Thiếu depositCode hoặc amount' },
                { status: 400 }
            );
        }

        const mbService = getMBBankService();
        const match = await mbService.checkDeposit(depositCode, parseInt(amount));

        if (match) {
            return NextResponse.json({
                status: 'found',
                transaction: match,
                message: `Đã tìm thấy giao dịch ${match.transaction_id} — ${match.amount.toLocaleString('vi-VN')}đ`,
            });
        }

        return NextResponse.json({
            status: 'not_found',
            message: 'Chưa tìm thấy giao dịch phù hợp.',
        });
    } catch (error: any) {
        return NextResponse.json(
            { status: 'error', message: error.message },
            { status: 500 }
        );
    }
}
