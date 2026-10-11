import { AppShell } from '@/components/layout/AppShell';
import { Hero } from '@/components/home/Hero';
import {
  CategoriesSection,
  ComposerTeaser,
  FeaturedExperiences,
  HowItWorks,
  ImmersiveFarm,
  PassportPreview,
  ProductsSection,
  SupportLocal,
  ThisWeekend,
} from '@/components/home/Sections';

export default function Home() {
  return (
    <AppShell overlay>
      <Hero />
      <CategoriesSection />
      <FeaturedExperiences />
      <ComposerTeaser />
      <HowItWorks />
      <ImmersiveFarm />
      <ThisWeekend />
      <ProductsSection />
      <PassportPreview />
      <SupportLocal />
    </AppShell>
  );
}
