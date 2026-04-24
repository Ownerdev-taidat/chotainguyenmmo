export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/v1/categories — Public category listing
export async function GET() {
    try {
        const categories = await prisma.category.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
                children: {
                    where: { isActive: true },
                    orderBy: { sortOrder: 'asc' },
                },
                _count: { select: { products: { where: { status: 'ACTIVE' } } } },
            },
        });

        // Map to include productCount + feePercent
        const data = categories.map(c => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            icon: c.icon,
            description: c.description,
            feePercent: c.feePercent,
            productCount: c._count.products,
            children: c.children,
        }));

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('List categories error:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi hệ thống', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}

// POST /api/v1/categories — Create category (admin only)
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(authResult.role)) {
        return NextResponse.json({ success: false, message: 'Không có quyền' }, { status: 403 });
    }

    try {
        const { name, slug, description, icon, feePercent } = await request.json();
        if (!name?.trim()) {
            return NextResponse.json({ success: false, message: 'Tên danh mục không được trống' }, { status: 400 });
        }

        const finalSlug = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        // Check duplicate slug
        const existing = await prisma.category.findUnique({ where: { slug: finalSlug } });
        if (existing) {
            return NextResponse.json({ success: false, message: 'Slug đã tồn tại' }, { status: 409 });
        }

        const cat = await prisma.category.create({
            data: {
                name: name.trim(),
                slug: finalSlug,
                description: description || null,
                icon: icon || null,
                feePercent: feePercent !== undefined && feePercent !== null ? Number(feePercent) : null,
            },
        });

        return NextResponse.json({ success: true, data: cat }, { status: 201 });
    } catch (error) {
        console.error('Create category error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi tạo danh mục' }, { status: 500 });
    }
}

// PUT /api/v1/categories — Update category (admin only)
export async function PUT(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(authResult.role)) {
        return NextResponse.json({ success: false, message: 'Không có quyền' }, { status: 403 });
    }

    try {
        const { id, name, slug, description, icon, feePercent } = await request.json();
        if (!id) {
            return NextResponse.json({ success: false, message: 'Thiếu ID danh mục' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name.trim();
        if (slug !== undefined) updateData.slug = slug;
        if (description !== undefined) updateData.description = description || null;
        if (icon !== undefined) updateData.icon = icon || null;
        if (feePercent !== undefined) {
            updateData.feePercent = feePercent === null || feePercent === '' ? null : Number(feePercent);
        }

        const cat = await prisma.category.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({ success: true, data: cat });
    } catch (error) {
        console.error('Update category error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi cập nhật danh mục' }, { status: 500 });
    }
}

// DELETE /api/v1/categories — Delete category (admin only)
export async function DELETE(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(authResult.role)) {
        return NextResponse.json({ success: false, message: 'Không có quyền' }, { status: 403 });
    }

    try {
        const { id } = await request.json();
        if (!id) {
            return NextResponse.json({ success: false, message: 'Thiếu ID danh mục' }, { status: 400 });
        }

        // Check if category has products
        const productCount = await prisma.product.count({ where: { categoryId: id } });
        if (productCount > 0) {
            return NextResponse.json({ success: false, message: `Không thể xóa — danh mục có ${productCount} sản phẩm` }, { status: 400 });
        }

        await prisma.category.delete({ where: { id } });
        return NextResponse.json({ success: true, message: 'Đã xóa danh mục' });
    } catch (error) {
        console.error('Delete category error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi xóa danh mục' }, { status: 500 });
    }
}
