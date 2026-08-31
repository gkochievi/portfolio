import React from 'react';

/**
 * <img>-with-WebP-fallback wrapper. Renders a <picture> when `webpSrc` is
 * provided so modern browsers grab the smaller payload; otherwise it
 * collapses to a plain <img>.
 *
 * Defaults to loading="lazy" + decoding="async" because every place we
 * currently use this is below the hero — flip them off explicitly for
 * the rare above-the-fold case.
 *
 * All other props (alt, style, className, width, height, ...) are
 * forwarded to the underlying <img>.
 */
export default function PictureImage({
  src,
  webpSrc,
  alt = '',
  loading = 'lazy',
  decoding = 'async',
  ...rest
}) {
  if (!src) return null;
  if (!webpSrc) {
    return <img src={src} alt={alt} loading={loading} decoding={decoding} {...rest} />;
  }
  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <img src={src} alt={alt} loading={loading} decoding={decoding} {...rest} />
    </picture>
  );
}
