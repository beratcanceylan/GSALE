import { describe, expect, test } from 'bun:test';

import {
  epicPriceFromElement,
  epicPriceFromMinorUnits,
} from '@/services/store/platforms/epic-price';
import {
  epicOfferToSearchHit,
  pickBestEpicOffers,
  pickBestEpicOffer,
} from '@/services/store/platforms/epic-search';
import { parseEpicBrowseOffers } from '@/services/store/platforms/epic-browse';
import { resetCurrencyCacheForTests, setFxRatesForTests } from '@/services/store/currency';

describe('Epic price mapping', () => {
  test('handles explicit TL labels, nonnumeric copy and regional conversion', async () => {
    setFxRatesForTests({ USD: 1, TRY: 40, EUR: 0.8 });
    try {
      expect((await epicPriceFromElement({ price: { totalPrice: {
        fmtPrice: { discountPrice: '₺50,00' }, currencyCode: 'USD',
      } } })).price).toBe('50,00 TL');
      expect((await epicPriceFromElement({ price: { totalPrice: {
        fmtPrice: { discountPrice: 'Special offer' }, currencyCode: 'USD',
      } } })).price).toBe('Special offer');
      expect((await epicPriceFromElement({ price: { totalPrice: {
        fmtPrice: { discountPrice: '€10.00' }, currencyCode: 'EUR',
      } } })).price).toBe('500,00 TL');
      expect((await epicPriceFromMinorUnits({ currencyCode: 'EUR', discountPrice: 1000 })).price)
        .toBe('500,00 TL');
    } finally {
      resetCurrencyCacheForTests();
    }
  });
  test('computes discount percent from formatted prices instead of discount amount', async () => {
    const priced = await epicPriceFromElement({
      price: {
        totalPrice: {
          fmtPrice: {
            originalPrice: '879,00 TL',
            discountPrice: '307,65 TL',
          },
          discount: 57135,
          currencyCode: 'TRY',
        },
      },
    });

    expect(priced).toEqual({
      price: '307,65 TL',
      original_price: '879,00 TL',
      discount: '-65%',
    });
  });

  test('maps explicit free prices to the Turkish free label', async () => {
    const priced = await epicPriceFromElement({
      price: {
        totalPrice: {
          fmtPrice: {
            originalPrice: '0',
            discountPrice: '0',
          },
          discount: 0,
          currencyCode: 'TRY',
        },
      },
    });

    expect(priced).toEqual({
      price: 'Ücretsiz',
      original_price: null,
      discount: '',
    });
  });

  test('maps Epic minor-unit regional prices to formatted TL values', async () => {
    const priced = await epicPriceFromMinorUnits({
      currencyCode: 'TRY',
      originalPrice: 104900,
      discountPrice: 52450,
      discount: 52450,
    });

    expect(priced).toEqual({
      price: '524,50 TL',
      original_price: '1.049,00 TL',
      discount: '-50%',
    });
  });

  test('maps zero minor-unit prices to the Turkish free label', async () => {
    const priced = await epicPriceFromMinorUnits({
      currencyCode: 'TRY',
      originalPrice: 0,
      discountPrice: 0,
      discount: 0,
    });

    expect(priced).toEqual({
      price: 'Ücretsiz',
      original_price: null,
      discount: '',
    });
  });
});

