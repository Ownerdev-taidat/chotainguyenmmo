import { NextRequest, NextResponse } from 'next/server';

// Read MBBank config from environment variables (Railway)
function getConfig() {
    const apicanhanKey = process.env.MBBANK_API_KEY || '';
    const apicanhanUser = process.env.MBBANK_USERNAME || '';
    const apicanhanPass = process.env.MBBANK_PASSWORD || '';
    const apicanhanAccount = process.env.MBBANK_ACCOUNT || '';
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    const chatId = process.env.TELEGRAM_CHAT_ID || '';

    if (!apicanhanKey || !apicanhanUser) {
        return null;
    }

    return {
        apicanhanKey,
        apicanhanUser,
        apicanhanPass,
        apicanhanAccount,
        accountNo: apicanhanAccount,
        botToken,
        chat_id: chatId,
    };
}

// GET: Fetch latest transactions from MBBank via apicanhan
export async function GET() {
    const config = getConfig();
    if (!config) {
        return NextResponse.json({ 
            error: 'MBBank config not found. Please set MBBANK_API_KEY, MBBANK_USERNAME, MBBANK_PASSWORD, MBBANK_ACCOUNT in environment variables.',
            hint: 'Go to Railway → Service → Variables to add them.',
        }, { status: 500 });
    }

    try {
        const apiUrl = `https://apicanhan.com/api/mb/transactions`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: config.apicanhanKey,
                username: config.apicanhanUser,
                password: config.apicanhanPass,
                accountNo: config.apicanhanAccount,
            }),
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch from MBBank API', status: response.status }, { status: 502 });
        }

        const data = await response.json();
        return NextResponse.json({
            status: 'success',
            source: 'live',
            transactions: data.transactions || [],
            accountNo: config.accountNo,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Check if a specific deposit code exists in transactions (auto-verify deposit)
export async function POST(req: NextRequest) {
    const { depositCode, amount } = await req.json();
    const config = getConfig();
    if (!config) {
        return NextResponse.json({ error: 'MBBank config not found' }, { status: 500 });
    }

    try {
        let transactions: any[] = [];

        try {
            const apiUrl = `https://apicanhan.com/api/mb/transactions`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: config.apicanhanKey,
                    username: config.apicanhanUser,
                    password: config.apicanhanPass,
                    accountNo: config.apicanhanAccount,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                transactions = data.transactions || [];
            }
        } catch {
            // API call failed
        }

        // Search for matching transaction
        const match = transactions.find((tx: any) => {
            const desc = (tx.description || '').toUpperCase();
            const codeMatch = depositCode && desc.includes(depositCode.toUpperCase());
            const amountMatch = amount ? parseInt(tx.amount) === parseInt(amount) : true;
            const isIncoming = tx.type === 'IN';
            return codeMatch && amountMatch && isIncoming;
        });

        if (match) {
            return NextResponse.json({
                status: 'found',
                transaction: match,
                message: `Đã tìm thấy giao dịch ${match.transactionID} với số tiền ${parseInt(match.amount).toLocaleString('vi-VN')}đ`,
            });
        }

        return NextResponse.json({
            status: 'not_found',
            message: 'Chưa tìm thấy giao dịch. Vui lòng chờ 1-5 phút và thử lại.',
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
