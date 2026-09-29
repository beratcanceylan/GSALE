import { normalizeProtocolRelativeUri } from '@/services/store/image-uri';

export interface XboxImageLike {
  ImagePurpose?: string;
  Uri?: string;
  Width?: number;
}

export interface XboxProductImagesLike {
  LocalizedProperties?: { Images?: XboxImageLike[] }[];
}

function normalizeXboxImageUri(uri: string): string {
  return normalizeProtocolRelativeUri(uri);
}

export function pickXboxSearchImage(product: XboxProductImagesLike): string {
  const images = product.LocalizedProperties?.[0]?.Images ?? [];
  if (!images.length) return '';
  const titledHero = images.find((i) => i.ImagePurpose === 'TitledHeroArt' && (i.Width ?? 0) >= 1000);
  const hero = images.find((i) => i.ImagePurpose === 'SuperHeroArt' && (i.Width ?? 0) >= 1000);
  const screenshot = images.find((i) => i.ImagePurpose === 'Screenshot' && (i.Width ?? 0) >= 1000);
  const box = images.find((i) => i.ImagePurpose === 'BoxArt' && (i.Width ?? 0) >= 200);
  const poster = images.find((i) => i.ImagePurpose === 'Poster');
  const raw = titledHero?.Uri || hero?.Uri || screenshot?.Uri || box?.Uri || poster?.Uri || images[0]?.Uri || '';
  return normalizeXboxImageUri(raw);
}