describe('Epic offer search mapping', () => {
  test('prefers desktop offers over mobile attributes', () => {
    const match = pickBestEpicOffer([
      { id: 'mobile-key', title: 'Hades', namespace: 'ns', customAttributes: [{ key: 'ios', value: 'true' }] },
      { id: 'mobile-value', title: 'Hades', namespace: 'ns', customAttributes: [{ key: 'platform', value: 'Android' }] },
      { id: 'desktop', title: 'Hades', namespace: 'ns', customAttributes: [] },
    ], 'Hades');
    expect(match?.id).toBe('desktop');
    expect(pickBestEpicOffer([
      { id: 'mobile-map', title: 'Hades', customAttributes: { android: 'yes' } },
      { id: 'desktop-map', title: 'Hades', customAttributes: { platform: 'desktop' } },
    ], 'Hades')?.id).toBe('desktop-map');
  });
  test('prefers the matching base-game offer over add-ons and non-store items', () => {
    const match = pickBestEpicOffer(
      [
        {
          id: 'soundtrack',
          namespace: 'min',
          title: 'Hades Original Soundtrack',
          offerType: 'ADD_ON',
        },
        {
          id: 'base',
          namespace: 'min',
          title: 'Hades',
          offerType: 'BASE_GAME',
        },
        {
          id: 'other',
          namespace: 'epic',
          title: 'Hades',
          offerType: 'OTHERS',
        },
      ],
      'Hades',
    );

    expect(match?.id).toBe('base');
  });

  test('prefers the storefront listing over a mobile duplicate', () => {
    const offers = pickBestEpicOffers(
      [
        {
          id: 'mobile',
          namespace: 'fn',
          title: 'Fortnite Festival',
          urlSlug: 'fortnite--festival-ios',
          description: 'Mobile listing',
          keyImages: [{ type: 'OfferImageWide', url: 'https://cdn.example/mobile.jpg' }],
        },
        {
          id: 'storefront',
          namespace: 'fn',
          title: 'Fortnite Festival',
          urlSlug: 'fortnite--sparks',
          description: 'Storefront listing',
          keyImages: [
            { type: 'OfferImageWide', url: 'https://cdn.example/wide.jpg' },
            { type: 'DieselGameBoxWide', url: 'https://cdn.example/box.jpg' },
            { type: 'featuredMedia', url: 'https://cdn.example/feature.jpg' },
          ],
        },
      ],
      'Fortnite Festival',
    );

    expect(offers).toHaveLength(1);
    expect(offers[0]?.id).toBe('storefront');
  });

  test('maps EGData offers to Epic search hits with product page URLs', () => {
    const hit = epicOfferToSearchHit({
      id: '331226ba7c944720baa99103cb1fe80c',
      namespace: 'b0cd075465c44f87be3b505ac04a2e46',
      title: 'Grand Theft Auto V Enhanced',
      productSlug: null,
      urlSlug: 'grand-theft-auto-v',
      keyImages: [
        { type: 'OfferImageTall', url: 'https://cdn.example/tall.jpg' },
        { type: 'OfferImageWide', url: 'https://cdn.example/wide.jpg' },
      ],
    });

    expect(hit).toEqual({
      id: 'epic-b0cd075465c44f87be3b505ac04a2e46_331226ba7c944720baa99103cb1fe80c',
      slug: 'b0cd075465c44f87be3b505ac04a2e46_331226ba7c944720baa99103cb1fe80c',
      title: 'Grand Theft Auto V Enhanced',
      image_url: 'https://cdn.example/wide.jpg',
      platform: 'Epic Games',
      store_url: 'https://store.epicgames.com/p/grand-theft-auto-v',
    });
  });

  test('parses localized Epic browse data for products missing from EGData', () => {
    const html = [
      'window.__REACT_QUERY_INITIAL_QUERIES__ = ',
      JSON.stringify({
        queries: [
          {
            state: {
              data: {
                Catalog: {
                  searchStore: {
                    elements: [
                      {
                        id: 'epic-id',
                        namespace: 'fn',
                        title: 'FORTNITE: Mazi',
                        description: 'A Fortnite experience.',
                        urlSlug: 'fortnite--og',
                        developerDisplayName: 'Epic Games',
                        releaseDate: '2025-01-01T00:00:00.000Z',
                        keyImages: [{ type: 'OfferImageWide', url: 'https://cdn.example/mazi.jpg' }],
                        price: {
                          totalPrice: {
                            currencyCode: 'TRY',
                            originalPrice: 0,
                            discountPrice: 0,
                            currencyInfo: { decimals: 2 },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        ],
      }),
      '; window.server_rendered = true;',
    ].join('');

    expect(parseEpicBrowseOffers(html)).toEqual([
      {
        id: 'epic-id',
        namespace: 'fn',
        title: 'FORTNITE: Mazi',
        description: 'A Fortnite experience.',
        releaseDate: '2025-01-01T00:00:00.000Z',
        developerDisplayName: 'Epic Games',
        urlSlug: 'fortnite--og',
        keyImages: [{ type: 'OfferImageWide', url: 'https://cdn.example/mazi.jpg' }],
        price: {
          price: {
            currencyCode: 'TRY',
            originalPrice: 0,
            discountPrice: 0,
            decimals: 2,
          },
        },
      },
    ]);
  });

  test('skips invalid browse state and malformed artwork records', () => {
    expect(parseEpicBrowseOffers('window.__REACT_QUERY_INITIAL_QUERIES__ = broken; window.server_rendered'))
      .toEqual([]);
    const state = { queries: [
      { state: { data: { Catalog: { searchStore: { elements: [null, { id: 'a' }] } } } } },
      { state: { data: { Catalog: { searchStore: { elements: [
        { id: 'valid', title: 'Valid', keyImages: [{ type: 1, url: 'bad' }] },
      ] } } } } },
    ] };
    const html = `window.__REACT_QUERY_INITIAL_QUERIES__ = ${JSON.stringify(state)}; window.server_rendered`;
    expect(parseEpicBrowseOffers(html)).toMatchObject([{ id: 'valid', title: 'Valid' }]);
    expect(parseEpicBrowseOffers('window.__REACT_QUERY_INITIAL_QUERIES__ = {"queries":[]}; window.server_rendered'))
      .toEqual([]);
  });
});
