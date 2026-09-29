import { describe, expect, test } from 'bun:test';

import {
  epicPriceFromElement,
  epicPriceFromMinorUnits,
} from '@/services/store/platforms/epic-price';
import {
  epicOfferToSearchHit,
  epicOfferToGameMedia,
  epicDetailImage,
  epicMediaToGameMedia,
  epicMetadataFromOffer,
  pickBestEpicOffers,
  pickBestEpicOffer,
  pickBestEpicOfferForTitles,
} from '@/services/store/platforms/epic-search';
import { parseEpicBrowseOffers } from '@/services/store/platforms/epic-browse';

describe('Epic price mapping', () => {
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

  test('can match an expanded GTA title when the original query used an acronym', () => {
    const match = pickBestEpicOfferForTitles(
      [
        {
          id: 'gta',
          namespace: 'b0cd075465c44f87be3b505ac04a2e46',
          title: 'Grand Theft Auto V Enhanced',
          offerType: 'BASE_GAME',
        },
      ],
      ['gta v enhanced', 'Grand Theft Auto v enhanced'],
    );

    expect(match?.id).toBe('gta');
  });

  test('maps Epic offer metadata and media into game detail fields', () => {
    const metadata = epicMetadataFromOffer({
      title: 'Grand Theft Auto V Enhanced',
      description: 'Experience GTA V.',
      releaseDate: '2025-03-04T12:00:00.000Z',
      developerDisplayName: 'Rockstar North',
      publisherDisplayName: 'Rockstar Games  ',
      tags: [
        { name: 'Action' },
        { name: 'Windows' },
        { name: 'Open World' },
        { name: 'Epic MEGA Sale' },
      ],
    });
    const media = epicMediaToGameMedia({
      images: [{ src: 'https://cdn.example/screenshot-1.jpg' }],
      videos: [
        {
          outputs: [
            { key: 'thumbnail', url: 'https://cdn.example/thumb.png' },
            { key: 'medium', url: 'https://cdn.example/trailer.webm' },
          ],
        },
      ],
    });

    expect(metadata).toEqual({
      description: 'Experience GTA V.',
      release_date: '2025-03-04T12:00:00.000Z',
      developers: ['Rockstar North', 'Rockstar Games'],
      genres: ['Action', 'Open World'],
    });
    expect(media).toEqual({
      screenshots: ['https://cdn.example/screenshot-1.jpg'],
      videos: [
        {
          platform: 'epic',
          id: 'epic-video-0',
          url: 'https://cdn.example/trailer.webm',
          thumbnail: 'https://cdn.example/thumb.png',
        },
      ],
    });
  });

  test('falls back to seller name for Epic developer metadata', () => {
    expect(
      epicMetadataFromOffer({
        title: 'Fortnite',
        description: 'Fortnite Battle Royale',
        seller: { name: 'Epic Games' },
      }).developers,
    ).toEqual(['Epic Games']);
  });

  test('uses current Epic media artwork before stale offer artwork for detail hero', () => {
    const image = epicDetailImage(
      {
        keyImages: [{ type: 'DieselStoreFrontWide', url: 'https://cdn.example/old.jpg' }],
      },
      {
        images: [{ src: 'https://cdn.example/current.jpg' }],
      },
    );

    expect(image).toBe('https://cdn.example/current.jpg');
  });

  test('uses Epic offer key images as detail screenshots when media endpoint has none', () => {
    const media = epicOfferToGameMedia({
      keyImages: [
        { type: 'AndroidIcon', url: 'https://cdn.example/icon.jpg' },
        { type: 'DieselGameBoxWide', url: 'https://cdn.example/wide.jpg' },
        { type: 'featuredMedia', url: 'https://cdn.example/feature.jpg' },
      ],
    });

    expect(media).toEqual({
      screenshots: ['https://cdn.example/wide.jpg', 'https://cdn.example/feature.jpg'],
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
});
