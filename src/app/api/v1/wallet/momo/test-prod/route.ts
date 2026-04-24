export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * GET /api/v1/wallet/momo/test-prod
 * Test MoMo PRODUCTION — matches official docs format exactly.
 * NO accessKey in body, base64 extraData.
 */
export async function GET() {
    const partnerCode = process.env.MOMO_PARTNER_CODE || '';
    const accessKey = process.env.MOMO_ACCESS_KEY || '';
    const secretKey = process.env.MOMO_SECRET_KEY || '';
    const endpoint = 'https://payment.momo.vn/v2/gateway/api/create';

    const requestId = 'Request_ID_' + new Date().getTime();
    const orderId = 'Test_' + new Date().getTime();
    const amount = '10000';
    const orderInfo = 'Test MoMo production';
    const redirectUrl = 'https://chotainguyenmmo.com/dashboard/nap-tien?momo=callback';
    const ipnUrl = 'https://chotainguyenmmo.com/api/v1/wallet/momo/ipn';
    const extraData = Buffer.from('{"skus":""}').toString('base64');
    const requestType = 'captureWallet';

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

    // Body matches official docs sample — NO accessKey!
    const body = {
        partnerCode,
        requestType,
        ipnUrl,
        redirectUrl,
        orderId,
        amount,
        orderInfo,
        requestId,
        extraData,
        signature,
        lang: 'vi',
    };

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await res.json();

        return NextResponse.json({
            test: 'MoMo PRODUCTION (docs format)',
            result: data.resultCode === 0 ? '✅ SUCCESS' : `❌ code ${data.resultCode}`,
            response: data,
            sentBody: body,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message });
    }
}
