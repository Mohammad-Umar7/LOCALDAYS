import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <AppShell>
      <section className="shell flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <div className="font-arabic text-[64px] leading-none text-sand-300">تائه؟</div>
        <h1 className="display-md mt-6">This path leads into the dunes.</h1>
        <p className="mt-3 max-w-md text-[15px] text-ink-2">The page you were looking for doesn’t exist — but plenty of real experiences do.</p>
        <div className="mt-8 flex gap-3">
          <Button to="/">Back home</Button>
          <Button to="/experiences" variant="outline">
            Explore experiences
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
