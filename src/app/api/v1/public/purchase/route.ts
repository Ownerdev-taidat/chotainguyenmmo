export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Public API — Purchase
 * ⚠️ DISABLED — Route này đã bị tắt vì bypass phí sàn (feeAmount).
 * Vui lòng sử dụng route chính /api/v1/orders để mua hàng.
 * 
 * Nếu cần mở lại, phải thêm logic tính phí sàn giống /api/v1/orders/route.ts
 */
export async function POST(req: NextRequest) {
    return NextResponse.json({
        success: false,
        message: 'Route này đã bị tắt. Vui lòng sử dụng giao diện website hoặc /api/v1/orders để mua hàng.',
        errorCode: 'ROUTE_DISABLED',
    }, { status: 410 });
}

