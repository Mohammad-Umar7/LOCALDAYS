import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ScrollToTop } from './components/layout/AppShell';
import { PageTitle } from './components/layout/PageTitle';

const Home = lazy(() => import('./pages/Home'));
const Explore = lazy(() => import('./pages/Explore'));
const ProviderPage = lazy(() => import('./pages/Provider'));
const Storefront = lazy(() => import('./pages/Storefront'));
const Booking = lazy(() => import('./pages/Booking'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Confirmation = lazy(() => import('./pages/Confirmation'));
const Account = lazy(() => import('./pages/Account'));
const Passport = lazy(() => import('./pages/Passport'));
const Composer = lazy(() => import('./pages/Composer'));
const Host = lazy(() => import('./pages/host/Host'));
const Impact = lazy(() => import('./pages/Impact'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorks'));
const ForHosts = lazy(() => import('./pages/ForHosts'));
const NotFound = lazy(() => import('./pages/NotFound'));
const DevScene = lazy(() => import('./pages/DevScene'));

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink/10 border-t-clay-500" />
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <PageTitle />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/experiences" element={<Explore />} />
          <Route path="/c/:categoryId" element={<Explore />} />
          <Route path="/p/:slug" element={<ProviderPage />} />
          <Route path="/p/:slug/shop" element={<Storefront />} />
          <Route path="/book/:experienceId" element={<Booking />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/confirmation/:ref" element={<Confirmation />} />
          <Route path="/me" element={<Account />} />
          <Route path="/me/:tab" element={<Account />} />
          <Route path="/passport" element={<Passport />} />
          <Route path="/compose" element={<Composer />} />
          <Route path="/host" element={<Host />} />
          <Route path="/host/:section" element={<Host />} />
          <Route path="/impact" element={<Impact />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/hosts" element={<ForHosts />} />
          <Route path="/dev/scene/:id" element={<DevScene />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}
