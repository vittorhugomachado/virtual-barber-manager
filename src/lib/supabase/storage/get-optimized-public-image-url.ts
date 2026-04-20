type OptimizedImageOptions = {
  width: number;
  height?: number;
  quality?: number;
};

export function getOptimizedPublicImageUrl(
  publicUrl: string | null | undefined,
  { width, height, quality = 75 }: OptimizedImageOptions,
) {
  if (!publicUrl) return undefined;

  try {
    const url = new URL(publicUrl);
    const marker = "/storage/v1/object/public/";
    const path = url.pathname;
    const markerIndex = path.indexOf(marker);

    if (markerIndex === -1) {
      return publicUrl;
    }

    url.pathname =
      path.slice(0, markerIndex) +
      "/storage/v1/render/image/public/" +
      path.slice(markerIndex + marker.length);

    url.searchParams.set("width", String(width));

    if (height) {
      url.searchParams.set("height", String(height));
    }

    url.searchParams.set("quality", String(quality));

    return url.toString();
  } catch {
    return publicUrl;
  }
}
