export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getMBBankService } from '@/lib/mbbank';

// GET: Fetch latest transactions from MBBank via apicanhan
export async function GET() {
    const mbService = getMBBankService();

    try {
        const transactions = await mbService.getTransactions(20);

        if (transactions !== null) {
            return NextResponse.json({
                status: 'success',
                source: 'live',
                transactions,
                accountNo: process.env.MBBANK_ACCOUNT || '',
            });
        }

        return NextResponse.json({
            error: 'Failed to fetch from MBBank API — check API key and credentials',
            hint: 'Verify MBBANK_API_KEY, MBBANK_USERNAME, MBBANK_PASSWORD, MBBANK_ACCOUNT in Railway Variables',
        }, { status: 502 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Check if a specific deposit code exists in transactions (auto-verify deposit)
export async function POST(req: NextRequest) {
    const { depositCode, amount } = await req.json();
    const mbService = getMBBankService();

    try {
        if (depositCode && amount) {
            const match = await mbService.checkDeposit(depositCode, parseInt(amount));
            if (match) {
                return NextResponse.json({
                    status: 'found',
                    transaction: match,
                    message: `Đã tìm thấy giao dịch ${match.transaction_id} với số tiền ${match.amount.toLocaleString('vi-VN')}đ`,
                });
            }
        }

        return NextResponse.json({
            status: 'not_found',
            message: 'Chưa tìm thấy giao dịch. Vui lòng chờ 1-5 phút và thử lại.',
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
