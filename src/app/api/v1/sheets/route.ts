export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import {
    getSellerSheetConfig, saveSellerSheetConfig, addTabMapping, removeTabMapping,
    getStockSummary, getAllStockItems, DEFAULT_STATUS_CONFIG, DEFAULT_COLUMN_MAPPING,
    type SellerSheetConfig, type SheetTabMapping
} from '@/lib/google-sheets-sync';

/**
 * Google Sheets Config API for Sellers
 * 
 * GET    — Get seller's sheet config + stock summary
 * POST   — Create/update sheet config
 * PUT    — Add/update tab mapping
 * DELETE — Remove tab mapping
 */

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get('sellerId') || '';
    const view = searchParams.get('view'); // 'stock' for stock items

    if (!sellerId) {
        return NextResponse.json({ success: false, message: 'sellerId required' }, { status: 400 });
    }

    const config = getSellerSheetConfig(sellerId);

    if (view === 'stock') {
        const productId = searchParams.get('productId');
        const items = getAllStockItems(sellerId, productId || undefined);
        return NextResponse.json({
            success: true,
            data: items.map(i => ({
                id: i.id,
                productId: i.productId,
                sheetTab: i.sheetTabName,
                row: i.rowNumber,
                data: i.isPulled ? i.data.substring(0, 20) + '***' : i.data,
                status: i.status,
                isPulled: i.isPulled,
                pulledAt: i.pulledAt,
                orderId: i.orderId,
            })),
        });
    }

    if (!config) {
        return NextResponse.json({
            success: true,
            data: null,
            defaults: {
                statusConfig: DEFAULT_STATUS_CONFIG,
                columnMapping: DEFAULT_COLUMN_MAPPING,
            },
        });
    }

    const summary = getStockSummary(sellerId);

    return NextResponse.json({
        success: true,
        data: {
            ...config,
            stockSummary: summary,
        },
        defaults: {
            statusConfig: DEFAULT_STATUS_CONFIG,
            columnMapping: DEFAULT_COLUMN_MAPPING,
        },
    });
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { sellerId, sellerName, googleSheetUrl, statusConfig, syncIntervalMinutes } = body;

    if (!sellerId || !googleSheetUrl) {
        return NextResponse.json({ success: false, message: 'sellerId and googleSheetUrl required' }, { status: 400 });
    }

    const existing = getSellerSheetConfig(sellerId);
    const config: SellerSheetConfig = {
        sellerId,
        sellerName: sellerName || existing?.sellerName || '',
        googleSheetUrl,
        googleSheetId: '',
        statusConfig: statusConfig || existing?.statusConfig || DEFAULT_STATUS_CONFIG,
        tabMappings: existing?.tabMappings || [],
        isActive: true,
        lastSyncAt: existing?.lastSyncAt,
        lastSyncStatus: existing?.lastSyncStatus,
        syncIntervalMinutes: syncIntervalMinutes || 5,
        createdAt: existing?.createdAt || new Date().toISOString(),
    };

    saveSellerSheetConfig(config);

    return NextResponse.json({
        success: true,
        message: 'Cấu hình Google Sheets đã được lưu',
        data: config,
    });
}

export async function PUT(req: NextRequest) {
    const body = await req.json();
    const { sellerId, mapping } = body;

    if (!sellerId || !mapping?.productId || !mapping?.sheetTabName) {
        return NextResponse.json({
            success: false,
            message: 'sellerId, mapping.productId, mapping.sheetTabName required',
        }, { status: 400 });
    }

    const tabMapping: SheetTabMapping = {
        productId: mapping.productId,
        productName: mapping.productName || '',
        sheetTabName: mapping.sheetTabName,
        columnMapping: mapping.columnMapping || DEFAULT_COLUMN_MAPPING,
    };

    const result = addTabMapping(sellerId, tabMapping);
    if (!result) {
        return NextResponse.json({ success: false, message: 'Seller config not found. Create config first.' }, { status: 404 });
    }

    return NextResponse.json({
        success: true,
        message: `Đã liên kết sản phẩm "${mapping.productName}" → tab "${mapping.sheetTabName}"`,
    });
}

export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get('sellerId') || '';
    const productId = searchParams.get('productId') || '';

    if (!sellerId || !productId) {
        return NextResponse.json({ success: false, message: 'sellerId and productId required' }, { status: 400 });
    }

    const result = removeTabMapping(sellerId, productId);
    if (!result) {
        return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa liên kết' });
}
