// ============================================================
// MOCK DATA - ChoTaiNguyen Marketplace
// ============================================================

export interface Category {
    id: string;
    name: string;
    slug: string;
    icon: string;
    description: string;
    productCount: number;
    subcategories: { id: string; name: string; slug: string }[];
}

export interface Product {
    id: string;
    name: string;
    slug: string;
    shortDescription: string;
    description: string;
    price: number;
    compareAtPrice?: number;
    categoryId: string;
    categoryName: string;
    shopId: string;
    shopName: string;
    sellerId?: string;
    shopVerified: boolean;
    images: string[];
    status: string;
    deliveryType: 'auto' | 'manual';
    stockCount: number;
    soldCount: number;
    ratingAverage: number;
    ratingCount: number;
    isFeatured: boolean;
    isHot: boolean;
    badges: string[];
    complaintWindowHours: number;
    warrantyPolicy: string;
    supportPolicy: string;
    createdAt: string;
    updatedAt: string;
}

export interface Shop {
    id: string;
    name: string;
    slug: string;
    logoUrl: string;
    bannerUrl: string;
    shortDescription: string;
    description: string;
    verified: boolean;
    status: string;
    responseRate: number;
    ratingAverage: number;
    ratingCount: number;
    successfulOrdersCount: number;
    productCount: number;
    joinedAt: string;
}

export interface Review {
    id: string;
    productId: string;
    productName: string;
    shopId: string;
    buyerName: string;
    buyerAvatar: string;
    rating: number;
    content: string;
    createdAt: string;
    verified: boolean;
}

export interface Order {
    id: string;
    orderCode: string;
    productName: string;
    shopName: string;
    quantity: number;
    totalAmount: number;
    status: string;
    paymentStatus: string;
    deliveryType: string;
    createdAt: string;
}

export interface Transaction {
    id: string;
    type: string;
    direction: string;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
}

export interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

export interface Banner {
    id: string;
    title: string;
    subtitle: string;
    imageUrl: string;
    link: string;
}

// ============================================================
// CATEGORIES
// ============================================================
export const categories: Category[] = [
    {
        id: 'cat-1',
        name: 'Tài khoản',
        slug: 'tai-khoan',
        icon: 'UserCircle',
        description: 'Tài khoản premium các nền tảng',
        productCount: 0,
        subcategories: [
            { id: 'sub-1-1', name: 'Email', slug: 'email' },
            { id: 'sub-1-2', name: 'Mạng xã hội', slug: 'mang-xa-hoi' },
            { id: 'sub-1-3', name: 'AI', slug: 'ai' },
        ],
    },
    {
        id: 'cat-2',
        name: 'Phần mềm',
        slug: 'phan-mem',
        icon: 'AppWindow',
        description: 'Key bản quyền, license phần mềm',
        productCount: 0,
        subcategories: [
            { id: 'sub-2-1', name: 'Thiết kế', slug: 'thiet-ke' },
            { id: 'sub-2-2', name: 'Văn phòng', slug: 'van-phong' },
        ],
    },
    {
        id: 'cat-3',
        name: 'AI Tools',
        slug: 'ai-tools',
        icon: 'Brain',
        description: 'Công cụ AI, API key, credits',
        productCount: 0,
        subcategories: [],
    },
    {
        id: 'cat-4',
        name: 'Email',
        slug: 'email',
        icon: 'Mail',
        description: 'Tài khoản email, SMTP, hosting',
        productCount: 0,
        subcategories: [],
    },
    {
        id: 'cat-5',
        name: 'Mạng xã hội',
        slug: 'mang-xa-hoi',
        icon: 'Share2',
        description: 'Tài khoản social, followers, tương tác',
        productCount: 0,
        subcategories: [],
    },
    {
        id: 'cat-6',
        name: 'Proxy & Công cụ',
        slug: 'proxy-cong-cu',
        icon: 'Globe',
        description: 'Proxy, VPN, automation tools',
        productCount: 0,
        subcategories: [
            { id: 'sub-6-1', name: 'Proxy', slug: 'proxy' },
            { id: 'sub-6-2', name: 'Automation', slug: 'automation' },
        ],
    },
    {
        id: 'cat-7',
        name: 'Dịch vụ số',
        slug: 'dich-vu-so',
        icon: 'Layers',
        description: 'Hosting, domain, dịch vụ cloud',
        productCount: 0,
        subcategories: [],
    },
    {
        id: 'cat-8',
        name: 'Khác',
        slug: 'khac',
        icon: 'MoreHorizontal',
        description: 'Tài nguyên số khác',
        productCount: 0,
        subcategories: [],
    },
];

// ============================================================
// SHOPS
// ============================================================
export const shops: Shop[] = [];

// ============================================================
// PRODUCTS
// ============================================================
export const products: Product[] = [];

// ============================================================
// REVIEWS
// ============================================================
export const reviews: Review[] = [];

// ============================================================
// SAMPLE USER DATA
// ============================================================
export const sampleOrders: Order[] = [];

export const sampleTransactions: Transaction[] = [];

export const sampleNotifications: Notification[] = [];

export const banners: Banner[] = [
    { id: 'banner-1', title: 'Khám phá chợ tài nguyên số hiện đại', subtitle: 'Tìm kiếm sản phẩm nhanh hơn, theo dõi giao dịch dễ hơn và quản lý mọi thứ trên một nền tảng duy nhất.', imageUrl: '/banners/banner1.png', link: '/danh-muc/ai-tools' },
    { id: 'banner-2', title: 'Dành cho người bán muốn vận hành gọn hơn', subtitle: 'Tạo shop, quản lý tồn kho, theo dõi doanh thu và xử lý đơn hàng trong Seller Center.', imageUrl: '/banners/banner2.png', link: '/seller' },
    { id: 'banner-3', title: 'Tập trung mọi giao dịch vào một hệ thống rõ ràng', subtitle: 'Ví nội bộ, thông báo, lịch sử đơn hàng và quy trình hỗ trợ được hiển thị minh bạch.', imageUrl: '/banners/banner3.png', link: '/huong-dan' },
];

// ============================================================
// SELLER DASHBOARD DATA
// ============================================================
export const sellerDashboardData = {
    revenueToday: 0,
    revenueMonth: 0,
    newOrders: 0,
    pendingWithdrawal: 0,
    activeProducts: 0,
    openComplaints: 0,
    revenueChart: [] as { date: string; revenue: number; orders: number }[],
};

// ============================================================
// ADMIN DASHBOARD DATA
// ============================================================
export const adminDashboardData = {
    totalUsers: 0,
    totalShops: 0,
    totalRevenue: 0,
    ordersToday: 0,
    openComplaints: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    revenueChart: [] as { month: string; revenue: number }[],
};
