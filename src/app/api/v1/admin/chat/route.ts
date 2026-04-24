export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Read status helpers using Prisma Setting model
async function loadReadStatus(): Promise<Record<string, string>> {
    try {
        const record = await prisma.setting.findUnique({ where: { key: 'message_read_status' } });
        if (record) return JSON.parse(record.value);
    } catch {}
    return {};
}

async function saveReadStatus(data: Record<string, string>) {
    try {
        await prisma.setting.upsert({
            where: { key: 'message_read_status' },
            update: { value: JSON.stringify(data) },
            create: { key: 'message_read_status', value: JSON.stringify(data), type: 'json', group: 'chat' },
        });
    } catch (e) { console.error('saveReadStatus error:', e); }
}
// Helper: find conversation between two users (both directions)
async function findConv(userA: string, userB: string) {
    return prisma.conversation.findFirst({
        where: {
            OR: [
                { participant1: userA, participant2: userB },
                { participant1: userB, participant2: userA },
            ],
        },
    });
}

// GET /api/v1/admin/chat?list=true — List all users for admin
// GET /api/v1/admin/chat?userId=xxx — Get messages with specific user
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const listMode = searchParams.get('list');
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(authResult.role || '');

    try {
        // Admin: List all users
        if (listMode === 'true' && isAdmin) {
            const dbUsers = await prisma.user.findMany({
                where: { role: { not: 'SUPER_ADMIN' } },
                select: { id: true, username: true, fullName: true, role: true, avatarUrl: true },
                orderBy: { createdAt: 'desc' },
            });

            // Fetch shop data for all users (any user might own a shop)
            const allUserIds = dbUsers.map(u => u.id);
            const shops = allUserIds.length > 0
                ? await prisma.shop.findMany({
                    where: { ownerId: { in: allUserIds } },
                    select: { ownerId: true, name: true, logoUrl: true },
                })
                : [];

            // Get all conversations where admin is involved
            let conversations: any[] = [];
            try {
                conversations = await prisma.conversation.findMany({
                    where: {
                        OR: [
                            { participant2: 'admin' },
                            { participant1: 'admin' },
                        ],
                    },
                    include: {
                        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
                    },
                });
            } catch {}

            // Count unread messages per conversation using read status
            const readStatus = await loadReadStatus();
            const convoIds = conversations.map(c => c.id);
            const allMessages = convoIds.length > 0
                ? await prisma.conversationMessage.findMany({
                    where: { conversationId: { in: convoIds }, senderId: { notIn: ['admin', 'admin-auto'] } },
                    select: { id: true, conversationId: true },
                })
                : [];

            const chatUsers = dbUsers.map(user => {
                const conv = conversations.find(c =>
                    (c.participant1 === user.id && c.participant2 === 'admin') ||
                    (c.participant2 === user.id && c.participant1 === 'admin')
                );
                const lastMsg = conv?.messages?.[0];
                let lastContent = lastMsg?.content || '';
                if (lastContent.startsWith('[IMG]')) lastContent = '📷 Hình ảnh';

                const shopInfo = shops.find(s => s.ownerId === user.id);
                // Count unread: messages from user after admin's last read
                let unread = 0;
                if (conv) {
                    const adminReadKey = `${conv.id}:admin`;
                    const adminLastRead = readStatus[adminReadKey] || '';
                    const convoMsgs = allMessages.filter(m => m.conversationId === conv.id);
                    if (adminLastRead) {
                        unread = convoMsgs.filter(m => m.id > adminLastRead).length;
                    } else {
                        unread = convoMsgs.length;
                    }
                }

                return {
                    id: user.id,
                    conversationId: conv?.id || null,
                    username: user.username,
                    fullName: user.fullName,
                    role: user.role,
                    avatarUrl: shopInfo?.logoUrl || user.avatarUrl || null,
                    shopName: shopInfo?.name || null,
                    lastMessage: lastContent,
                    lastTime: lastMsg?.createdAt?.toISOString() || '',
                    unread,
                };
            });

            // Sort: users with messages first, then rest
            chatUsers.sort((a, b) => {
                if (a.lastTime && !b.lastTime) return -1;
                if (!a.lastTime && b.lastTime) return 1;
                if (a.lastTime && b.lastTime) return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime();
                return (a.fullName || '').localeCompare(b.fullName || '');
            });

            return NextResponse.json({ success: true, data: chatUsers });
        }

        // Admin: Get messages with specific user
        if (userId && isAdmin) {
            // Find conversation in both directions
            const conv = await findConv(userId, 'admin');
            if (!conv) return NextResponse.json({ success: true, data: [] });

            const messages = await prisma.conversationMessage.findMany({
                where: { conversationId: conv.id },
                orderBy: { createdAt: 'asc' },
            });

            // Auto-mark as read for admin
            if (messages.length > 0) {
                const lastMsg = messages[messages.length - 1];
                const readStatus = await loadReadStatus();
                readStatus[`${conv.id}:admin`] = lastMsg.id;
                await saveReadStatus(readStatus);
            }

            return NextResponse.json({
                success: true,
                data: messages.map(m => {
                    let content = m.content;
                    let type = 'text';
                    if (content.startsWith('[IMG]')) {
                        type = 'image';
                        content = content.substring(5);
                    }
                    return {
                        id: m.id,
                        senderId: m.senderId,
                        content,
                        type,
                        timestamp: m.createdAt.toISOString(),
                        isAdmin: m.senderId !== userId,
                    };
                }),
            });
        }

        // Non-admin: Get own messages with admin
        if (!isAdmin) {
            const conv = await findConv(authResult.userId, 'admin');
            if (!conv) return NextResponse.json({ success: true, data: [] });

            const messages = await prisma.conversationMessage.findMany({
                where: { conversationId: conv.id },
                orderBy: { createdAt: 'asc' },
            });

            return NextResponse.json({
                success: true,
                data: messages.map(m => ({
                    id: m.id,
                    senderId: m.senderId,
                    content: m.content,
                    timestamp: m.createdAt.toISOString(),
                    isAdmin: m.senderId !== authResult.userId,
                })),
            });
        }

        return NextResponse.json({ success: false, message: 'Missing params' }, { status: 400 });
    } catch (error: any) {
        console.error('Chat GET error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

// POST — Admin sends message to user, or user sends to admin
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { userId, message, imageUrl } = await request.json();
        const content = imageUrl ? `[IMG]${imageUrl}` : message?.trim();
        if (!content) {
            return NextResponse.json({ success: false, message: 'Tin nhắn trống' }, { status: 400 });
        }

        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(authResult.role || '');
        const targetUserId = isAdmin ? userId : authResult.userId;
        if (!targetUserId) {
            return NextResponse.json({ success: false, message: 'Missing userId' }, { status: 400 });
        }

        // Find or create conversation (both directions)
        let conv = await findConv(targetUserId, 'admin');

        if (!conv) {
            conv = await prisma.conversation.create({
                data: {
                    participant1: targetUserId,
                    participant2: 'admin',
                    status: 'ACTIVE',
                    lastMessage: content.substring(0, 80),
                    lastMessageAt: new Date(),
                },
            });
        }

        const newMsg = await prisma.conversationMessage.create({
            data: {
                conversationId: conv.id,
                senderId: authResult.userId,
                content,
            },
        });

        await prisma.conversation.update({
            where: { id: conv.id },
            data: { lastMessage: content.substring(0, 80), lastMessageAt: new Date() },
        });

        // Auto-reply for non-admin users
        if (!isAdmin) {
            try {
                let autoReplyText: string | null = null;
                try {
                    const setting = await (prisma as any).systemSetting?.findUnique?.({
                        where: { key: 'auto_reply_message' },
                    });
                    autoReplyText = setting?.value || null;
                } catch {}

                if (!autoReplyText) {
                    autoReplyText = process.env.AUTO_REPLY_MESSAGE || null;
                }

                if (autoReplyText) {
                    await prisma.conversationMessage.create({
                        data: {
                            conversationId: conv.id,
                            senderId: 'admin-auto',
                            content: autoReplyText,
                        },
                    });
                    await prisma.conversation.update({
                        where: { id: conv.id },
                        data: { lastMessage: autoReplyText, lastMessageAt: new Date() },
                    });
                }
            } catch {}
        }

        return NextResponse.json({
            success: true,
            data: {
                id: newMsg.id,
                senderId: newMsg.senderId,
                content: imageUrl || message?.trim(),
                type: imageUrl ? 'image' : 'text',
                timestamp: newMsg.createdAt.toISOString(),
                isAdmin,
            },
        });
    } catch (error: any) {
        console.error('Chat POST error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
