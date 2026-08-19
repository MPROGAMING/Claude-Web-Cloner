// Stand-in for next/image inside the design-system bundle. Same reason as
// next-link.tsx: the real module reads process.env.__NEXT_IMAGE_OPTS at module
// scope and throws in a browser IIFE. There is also no /_next/image optimizer
// serving requests here, so an <img> at the requested box is the honest render.
import * as React from "react";

type StaticSrc = { src: string; width?: number; height?: number };

type Props = Omit<React.ComponentPropsWithoutRef<"img">, "src"> & {
  src: string | StaticSrc;
  fill?: boolean;
  // Accepted and dropped: optimizer-only knobs.
  priority?: unknown;
  quality?: unknown;
  sizes?: unknown;
  placeholder?: unknown;
  blurDataURL?: unknown;
  loader?: unknown;
  unoptimized?: unknown;
  onLoadingComplete?: unknown;
};

function Image({
  src,
  fill,
  style,
  priority: _priority,
  quality: _quality,
  sizes: _sizes,
  placeholder: _placeholder,
  blurDataURL: _blurDataURL,
  loader: _loader,
  unoptimized: _unoptimized,
  onLoadingComplete: _onLoadingComplete,
  ...props
}: Props) {
  const url = typeof src === "string" ? src : src?.src;
  // `fill` is a layout mode, not an attribute — reproduce what Next's own CSS does.
  const fillStyle: React.CSSProperties = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }
    : {};
  return <img src={url} style={{ ...fillStyle, ...style }} {...props} />;
}

export default Image;
