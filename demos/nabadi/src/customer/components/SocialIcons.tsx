import type { SVGProps } from 'react';

/**
 * Brand social glyphs as inline SVGs, drawn in the same 24×24 / 2px-stroke
 * style as the lucide icons used everywhere else — no icon-lib dependency
 * for brand marks. Decorative by default (aria-hidden); pair with visible
 * text or an aria-label on the wrapping link.
 */
function SocialSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SocialSvg {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </SocialSvg>
  );
}

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SocialSvg {...props}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </SocialSvg>
  );
}
