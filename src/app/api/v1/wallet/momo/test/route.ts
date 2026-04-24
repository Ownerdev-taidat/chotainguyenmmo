export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * GET /api/v1/wallet/momo/test
 * Test MoMo API with SANDBOX keys to verify code works.
 * Uses the exact same format as MoMo.js from the official GitHub repo.
 */
export async function GET() {
    // Official MoMo sandbox test keys (from MoMo.js sample)
    const partnerCode = 'MOMO';
    const accessKey = 'F8BBA842ECF85';
    const secretKey = 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
    const redirectUrl = 'https://momo.vn/return';
    const ipnUrl = 'https://callback.url/notify';
    const amount = '50000';
    const orderId = partnerCode + new Date().getTime();
    const requestId = orderId;
    const orderInfo = 'Test MoMo from ChoTaiNguyen';
    const extraData = '';
    const requestType = 'captureWallet';

    // Exact signature format from MoMo.js
    const rawSignature =
        'accessKey=' + accessKey +
        '&amount=' + amount +
        '&extraData=' + extraData +
        '&ipnUrl=' + ipnUrl +
        '&orderId=' + orderId +
        '&orderInfo=' + orderInfo +
        '&partnerCode=' + partnerCode +
        '&redirectUrl=' + redirectUrl +
        '&requestId=' + requestId +
        '&requestType=' + requestType;

    const signature = crypto.createHmac('sha256', secretKey)
        .update(rawSignature).digest('hex');

    // Exact body from MoMo.js
    const body = {
        partnerCode,
        accessKey,
        requestId,
        amount,
        orderId,
        orderInfo,
        redirectUrl,
        ipnUrl,
        extraData,
        requestType,
        signature,
        lang: 'vi',
    };

    try {
        const res = await fetch('https://test-payment.momo.vn/v2/gateway/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await res.json();

        return NextResponse.json({
            test: 'MoMo Sandbox Test',
            result: data.resultCode === 0 ? '✅ SUCCESS — Code is correct!' : '❌ FAILED',
            resultCode: data.resultCode,
            message: data.message,
            payUrl: data.payUrl || null,
            rawSignature,
        });
    } catch (error: any) {
        return NextResponse.json({
            test: 'MoMo Sandbox Test',
            result: '❌ NETWORK ERROR',
            error: error.message,
        });
    }
}
