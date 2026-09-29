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

const OPTIONAL_STRING_FIELDS = [
  'namespace',
  'description',
  'releaseDate',
  'pcReleaseDate',
  'developerDisplayName',
  'publisherDisplayName',
  'productSlug',
  'urlSlug',
  'offerType',
] as const;

type OptionalStringField = (typeof OPTIONAL_STRING_FIELDS)[number];

function recordField(record: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> | null {
  const value = record?.[key];
  return isRecord(value) ? value : null;
}

function recordList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function optionalStrings(element: Record<string, unknown>): Partial<Record<OptionalStringField, string>> {
  const fields: Partial<Record<OptionalStringField, string>> = {};
  for (const key of OPTIONAL_STRING_FIELDS) {
    const value = element[key];
    if (typeof value === 'string') fields[key] = value;
  }
  return fields;
}

function browseKeyImages(element: Record<string, unknown>): { type: string; url: string }[] {
  return recordList(element['keyImages']).flatMap((image) =>
    typeof image['type'] === 'string' && typeof image['url'] === 'string'
      ? [{ type: image['type'], url: image['url'] }]
      : [],
  );
}

function browseTags(element: Record<string, unknown>): { name: string }[] {
  return recordList(element['tags']).flatMap((tag) => (typeof tag['name'] === 'string' ? [{ name: tag['name'] }] : []));
}

function browsePrice(element: Record<string, unknown>): EpicMinorUnitPrice | null {
  const totalPrice = recordField(recordField(element, 'price'), 'totalPrice');
  if (!totalPrice) return null;
  const decimals = recordField(totalPrice, 'currencyInfo')?.['decimals'];
  const price: EpicMinorUnitPrice = {};
  if (typeof totalPrice['currencyCode'] === 'string') price.currencyCode = totalPrice['currencyCode'];
  if (typeof totalPrice['originalPrice'] === 'number') price.originalPrice = totalPrice['originalPrice'];
  if (typeof totalPrice['discountPrice'] === 'number') price.discountPrice = totalPrice['discountPrice'];
  if (typeof decimals === 'number') price.decimals = decimals;
  return Object.keys(price).length > 0 ? price : null;
}

function parseBrowseElement(value: unknown): EpicBrowseOffer | null {
  if (!isRecord(value)) return null;
  if (typeof value['title'] !== 'string' || typeof value['id'] !== 'string') return null;

  const keyImages = browseKeyImages(value);
  const tags = browseTags(value);
  const sellerName = recordField(value, 'seller')?.['name'];
  const price = browsePrice(value);
  return {
    id: value['id'],
    title: value['title'],
    ...optionalStrings(value),
    ...(keyImages.length > 0 ? { keyImages } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(typeof sellerName === 'string' ? { seller: { name: sellerName } } : {}),
    ...(price ? { price: { price } } : {}),
  };
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
