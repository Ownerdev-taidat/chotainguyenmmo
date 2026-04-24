export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { fetchMBBankTransactionsFromWeb } from '@/lib/mbbank';

// GET /api/payment/mbbank/test — Test MBBank API connectivity
export async function GET() {
    const apiKey = process.env.APICANHAN_KEY || process.env.MBBANK_API_KEY || '';
    const username = process.env.MBBANK_USERNAME || '';
    const password = process.env.MBBANK_PASSWORD || '';
    const account = process.env.MBBANK_ACCOUNT || '';

    const cookie = process.env.MBBANK_COOKIE || '';
    const sessionId = process.env.MBBANK_SESSION_ID || '';
    const token = process.env.MBBANK_TOKEN || '';
    const deviceId = process.env.MBBANK_DEVICEID || '';

    const result: any = {
        timestamp: new Date().toISOString(),
        envCheck: {
            APICANHAN_KEY: apiKey ? `✅ Set (${apiKey.slice(0, 8)}...)` : '❌ Missing',
            MBBANK_USERNAME: username ? `✅ ${username}` : '❌ Missing',
            MBBANK_PASSWORD: password ? `✅ Set (${password.length} chars)` : '❌ Missing',
            MBBANK_ACCOUNT: account ? `✅ ${account}` : '❌ Missing',
            MBBANK_COOKIE: cookie ? `✅ Set (${cookie.length} chars)` : '⚠️ Not set (apicanhan only)',
            MBBANK_SESSION_ID: sessionId ? `✅ ${sessionId.slice(0, 12)}...` : '⚠️ Not set',
            MBBANK_TOKEN: token ? `✅ Set (${token.length} chars)` : '⚠️ Not set',
            MBBANK_DEVICEID: deviceId ? `✅ ${deviceId}` : '⚠️ Not set',
        },
        mode: (cookie && sessionId) ? 'cookie/session + apicanhan fallback' : 'apicanhan only',
    };

    if (!apiKey || !username || !password || !account) {
        result.status = 'error';
        result.error = 'Missing required env vars';
        return NextResponse.json(result);
    }

    try {
        const transactions = await fetchMBBankTransactionsFromWeb();
        result.status = 'success';
        result.httpStatus = 200;
        result.transactionCount = transactions.length;
        result.incomingTransactions = transactions.filter((t: any) => t.type === 'IN').length;
        result.outgoingTransactions = transactions.filter((t: any) => t.type === 'OUT').length;
        result.recentTransactions = transactions.slice(0, 5).map((t: any) => ({
            id: t.transactionID,
            amount: t.amount,
            type: t.type,
            date: t.transactionDate,
            description: (t.description || '').substring(0, 100),
        }));
    } catch (error: any) {
        result.status = 'error';
        result.httpStatus = 500;
        result.fetchError = error.message;
    }

    return NextResponse.json(result);
}
