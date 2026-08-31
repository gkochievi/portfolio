import { Link } from 'react-router-dom';
import { Scissors } from 'lucide-react';
import { Logo } from './Logo';
import { useLandingContent } from '@/features/landing/hooks';

/**
 * Shared photo panel for the auth pages (login / register / forgot / reset).
 *
 * One self-hosted image for all four pages: the CMS hero photo — the same
 * asset the landing page ships — toned with the brand `.photo-warm` filter.
 * No third-party (Unsplash) runtime dependency; when the CMS has no image
 * yet, a brand-safe ink panel with the mark renders instead.
 */
export function AuthAside({ title }: { title: string }) {
  const { data } = useLandingContent();
  const image = data?.hero_image_url || null;

  return (
    <aside className="hidden lg:block relative bg-ink">
      {image ? (
        <img
          src={image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover photo-warm opacity-70"
        />
      ) : (
        <div aria-hidden className="absolute inset-0 flex items-center justify-center text-bg/10">
          <Scissors className="h-24 w-24" />
        </div>
      )}
      <div className="absolute inset-0 bg-ink/40" />
      <div className="relative h-full flex flex-col justify-between p-10 text-bg">
        <Link to="/">
          <Logo size="md" className="text-bg" />
        </Link>
        <p className="font-display font-semibold text-4xl leading-tight max-w-sm tracking-tight">
          {title}.
        </p>
      </div>
    </aside>
  );
}
