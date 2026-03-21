/**
 * MoMo Payment Gateway — Based on nodejs_momo/CollectionLink.js reference
 * Using "payWithMethod" requestType (newer API version)
 */

import crypto from 'crypto';

export interface MoMoPaymentRequest {
    orderId: string;
    amount: number;
    orderInfo: string;
    extraData?: string;
}

export interface MoMoPaymentResponse {
    partnerCode: string;
    orderId: string;
    requestId: string;
    amount: number;
    responseTime: number;
    message: string;
    resultCode: number;
    payUrl: string;
    shortLink?: string;
    deeplink?: string;
    qrCodeUrl?: string;
}

function getConfig() {
    const partnerCode = process.env.MOMO_PARTNER_CODE || '';
    const accessKey = process.env.MOMO_ACCESS_KEY || '';
    const secretKey = process.env.MOMO_SECRET_KEY || '';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://chotainguyenmmo.com';

    return {
        partnerCode,
        accessKey,
        secretKey,
        redirectUrl: `${baseUrl}/dashboard/nap-tien?momo=callback`,
        ipnUrl: `${baseUrl}/api/v1/wallet/momo/ipn`,
        endpoint: process.env.MOMO_SANDBOX === 'true'
            ? 'https://test-payment.momo.vn/v2/gateway/api/create'
            : 'https://payment.momo.vn/v2/gateway/api/create',
    };
}

/**
 * Create MoMo payment — follows nodejs_momo/CollectionLink.js exactly
 */
export async function createMoMoPayment(req: MoMoPaymentRequest): Promise<MoMoPaymentResponse> {
    const cfg = getConfig();

    if (!cfg.partnerCode || !cfg.accessKey || !cfg.secretKey) {
        throw new Error('MoMo chưa cấu hình: cần MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY');
    }

    const requestId = cfg.partnerCode + new Date().getTime();
    const amount = req.amount; // keep as number for body
    const amountStr = String(req.amount); // string for signature
    const requestType = 'payWithMethod';
    const extraData = req.extraData || '';
    const orderGroupId = '';
    const autoCapture = true;
    const lang = 'vi';

    // Signature format from reference: sorted a-z
    const rawSignature =
        'accessKey=' + cfg.accessKey +
        '&amount=' + amount +
        '&extraData=' + extraData +
        '&ipnUrl=' + cfg.ipnUrl +
        '&orderId=' + req.orderId +
        '&orderInfo=' + req.orderInfo +
        '&partnerCode=' + cfg.partnerCode +
        '&redirectUrl=' + cfg.redirectUrl +
        '&requestId=' + requestId +
        '&requestType=' + requestType;

    console.log('[MoMo] Raw signature:', rawSignature);

    const signature = crypto.createHmac('sha256', cfg.secretKey)
        .update(rawSignature).digest('hex');

    console.log('[MoMo] Signature:', signature);

    // Request body — matches server.js reference exactly
    // amount as NUMBER (not string!)
    const body = {
        partnerCode: cfg.partnerCode,
        partnerName: 'ChoTaiNguyen',
        storeId: 'CTNStore',
        requestId: requestId,
        amount: amount,
        orderId: req.orderId,
        orderInfo: req.orderInfo,
        redirectUrl: cfg.redirectUrl,
        ipnUrl: cfg.ipnUrl,
        lang: lang,
        requestType: requestType,
        autoCapture: autoCapture,
        extraData: extraData,
        orderGroupId: orderGroupId,
        signature: signature,
    };

    console.log('[MoMo] Creating payment:', JSON.stringify({
        orderId: req.orderId,
        amount,
        endpoint: cfg.endpoint,
        partnerCode: cfg.partnerCode,
        requestType,
    }));

    const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log('[MoMo] Response:', JSON.stringify(data));

    if (data.resultCode !== 0) {
        throw new Error(`MoMo: ${data.message} (code: ${data.resultCode})`);
    }

    return data;
}

/**
 * Verify MoMo IPN callback signature
 */
export function verifyMoMoSignature(params: Record<string, any>): boolean {
    const cfg = getConfig();
    const {
        partnerCode, orderId, requestId, amount, orderInfo,
        orderType, transId, resultCode, message, payType,
        responseTime, extraData, signature,
    } = params;

    const rawSignature =
        'accessKey=' + cfg.accessKey +
        '&amount=' + amount +
        '&extraData=' + extraData +
        '&message=' + message +
        '&orderId=' + orderId +
        '&orderInfo=' + orderInfo +
        '&orderType=' + orderType +
        '&partnerCode=' + partnerCode +
        '&payType=' + payType +
        '&requestId=' + requestId +
        '&responseTime=' + responseTime +
        '&resultCode=' + resultCode +
        '&transId=' + transId;

    const expected = crypto.createHmac('sha256', cfg.secretKey)
        .update(rawSignature).digest('hex');

    return signature === expected;
}
