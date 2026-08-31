/**
 * Curated icon set for services. Used as a fallback when a service has no
 * uploaded image. Inline SVGs (24x24, stroke-based) so we don't need to ship
 * a font or an extra icon dependency. Both Vite apps carry an identical copy.
 *
 * Note: this file only exports the registry + a small lookup helper, not the
 * raw icon components. The Vite/React fast-refresh rule requires modules to
 * either export only components OR export only non-component values; the
 * registry is a non-component value so we keep it isolated here.
 */
import type { ComponentType, ReactNode, SVGProps } from 'react';

const baseProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function makeIcon(children: ReactNode): ComponentType<SVGProps<SVGSVGElement>> {
  return function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg {...baseProps} {...props}>
        {children}
      </svg>
    );
  };
}

export interface ServiceIconDef {
  key: string;
  /** Translation key under services.* — falls back to fallbackLabel */
  labelKey: string;
  fallbackLabel: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const SERVICE_ICONS: ServiceIconDef[] = [
  {
    key: 'scissors',
    labelKey: 'icon_scissors',
    fallbackLabel: 'Scissors',
    Icon: makeIcon(
      <>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="6" cy="18" r="2.5" />
        <path d="M8 7.5 20 18M8 16.5 20 6" />
      </>,
    ),
  },
  {
    key: 'comb',
    labelKey: 'icon_comb',
    fallbackLabel: 'Comb',
    Icon: makeIcon(
      <>
        <path d="M3 8h18v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M7 13v3M11 13v4M15 13v3M19 13v2" />
      </>,
    ),
  },
  {
    key: 'razor',
    labelKey: 'icon_razor',
    fallbackLabel: 'Razor',
    Icon: makeIcon(
      <>
        <rect x="13" y="2" width="6" height="3.5" rx="1" />
        <path d="M14 5.5h4l-1.2 5H15.2z" />
        <path d="M16 10.5l-9.5 9.5a2.1 2.1 0 0 1-3-3z" />
      </>,
    ),
  },
  {
    key: 'clipper',
    labelKey: 'icon_clipper',
    fallbackLabel: 'Clipper',
    Icon: makeIcon(
      <>
        <path d="M3 4h11v6H3z" />
        <path d="M5 10v2h7v-2" />
        <path d="M14 7h6v3h-6z" />
        <path d="M9 12v8" />
        <path d="M5 20h8" />
      </>,
    ),
  },
  {
    key: 'beard',
    labelKey: 'icon_beard',
    fallbackLabel: 'Beard',
    Icon: makeIcon(
      <>
        <circle cx="12" cy="9" r="3.2" />
        <path d="M7.5 11c-.6 3 1 6 4.5 9 3.5-3 5.1-6 4.5-9" />
        <path d="M10 9.6c.6.4 1.3.6 2 .6s1.4-.2 2-.6" />
      </>,
    ),
  },
  {
    key: 'mustache',
    labelKey: 'icon_mustache',
    fallbackLabel: 'Mustache',
    Icon: makeIcon(
      <>
        <path d="M3 12c2-3 5-3 6.5-1.2.9 1.1 2.1 1.1 3 0C14 9 17 9 19 12" />
        <path d="M12 12v3" />
        <path d="M9.5 14h5" />
      </>,
    ),
  },
  {
    key: 'nail',
    labelKey: 'icon_nail',
    fallbackLabel: 'Nail',
    Icon: makeIcon(
      <>
        <path d="M9 4h6l-1 4H10z" />
        <path d="M9.5 8h5l-.7 7H10.2z" />
        <path d="M11 15h2v5h-2z" />
      </>,
    ),
  },
  {
    key: 'spa',
    labelKey: 'icon_spa',
    fallbackLabel: 'Spa',
    Icon: makeIcon(
      <>
        <path d="M12 4c2.5 3 2.5 6 0 9-2.5-3-2.5-6 0-9z" />
        <path d="M5 10c3-1 5.5 0 7 3-3 1-5.5 0-7-3z" />
        <path d="M19 10c-3-1-5.5 0-7 3 3 1 5.5 0 7-3z" />
        <path d="M12 13v7" />
      </>,
    ),
  },
  {
    key: 'wash',
    labelKey: 'icon_wash',
    fallbackLabel: 'Wash',
    Icon: makeIcon(
      <>
        <path d="M12 3c2.5 3 4 5 4 7a4 4 0 0 1-8 0c0-2 1.5-4 4-7z" />
        <path d="M5 18c1.5-1 2.5 1 4 0s2.5 1 4 0 2.5 1 4 0v3H5z" />
      </>,
    ),
  },
  {
    key: 'chair',
    labelKey: 'icon_chair',
    fallbackLabel: 'Salon',
    Icon: makeIcon(
      <>
        <path d="M7 4h10v6H7z" />
        <path d="M5 10h14v3H5z" />
        <path d="M7 13v6M17 13v6" />
        <path d="M10 19h4" />
      </>,
    ),
  },
  {
    key: 'mirror',
    labelKey: 'icon_mirror',
    fallbackLabel: 'Mirror',
    Icon: makeIcon(
      <>
        <ellipse cx="12" cy="9" rx="6" ry="6" />
        <path d="M12 15v5" />
        <path d="M9 20h6" />
        <path d="M9 8a3 3 0 0 1 3-3" />
      </>,
    ),
  },
  {
    key: 'kids',
    labelKey: 'icon_kids',
    fallbackLabel: 'Kids',
    Icon: makeIcon(
      <>
        <circle cx="12" cy="11" r="4" />
        <path d="M5 5h14a0 0 0 0 1 0 0c-1 2-3.5 3-7 3s-6-1-7-3z" />
        <path d="M7 18c1-2 3-3 5-3s4 1 5 3" />
      </>,
    ),
  },
];

export const SERVICE_ICON_BY_KEY = new Map(SERVICE_ICONS.map((i) => [i.key, i]));

export function getServiceIcon(
  key: string | null | undefined,
): ComponentType<SVGProps<SVGSVGElement>> | null {
  if (!key) return null;
  return SERVICE_ICON_BY_KEY.get(key)?.Icon ?? null;
}
