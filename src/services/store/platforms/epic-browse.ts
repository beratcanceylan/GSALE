import type { EpicMinorUnitPrice } from '@/services/store/platforms/epic-price';
import type { EpicOffer } from '@/services/store/platforms/epic-search';

export interface EpicBrowseOffer extends EpicOffer {
  price?: {
    price?: EpicMinorUnitPrice;
  };
}

type EpicBrowseQuery = Readonly<{
  state?: {
    data?: {
      Catalog?: {
        searchStore?: {
          elements?: unknown[];
        };
      };
    };
  };
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseBrowseElement(value: unknown): EpicBrowseOffer | null {
  if (!isRecord(value)) return null;
  const element = value;
  if (typeof element['title'] !== 'string' || typeof element['id'] !== 'string') return null;

  const rawPrice = isRecord(element['price']) ? element['price'] : null;
  const totalPrice = rawPrice && isRecord(rawPrice['totalPrice']) ? rawPrice['totalPrice'] : null;
  const currencyInfo = totalPrice && isRecord(totalPrice['currencyInfo']) ? totalPrice['currencyInfo'] : null;

  const rawImages = Array.isArray(element['keyImages']) ? element['keyImages'] : [];
  const keyImages = rawImages.flatMap((image) => {
    if (!isRecord(image)) return [];
    return typeof image['type'] === 'string' && typeof image['url'] === 'string'
      ? [{ type: image['type'], url: image['url'] }]
      : [];
  });
  const rawTags = Array.isArray(element['tags']) ? element['tags'] : [];
  const tags = rawTags.flatMap((tag) => {
    if (!isRecord(tag)) return [];
    return typeof tag['name'] === 'string' ? [{ name: tag['name'] }] : [];
  });
  const result: EpicBrowseOffer = {
    id: element['id'],
    title: element['title'],
    ...(typeof element['namespace'] === 'string' ? { namespace: element['namespace'] } : {}),
    ...(typeof element['description'] === 'string' ? { description: element['description'] } : {}),
    ...(typeof element['releaseDate'] === 'string' ? { releaseDate: element['releaseDate'] } : {}),
    ...(typeof element['pcReleaseDate'] === 'string' ? { pcReleaseDate: element['pcReleaseDate'] } : {}),
    ...(typeof element['developerDisplayName'] === 'string'
      ? { developerDisplayName: element['developerDisplayName'] }
      : {}),
    ...(typeof element['publisherDisplayName'] === 'string'
      ? { publisherDisplayName: element['publisherDisplayName'] }
      : {}),
    ...(typeof element['productSlug'] === 'string' ? { productSlug: element['productSlug'] } : {}),
    ...(typeof element['urlSlug'] === 'string' ? { urlSlug: element['urlSlug'] } : {}),
    ...(typeof element['offerType'] === 'string' ? { offerType: element['offerType'] } : {}),
    ...(keyImages.length > 0 ? { keyImages } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  };

  if (isRecord(element['seller']) && typeof element['seller']['name'] === 'string') {
    result.seller = { name: element['seller']['name'] };
  }

  if (totalPrice) {
    const price: EpicMinorUnitPrice = {};
    if (typeof totalPrice['currencyCode'] === 'string') price.currencyCode = totalPrice['currencyCode'];
    if (typeof totalPrice['originalPrice'] === 'number') price.originalPrice = totalPrice['originalPrice'];
    if (typeof totalPrice['discountPrice'] === 'number') price.discountPrice = totalPrice['discountPrice'];
    if (typeof currencyInfo?.['decimals'] === 'number') price.decimals = currencyInfo['decimals'];
    if (Object.keys(price).length > 0) result.price = { price };
  }
  return result;
}

/** Parse the JSON state embedded in Epic's localized browse page. */
export function parseEpicBrowseOffers(html: string): EpicBrowseOffer[] {
  const marker = 'window.__REACT_QUERY_INITIAL_QUERIES__ = ';
  const start = html.indexOf(marker);
  if (start < 0) return [];
  const valueStart = start + marker.length;
  const valueEnd = html.indexOf('window.server_rendered', valueStart);
  if (valueEnd < 0) return [];
  const raw = html.slice(valueStart, valueEnd).trim();
  const json = raw.endsWith(';') ? raw.slice(0, -1) : raw;
  let parsed: { queries?: EpicBrowseQuery[] };
  try {
    parsed = JSON.parse(json) as { queries?: EpicBrowseQuery[] };
  } catch {
    return [];
  }
  for (const query of parsed.queries ?? []) {
    const elements = query.state?.data?.Catalog?.searchStore?.elements;
    if (!elements) continue;
    const offers = elements.flatMap((element) => {
      const parsedElement = parseBrowseElement(element);
      return parsedElement ? [parsedElement] : [];
    });
    if (offers.length > 0) return offers;
  }
  return [];
}
