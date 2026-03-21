/**
 * Binance Pay Integration — API v3
 * Docs: https://developers.binance.com/docs/binance-pay/api-order-create-v3
 */

import crypto from 'crypto';

export interface BinancePayOrderRequest {
    merchantTradeNo: string;
    orderAmount: number;
    currency?: string; // default USDT
    description: string;
}

export interface BinancePayOrderResponse {
    status: string;
    code: string;
    data: {
        prepayId: string;
        terminalType: string;
        expireTime: number;
        qrcodeLink: string;
        qrContent: string;
        checkoutUrl: string;
        deeplink: string;
        universalUrl: string;
        totalFee: string;
        currency: string;
    };
    errorMessage: string;
}

function getConfig() {
    return {
        apiKey: process.env.BINANCE_PAY_API_KEY || '',
        secretKey: process.env.BINANCE_PAY_SECRET_KEY || '',
        baseUrl: 'https://bpay.binanceapi.com',
    };
}

/**
 * Generate Binance Pay request signature
 * signature = HMAC-SHA512(timestamp + "\n" + nonce + "\n" + body)
 */
function generateSignature(timestamp: string, nonce: string, body: string, secretKey: string): string {
    const payload = `${timestamp}\n${nonce}\n${body}\n`;
    return crypto.createHmac('sha512', secretKey)
        .update(payload)
        .digest('hex')
        .toUpperCase();
}

function generateNonce(length: number = 32): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Create Binance Pay order — V3 API
 */
export async function createBinancePayOrder(req: BinancePayOrderRequest): Promise<BinancePayOrderResponse> {
    const cfg = getConfig();

    if (!cfg.apiKey || !cfg.secretKey) {
        throw new Error('Binance Pay chưa cấu hình: cần BINANCE_PAY_API_KEY và BINANCE_PAY_SECRET_KEY');
    }

    const timestamp = Date.now().toString();
    const nonce = generateNonce(32);

    const requestBody = {
        env: {
            terminalType: 'WEB',
        },
        merchantTradeNo: req.merchantTradeNo,
        orderAmount: req.orderAmount,
        currency: req.currency || 'USDT',
        description: req.description,
        goodsDetails: [{
            goodsType: '02', // virtual goods
            goodsCategory: 'Z000',
            referenceGoodsId: req.merchantTradeNo,
            goodsName: 'Nap tien vi ChoTaiNguyen',
            goodsDetail: req.description,
        }],
    };

    const bodyString = JSON.stringify(requestBody);
    const signature = generateSignature(timestamp, nonce, bodyString, cfg.secretKey);

    const url = `${cfg.baseUrl}/binancepay/openapi/v3/order`;

    console.log('[BinancePay] Creating order:', JSON.stringify({
        merchantTradeNo: req.merchantTradeNo,
        orderAmount: req.orderAmount,
        currency: req.currency || 'USDT',
    }));

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'BinancePay-Timestamp': timestamp,
            'BinancePay-Nonce': nonce,
            'BinancePay-Certificate-SN': cfg.apiKey,
            'BinancePay-Signature': signature,
        },
        body: bodyString,
    });

    const data: BinancePayOrderResponse = await res.json();
    console.log('[BinancePay] Response:', JSON.stringify(data));

    if (data.status !== 'SUCCESS' || data.code !== '000000') {
        throw new Error(`Binance Pay: ${data.errorMessage || data.code} (status: ${data.status})`);
    }

    return data;
}

/**
 * Verify Binance Pay webhook signature
 */
export function verifyBinancePayWebhook(timestamp: string, nonce: string, body: string, signature: string): boolean {
    const cfg = getConfig();
    const expectedSignature = generateSignature(timestamp, nonce, body, cfg.secretKey);
    return signature === expectedSignature;
}
