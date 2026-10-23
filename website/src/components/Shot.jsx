import { media } from '../site.js';

// A screenshot from public/media/v23 as WebP with a JPEG fallback. With
// `phone`, narrow screens get the phone capture of the same look instead.
export default function Shot({ name, phone, alt, width, height, className, eager = false }) {
  return (
    <picture className={className}>
      {phone && <source media="(max-width: 820px)" srcSet={media(`v23/${phone}.webp`)} type="image/webp" />}
      {phone && <source media="(max-width: 820px)" srcSet={media(`v23/${phone}.jpg`)} />}
      <source srcSet={media(`v23/${name}.webp`)} type="image/webp" />
      <img
        src={media(`v23/${name}.jpg`)}
        width={width}
        height={height}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        {...(eager ? { fetchPriority: 'high' } : {})}
        draggable="false"
      />
    </picture>
  );
}
