import { cleanStoreText, uniqueNonEmpty, type DetailMetadata } from '@/services/store/metadata';
import { normalizeProtocolRelativeUri } from '@/services/store/image-uri';

interface XboxImage {
  ImagePurpose?: string;
  Uri?: string;
}

interface XboxCmsVideo {
  HLS?: string;
  DASH?: string;
  TrailerId?: string;
  PreviewImage?: XboxImage;
}

interface XboxLocalizedProperties {
  ProductDescription?: string;
  ShortDescription?: string;
  DeveloperName?: string;
  PublisherName?: string;
  Images?: XboxImage[];
  CMSVideos?: XboxCmsVideo[];
}

export interface XboxDisplayProductForMetadata {
  LocalizedProperties?: XboxLocalizedProperties[];
  MarketProperties?: { OriginalReleaseDate?: string }[];
  Properties?: {
    Category?: string;
    Categories?: string[];
  };
}

export function xboxMetadataFromProduct(product: XboxDisplayProductForMetadata): DetailMetadata {
  const loc = product.LocalizedProperties?.[0];
  const metadata: DetailMetadata = {};
  const description = cleanStoreText(loc?.ProductDescription || loc?.ShortDescription || '');
  const releaseDate = product.MarketProperties?.[0]?.OriginalReleaseDate;
  const developers = uniqueNonEmpty([loc?.DeveloperName, loc?.PublisherName]);
  const genres = uniqueNonEmpty([
    ...(product.Properties?.Categories ?? []),
    product.Properties?.Category,
  ]);
  const screenshots = uniqueNonEmpty(
    (loc?.Images ?? []).flatMap((image) =>
      image.ImagePurpose === 'Screenshot' && image.Uri ? [normalizeProtocolRelativeUri(image.Uri)] : [],
    ),
  );
  const videos = (loc?.CMSVideos ?? []).flatMap((video, index) => {
    const url = video.HLS || video.DASH || '';
    if (!url) return [];
    const item: NonNullable<DetailMetadata['videos']>[number] = {
      platform: 'xbox',
      id: video.TrailerId || `xbox-video-${index}`,
      url,
    };
    if (video.PreviewImage?.Uri) {
      item.thumbnail = normalizeProtocolRelativeUri(video.PreviewImage.Uri);
    }
    return [item];
  });

  if (description) metadata.description = description;
  if (releaseDate) metadata.release_date = releaseDate;
  if (developers.length > 0) metadata.developers = developers;
  if (genres.length > 0) metadata.genres = genres;
  if (screenshots.length > 0) metadata.screenshots = screenshots;
  if (videos.length > 0) metadata.videos = videos;
  return metadata;
}
