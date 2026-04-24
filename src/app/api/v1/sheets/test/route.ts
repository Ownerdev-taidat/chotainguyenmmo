export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

/**
 * Test Google Sheets API connection
 * POST /api/v1/sheets/test
 * Body: { googleSheetUrl: string }
 */
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { googleSheetUrl } = await request.json();

        if (!googleSheetUrl || !googleSheetUrl.includes('docs.google.com/spreadsheets')) {
            return NextResponse.json({ success: false, message: 'URL Google Sheet không hợp lệ' }, { status: 400 });
        }

        // Extract spreadsheet ID
        const match = googleSheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (!match) {
            return NextResponse.json({ success: false, message: 'Không tìm thấy Spreadsheet ID trong URL' }, { status: 400 });
        }

        const spreadsheetId = match[1];
        const apiKey = process.env.GOOGLE_API_KEY;
        const serviceEmail = process.env.GOOGLE_SERVICE_EMAIL;

        // Try to access the spreadsheet via Google Sheets API v4 (public or with API key)
        let sheetCount = 0;
        let sheetNames: string[] = [];

        if (apiKey) {
            // Use API key for public sheets
            const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}&fields=sheets.properties.title`;
            const res = await fetch(apiUrl);
            
            if (res.ok) {
                const data = await res.json();
                sheetNames = data.sheets?.map((s: { properties: { title: string } }) => s.properties.title) || [];
                sheetCount = sheetNames.length;
            } else {
                const errData = await res.json().catch(() => ({}));
                const errMsg = (errData as { error?: { message?: string } })?.error?.message || 'Không thể truy cập';
                return NextResponse.json({
                    success: false,
                    message: `Không thể kết nối Google Sheet: ${errMsg}. Hãy đảm bảo sheet được share công khai hoặc với ${serviceEmail || 'service account'}`,
                }, { status: 400 });
            }
        } else {
            // No API key — just verify URL format is valid
            return NextResponse.json({
                success: false,
                message: 'Google API Key chưa được cấu hình trên server. Liên hệ admin.',
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Kết nối thành công! Tìm thấy ${sheetCount} tabs`,
            data: {
                spreadsheetId,
                sheetCount,
                sheetNames,
            },
        });
    } catch (error) {
        console.error('[Sheets Test] Error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi kiểm tra kết nối' }, { status: 500 });
    }
}
