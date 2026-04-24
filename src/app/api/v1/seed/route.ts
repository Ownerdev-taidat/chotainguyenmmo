export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

/**
 * Seed API — Creates default categories and admin user if they don't exist
 * GET /api/v1/seed — Run seed (safe to call multiple times)
 */
export async function GET() {
    const results: string[] = [];

    try {
        // Seed categories
        const defaultCategories = [
            { name: 'Tài khoản Premium', slug: 'tai-khoan-premium', icon: '👑', sortOrder: 1 },
            { name: 'Key & License', slug: 'key-license', icon: '🔑', sortOrder: 2 },
            { name: 'Phần mềm', slug: 'phan-mem', icon: '💻', sortOrder: 3 },
            { name: 'Game', slug: 'game', icon: '🎮', sortOrder: 4 },
            { name: 'Hosting & VPS', slug: 'hosting-vps', icon: '🖥️', sortOrder: 5 },
            { name: 'Social Media', slug: 'social-media', icon: '📱', sortOrder: 6 },
            { name: 'Email & Marketing', slug: 'email-marketing', icon: '📧', sortOrder: 7 },
            { name: 'AI & Tools', slug: 'ai-tools', icon: '🤖', sortOrder: 8 },
            { name: 'VPN & Proxy', slug: 'vpn-proxy', icon: '🔒', sortOrder: 9 },
            { name: 'Khác', slug: 'khac', icon: '📦', sortOrder: 10 },
        ];

        for (const cat of defaultCategories) {
            const existing = await prisma.category.findUnique({ where: { slug: cat.slug } });
            if (!existing) {
                await prisma.category.create({
                    data: {
                        name: cat.name,
                        slug: cat.slug,
                        icon: cat.icon,
                        sortOrder: cat.sortOrder,
                        isActive: true,
                    },
                });
                results.push(`✅ Category: ${cat.name}`);
            } else {
                results.push(`⏭️ Category exists: ${cat.name}`);
            }
        }

        // Seed admin user (if not exists)
        const adminExists = await prisma.user.findUnique({ where: { username: 'admin' } });
        if (!adminExists) {
            const admin = await prisma.user.create({
                data: {
                    username: 'admin',
                    email: 'admin@chotainguyen.com',
                    passwordHash: hashPassword('admin123'),
                    fullName: 'Admin CTN',
                    role: 'SUPER_ADMIN',
                    status: 'ACTIVE',
                },
            });
            await prisma.wallet.create({ data: { userId: admin.id } });
            results.push('✅ Admin user created (admin / admin123)');
        } else {
            results.push('⏭️ Admin user exists');
        }

        return NextResponse.json({
            success: true,
            message: `Seed completed: ${results.filter(r => r.startsWith('✅')).length} created, ${results.filter(r => r.startsWith('⏭️')).length} skipped`,
            results,
        });
    } catch (error) {
        console.error('Seed error:', error);
        return NextResponse.json({ success: false, message: 'Seed error', error: String(error) }, { status: 500 });
    }
}
