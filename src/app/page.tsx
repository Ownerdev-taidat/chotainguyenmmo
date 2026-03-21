import { cookies } from 'next/headers';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/home/HeroSection';

import FeaturedProducts from '@/components/home/FeaturedProducts';
import BenefitsSection from '@/components/home/BenefitsSection';
import StepsSection from '@/components/home/StepsSection';
import TestimonialsSection from '@/components/home/TestimonialsSection';
import CTASection from '@/components/home/CTASection';
import SponsoredSidebar from '@/components/shared/SponsoredSidebar';

export default async function HomePage() {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get('logged_in')?.value === '1';

    return (
        <>
            <Header />
            <main>
                <HeroSection isLoggedIn={isLoggedIn} />

                <SponsoredSidebar />
                <div id="san-pham-noi-bat">
                    <FeaturedProducts />
                </div>
                <BenefitsSection />
                <StepsSection />
                <TestimonialsSection />
                <CTASection />
            </main>
            <Footer />
        </>
    );
}
