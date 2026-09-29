import { describe, expect, test } from 'bun:test';

import {
  parseNintendoProduct,
  parseNintendoSearchResponse,
} from '@/services/store/platforms/nintendo-parse';

const nbaHit = {
  objectID: '7100116953',
  nsuid: '70010000116953',
  title: 'NBA 2K27',
  url: '/us/store/products/nba-2k27-switch-2/',
  productImageSquare: 'https://assets.nintendo.com/image/upload/q_auto/f_auto/nba-2k27.jpg',
  platform: 'Nintendo Switch 2',
  corePlatforms: ['Nintendo Switch 2'],
  releaseDate: '2026-09-04T00:00:00.000Z',
  price: { finalPrice: 59.99, regPrice: 69.99, discounted: true, percentOff: 14 },
  eshopDetails: { regularPrice: 69.99, discountPrice: 59.99, currency: 'USD' },
  gameGenreLabels: ['Sports'],
  softwareDeveloper: 'Visual Concepts',
  softwarePublisher: '2K',
  productType: ['Games'],
};

describe('Nintendo.com Algolia parsing', () => {
  test('maps a current game hit and its sale price', () => {
    expect(parseNintendoProduct(nbaHit)).toMatchObject({
      id: '7100116953',
      nsuid: '70010000116953',
      title: 'NBA 2K27',
      price: 59.99,
      original_price: 69.99,
      currency: 'USD',
      discount: '-14%',
      platform: 'Nintendo Switch 2',
      store_url: 'https://www.nintendo.com/us/store/products/nba-2k27-switch-2/',
    });
  });

  test('deduplicates hits and marks DLC as add-ons', () => {
    const results = parseNintendoSearchResponse({
      hits: [
        { ...nbaHit, objectID: 'dlc-1', title: 'NBA 2K27 DLC', dlcType: 'DLC' },
        nbaHit,
        nbaHit,
      ],
    });
    expect(results).toHaveLength(2);
    expect(results.map((result) => result.is_add_on)).toEqual([true, false]);
  });

  test('does not fabricate a price for a catalog item without one', () => {
    expect(parseNintendoProduct({ objectID: '700', title: 'Demo', url: '/us/demo/' })).toMatchObject({
      price: null,
      original_price: null,
    });
  });
});
