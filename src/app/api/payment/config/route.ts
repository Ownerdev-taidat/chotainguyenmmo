import { NextRequest, NextResponse } from 'next/server';

// GET: Read current payment gateway config from env
export async function GET() {
    try {
        const config = {
            apicanhanKey: process.env.MBBANK_API_KEY || '',
            apicanhanUser: process.env.MBBANK_USERNAME || '',
            apicanhanPass: process.env.MBBANK_PASSWORD || '',
            apicanhanAccount: process.env.MBBANK_ACCOUNT || '',
            accountNo: process.env.MBBANK_ACCOUNT || '',
            accountOwner: process.env.MBBANK_OWNER_NAME || 'NGUYEN TAI DAT',
            botToken: process.env.TELEGRAM_BOT_TOKEN || '',
            chat_id: process.env.TELEGRAM_CHAT_ID || '',
        };

        // Mask sensitive fields for display
        const masked = {
            ...config,
            apicanhanKey: config.apicanhanKey ? config.apicanhanKey.substring(0, 8) + '****' : '(chưa cấu hình)',
            apicanhanPass: config.apicanhanPass ? '****' : '(chưa cấu hình)',
            botToken: config.botToken ? config.botToken.substring(0, 10) + '****' : '(chưa cấu hình)',
        };

        return NextResponse.json({
            status: 'success',
            config: masked,
            rawKeys: Object.keys(config),
            note: 'Config is read from Railway environment variables. Update in Railway → Service → Variables.',
        });
    } catch (error: any) {
        return NextResponse.json({ error: 'Config error: ' + error.message }, { status: 500 });
    }
}

// PUT: Cannot update env vars at runtime — show instructions
export async function PUT(req: NextRequest) {
    return NextResponse.json({
        status: 'info',
        message: 'Trên Railway, cấu hình được lưu trong Environment Variables. Vui lòng vào Railway → Service → Variables để cập nhật.',
        instructions: [
            'Vào Railway Dashboard → chọn service → tab Variables',
            'Thêm/sửa: MBBANK_API_KEY, MBBANK_USERNAME, MBBANK_PASSWORD, MBBANK_ACCOUNT',
            'Thêm/sửa: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID',
            'Railway sẽ tự redeploy sau khi save',
        ],
    });
}
