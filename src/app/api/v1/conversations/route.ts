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

// Helper: find conversation between two users (checking both directions)
async function findConversation(userA: string, userB: string) {
    return prisma.conversation.findFirst({
        where: {
            OR: [
                { participant1: userA, participant2: userB },
                { participant1: userB, participant2: userA },
            ],
        },
    });
}

// GET /api/v1/conversations — List conversations or get messages
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');

    try {
        if (partnerId) {
            // Get messages with a specific partner
            const conv = await findConversation(authResult.userId, partnerId);

            if (!conv) {
                return NextResponse.json({ success: true, data: [], conversationId: null });
            }

            const readStatus = await loadReadStatus();
            const partnerKey = `${conv.id}:${partnerId}`;

            const messages = await prisma.conversationMessage.findMany({
                where: { conversationId: conv.id },
                orderBy: { createdAt: 'asc' },
            });

            const partnerLastRead = readStatus[partnerKey] || '';

            const result = messages.map(m => {
                const isMe = m.senderId === authResult.userId;
                // admin-auto messages count as admin
                const isAdminAuto = m.senderId === 'admin-auto';
                const effectiveIsMe = isMe || (partnerId !== 'admin' && partnerId !== 'admin-auto' && isAdminAuto);

                let status: 'sent' | 'delivered' | 'seen' = 'delivered';
                if (isMe && partnerLastRead && m.id <= partnerLastRead) {
                    status = 'seen';
                }

                let type: 'text' | 'image' = 'text';
                let content = m.content;
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
                    isMe,
                    status,
                };
            });

            return NextResponse.json({ success: true, data: result, conversationId: conv.id });
        }

        // List all conversations
        const readStatus = await loadReadStatus();

        const convos = await prisma.conversation.findMany({
            where: {
                OR: [
                    { participant1: authResult.userId },
                    { participant2: authResult.userId },
                ],
            },
            include: {
                messages: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
            orderBy: { lastMessageAt: 'desc' },
        });

        // Batch load all conversation message counts for unread calculation
        const convoIds = convos.map(c => c.id);
        const allMessages = convoIds.length > 0
            ? await prisma.conversationMessage.findMany({
                where: { conversationId: { in: convoIds } },
                select: { id: true, conversationId: true, senderId: true },
                orderBy: { createdAt: 'asc' },
            })
            : [];

        const partnerIds = convos.map(c =>
            c.participant1 === authResult.userId ? c.participant2 : c.participant1
        ).filter(id => id && id !== 'admin-auto');

        const realUserIds = partnerIds.filter(id => id !== 'admin');
        const users = realUserIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: realUserIds } },
                select: { id: true, fullName: true, username: true, role: true, avatarUrl: true },
            })
            : [];

        const shops = realUserIds.length > 0
            ? await prisma.shop.findMany({
                where: { ownerId: { in: realUserIds } },
                select: { ownerId: true, name: true, logoUrl: true },
            })
            : [];

        const result = convos.map(c => {
            const pid = c.participant1 === authResult.userId ? c.participant2 : c.participant1;
            const isAdmin = pid === 'admin' || pid === 'admin-auto';
            const userInfo = users.find(u => u.id === pid);
            const shopInfo = shops.find(s => s.ownerId === pid);
            const lastMsg = c.messages?.[0];
            let lastContent = lastMsg?.content?.substring(0, 80) || '';
            if (lastContent.startsWith('[IMG]')) lastContent = '📷 Hình ảnh';

            // Calculate unread: count messages from partner after user's last read
            const myKey = `${c.id}:${authResult.userId}`;
            const myLastRead = readStatus[myKey] || '';
            const convoMessages = allMessages.filter(m => m.conversationId === c.id);
            let unread = 0;
            if (myLastRead) {
                // Count messages from partner that have id > myLastRead
                unread = convoMessages.filter(m => m.senderId !== authResult.userId && m.id > myLastRead).length;
            } else {
                // Never read: all messages from partner are unread
                unread = convoMessages.filter(m => m.senderId !== authResult.userId).length;
            }

            return {
                id: c.id,
                partnerId: pid,
                partnerName: isAdmin ? 'ChoTaiNguyen Support' : (shopInfo?.name || userInfo?.fullName || userInfo?.username || pid),
                partnerType: isAdmin ? 'admin' : (shopInfo ? 'shop' : 'user') as 'admin' | 'shop' | 'user',
                partnerAvatar: shopInfo?.logoUrl || userInfo?.avatarUrl || null,
                lastMessage: lastContent,
                lastMessageAt: c.lastMessageAt?.toISOString() || c.updatedAt.toISOString(),
                unread,
            };
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
        console.error('Conversations GET error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

// POST — Send message (supports text and image)
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { partnerId, message, imageUrl } = await request.json();
        if (!partnerId || (!message?.trim() && !imageUrl)) {
            return NextResponse.json({ success: false, message: 'Thiếu thông tin' }, { status: 400 });
        }

        const content = imageUrl ? `[IMG]${imageUrl}` : message.trim();

        // Find or create conversation (always participant1=non-admin for admin conversations)
        let conv = await findConversation(authResult.userId, partnerId);

        if (!conv) {
            // For admin conversations, always set participant1=user, participant2=admin
            const isAdminConv = partnerId === 'admin';
            conv = await prisma.conversation.create({
                data: {
                    participant1: isAdminConv ? authResult.userId : authResult.userId,
                    participant2: partnerId,
                    status: 'ACTIVE',
                    lastMessage: content.substring(0, 80),
                    lastMessageAt: new Date(),
                },
            });
        } else {
            await prisma.conversation.update({
                where: { id: conv.id },
                data: { lastMessage: content.substring(0, 80), lastMessageAt: new Date() },
            });
        }

        const msg = await prisma.conversationMessage.create({
            data: {
                conversationId: conv.id,
                senderId: authResult.userId,
                content,
            },
        });

        // ====== AUTO-REPLY LOGIC ======
        // Check if partner is a seller with auto-reply enabled
        if (partnerId !== 'admin' && partnerId !== 'admin-auto') {
            try {
                // Check if this is the first message in conversation (auto-reply only on first contact)
                const messageCount = await prisma.conversationMessage.count({
                    where: { conversationId: conv.id, senderId: authResult.userId },
                });

                if (messageCount <= 1) {
                    // Check seller auto-reply (stored in Prisma Setting)
                    try {
                        const autoReplyRecord = await prisma.setting.findUnique({ where: { key: 'seller_auto_replies' } });
                        if (autoReplyRecord) {
                            const autoReplies = JSON.parse(autoReplyRecord.value);
                            const autoReply = autoReplies[partnerId];
                            if (autoReply) {
                                await prisma.conversationMessage.create({
                                    data: {
                                        conversationId: conv.id,
                                        senderId: partnerId,
                                        content: autoReply,
                                    },
                                });
                                await prisma.conversation.update({
                                    where: { id: conv.id },
                                    data: { lastMessage: autoReply, lastMessageAt: new Date() },
                                });
                            }
                        }
                    } catch {}
                }
            } catch {}
        }

        return NextResponse.json({
            success: true,
            data: {
                id: msg.id,
                senderId: msg.senderId,
                content: imageUrl || message.trim(),
                type: imageUrl ? 'image' : 'text',
                timestamp: msg.createdAt.toISOString(),
                isMe: true,
                status: 'sent' as const,
            },
        });
    } catch (error: any) {
        console.error('Conversations POST error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

// PATCH — Mark messages as read
export async function PATCH(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { conversationId, lastMessageId } = await request.json();
        if (!conversationId || !lastMessageId) {
            return NextResponse.json({ success: false, message: 'Thiếu thông tin' }, { status: 400 });
        }

        const readStatus = await loadReadStatus();
        readStatus[`${conversationId}:${authResult.userId}`] = lastMessageId;
        await saveReadStatus(readStatus);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
