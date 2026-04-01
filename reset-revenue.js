const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
    const s = await p.shop.findFirst({ where: { name: { contains: 'Shop MMO' } } });
    if (!s) { console.log('Ko tim thay shop'); return; }
    console.log('Shop:', s.name);
    const orderIds = (await p.order.findMany({ where: { shopId: s.id }, select: { id: true } })).map(o => o.id);
    console.log('Orders:', orderIds.length);
    if (orderIds.length === 0) { console.log('Khong co don'); return; }
    
    // Delete ALL related records (all FK constraints)
    await p.invoice.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {});
    await p.delivery.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {});
    await p.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {});
    
    // Try raw SQL if prisma still fails
    try {
        await p.order.deleteMany({ where: { id: { in: orderIds } } });
    } catch (e) {
        console.log('Prisma failed, trying raw SQL...');
        for (const id of orderIds) {
            await p.$executeRawUnsafe(`DELETE FROM "Invoice" WHERE "orderId" = '${id}'`).catch(() => {});
            await p.$executeRawUnsafe(`DELETE FROM "Delivery" WHERE "orderId" = '${id}'`).catch(() => {});
            await p.$executeRawUnsafe(`DELETE FROM "OrderItem" WHERE "orderId" = '${id}'`).catch(() => {});
            await p.$executeRawUnsafe(`DELETE FROM "Notification" WHERE "orderId" = '${id}'`).catch(() => {});
            await p.$executeRawUnsafe(`DELETE FROM "Order" WHERE "id" = '${id}'`).catch(() => {});
        }
    }
    
    await p.product.updateMany({ where: { shopId: s.id }, data: { soldCount: 0 } });
    console.log('Da xoa', orderIds.length, 'don hang. Doanh thu = 0!');
})().finally(() => p.$disconnect());
