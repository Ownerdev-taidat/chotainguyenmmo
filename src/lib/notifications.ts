import prisma from '@/lib/prisma';

type NotificationType = 'ORDER' | 'DEPOSIT' | 'DELIVERY' | 'SYSTEM' | 'COMPLAINT' | 'REVIEW' | 'WITHDRAWAL';

/**
 * Create a notification for a user.
 * Call this from any API route when an event happens (order complete, deposit, etc.)
 */
export async function createNotification({
    userId,
    type,
    title,
    message,
    link,
}: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
}) {
    try {
        await prisma.notification.create({
            data: { userId, type, title, message, link },
        });
    } catch (error) {
        console.error('Failed to create notification:', error);
    }
}

/**
 * Create notification when a deposit is confirmed
 */
export async function notifyDepositSuccess(userId: string, amount: number) {
    const formatted = new Intl.NumberFormat('vi-VN').format(amount);
    await createNotification({
        userId,
        type: 'DEPOSIT',
        title: 'Nạp tiền thành công',
        message: `Yêu cầu nạp ${formatted}đ đã được xác nhận và cộng vào ví.`,
        link: '/dashboard/nap-tien',
    });
}

/**
 * Create notification when an order is completed
 */
export async function notifyOrderCompleted(userId: string, orderCode: string) {
    await createNotification({
        userId,
        type: 'ORDER',
        title: 'Đơn hàng đã hoàn tất',
        message: `Đơn hàng ${orderCode} đã được giao thành công.`,
        link: '/dashboard/don-hang',
    });
}

/**
 * Create notification when auto-delivery happens
 */
export async function notifyAutoDelivery(userId: string, orderCode: string) {
    await createNotification({
        userId,
        type: 'DELIVERY',
        title: 'Giao hàng tự động',
        message: `Đơn hàng ${orderCode} đã được giao tự động. Kiểm tra sản phẩm ngay.`,
        link: '/dashboard/don-hang',
    });
}

/**
 * Create notification for a new complaint
 */
export async function notifyNewComplaint(userId: string, orderCode: string) {
    await createNotification({
        userId,
        type: 'COMPLAINT',
        title: 'Khiếu nại mới',
        message: `Có khiếu nại mới cần xử lý cho đơn hàng ${orderCode}.`,
        link: '/dashboard/khieu-nai',
    });
}

/**
 * Create notification for a new review
 */
export async function notifyNewReview(sellerId: string, productName: string, rating: number) {
    await createNotification({
        userId: sellerId,
        type: 'REVIEW',
        title: 'Đánh giá mới',
        message: `Sản phẩm "${productName}" nhận được đánh giá ${rating} sao.`,
        link: '/seller',
    });
}

/**
 * Create notification for withdrawal
 */
export async function notifyWithdrawalProcessed(userId: string, amount: number, status: 'approved' | 'rejected') {
    const formatted = new Intl.NumberFormat('vi-VN').format(amount);
    await createNotification({
        userId,
        type: 'WITHDRAWAL',
        title: status === 'approved' ? 'Rút tiền thành công' : 'Yêu cầu rút tiền bị từ chối',
        message: status === 'approved'
            ? `Yêu cầu rút ${formatted}đ đã được duyệt và chuyển vào tài khoản ngân hàng.`
            : `Yêu cầu rút ${formatted}đ đã bị từ chối. Vui lòng liên hệ hỗ trợ.`,
        link: '/dashboard',
    });
}

/**
 * System-wide notification (e.g. maintenance, updates)
 */
export async function notifySystem(userId: string, title: string, message: string) {
    await createNotification({
        userId,
        type: 'SYSTEM',
        title,
        message,
    });
}
