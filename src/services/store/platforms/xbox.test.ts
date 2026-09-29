import { describe, expect, test } from 'bun:test';

import {
  parseXboxAutosuggestProductIds,
  parseXboxSearchProductIds,
} from '@/services/store/platforms/xbox-search';
import { pickXboxSearchImage } from '@/services/store/platforms/xbox-image';
import { getXboxListPrice } from '@/services/store/platforms/xbox-price';

describe('Xbox list price', () => {
  test('prioritizes Xbox game search ids over earlier add-on ids in page data', () => {
    const ids = parseXboxSearchProductIds(`
      <script>
        {"productId":"9P16KJ3ST59B","title":"Ready or Not: Home Invasion"}
        {"SEARCH_GAMES_SEARCHQUERY=READY-OR-NOT_":{"type":2,"data":{"products":[
          {"productId":"9NBR63PT4FZC"},
          {"productId":"9P16KJ3ST59B"}
        ]}}}
      </script>
    `);

    expect(ids.slice(0, 2)).toEqual(['9NBR63PT4FZC', '9P16KJ3ST59B']);
  });

  test('parses product ids from the lightweight catalog autosuggest response', () => {
    const ids = parseXboxAutosuggestProductIds({
      Results: [
        { ProductFamilyName: 'Games', Products: [{ ProductId: '9GAME001' }, { ProductId: '9GAME002' }] },
        { ProductFamilyName: 'Apps', Products: [{ ProductId: '9GAME001' }] },
      ],
    });

    expect(ids).toEqual(['9GAME001', '9GAME002']);
  });

  test('uses wide hero artwork for Xbox search cards before square box art', () => {
    const image = pickXboxSearchImage({
      LocalizedProperties: [
        {
          Images: [
            { ImagePurpose: 'BoxArt', Uri: '//store-images.example/box.jpg', Width: 1080 },
            { ImagePurpose: 'TitledHeroArt', Uri: '//store-images.example/hero.jpg', Width: 1920 },
          ],
        },
      ],
    });

    expect(image).toBe('https://store-images.example/hero.jpg');
  });

  test('picks lowest ListPrice across availabilities', () => {
    const priced = getXboxListPrice({
      DisplaySkuAvailabilities: [
        {
          Availabilities: [
            { OrderManagementData: { Price: { ListPrice: 699, MSRP: 999, CurrencyCode: 'TRY' } } },
            { OrderManagementData: { Price: { ListPrice: 18.25, MSRP: 36.5, CurrencyCode: 'TRY' } } },
          ],
        },
      ],
    });
    expect(priced?.list).toBe(18.25);
    expect(priced?.currency).toBe('TRY');
    expect(priced?.isFree).toBeFalse();
  });

  test('marks products with only zero prices as free', () => {
    const priced = getXboxListPrice({
      DisplaySkuAvailabilities: [
        {
          Availabilities: [
            { OrderManagementData: { Price: { ListPrice: 0, MSRP: 0, CurrencyCode: 'TRY' } } },
            { OrderManagementData: { Price: { ListPrice: 0, MSRP: 0, CurrencyCode: 'USD' } } },
          ],
        },
      ],
    });

    expect(priced).toEqual({
      list: 0,
      msrp: 0,
      currency: 'TRY',
      isFree: true,
    });
  });
});
