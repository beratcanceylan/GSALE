import { afterEach, describe, expect, test } from 'bun:test';

import { resetCurrencyCacheForTests, setUsdToTryRateForTests } from '@/services/store/currency';
import {
  gogMetadataFromProduct,
  pickGogProductById,
  gogPriceFromProduct,
  type GogProduct,
} from '@/services/store/platforms/gog-price';

afterEach(() => {
  resetCurrencyCacheForTests();
});

describe('GOG price mapping', () => {
  test('maps finalMoney USD to TRY', async () => {
    setUsdToTryRateForTests(40);
    const product: GogProduct = {
      id: 1,
      title: 'Test Game',
      slug: 'test_game',
      price: {
        finalMoney: { amount: '10.00', currency: 'USD' },
        baseMoney: { amount: '20.00', currency: 'USD' },
        discount: '50',
      },
    };
    const priced = await gogPriceFromProduct(product);
    expect(priced.price).toContain('400,00 TL');
    expect(priced.original_price).toContain('800,00 TL');
    expect(priced.discount).toBe('-50%');
  });

  test('normalizes formatted catalog discount strings', async () => {
    setUsdToTryRateForTests(40);
    const product: GogProduct = {
      id: 1,
      title: 'Test Game',
      slug: 'test_game',
      price: {
        finalMoney: { amount: '10.00', currency: 'USD' },
        baseMoney: { amount: '20.00', currency: 'USD' },
        discount: '-50%',
      },
    };

    const priced = await gogPriceFromProduct(product);

    expect(priced.discount).toBe('-50%');
  });

  test('maps expanded GOG metadata into detail fields', () => {
    const metadata = gogMetadataFromProduct(
      {
        id: 2093619782,
        title: 'Cyberpunk 2077',
        slug: 'cyberpunk_2077',
        releaseDate: '2020.12.10',
        developers: ['CD PROJEKT RED'],
        publishers: ['CD PROJEKT RED'],
        genres: [{ name: 'Role-playing' }, { name: 'Action' }],
        screenshots: ['https://images.gog.com/fallback_{formatter}.jpg'],
      },
      {
        description: {
          full: '<p>Night City awaits.</p><br><strong>Become V.</strong>',
        },
        screenshots: [
          {
            formatter_template_url: 'https://images.gog.com/shot_{formatter}.png',
          },
        ],
        videos: [
          {
            provider: 'youtube',
            video_url: 'https://www.youtube.com/embed/UIE1JjNOqHM?wmode=opaque&rel=0',
            thumbnail_url: 'https://img.youtube.com/vi/UIE1JjNOqHM/hqdefault.jpg',
          },
        ],
      },
    );

    expect(metadata).toEqual({
      description: 'Night City awaits. Become V.',
      release_date: '2020-12-10',
      developers: ['CD PROJEKT RED'],
      genres: ['Role-playing', 'Action'],
      screenshots: ['https://images.gog.com/shot_1920.png'],
      videos: [
        {
          platform: 'youtube',
          id: 'UIE1JjNOqHM',
          url: 'https://www.youtube.com/watch?v=UIE1JjNOqHM',
          thumbnail: 'https://img.youtube.com/vi/UIE1JjNOqHM/hqdefault.jpg',
        },
      ],
    });
  });

  test('picks exact product id from catalog results', () => {
    const products: GogProduct[] = [
      { id: 1495134320, title: 'The Witcher 3', slug: 'the_witcher_3' },
      { id: 2093619782, title: 'Cyberpunk 2077', slug: 'cyberpunk_2077' },
    ];

    expect(pickGogProductById(products, '2093619782')?.title).toBe('Cyberpunk 2077');
  });

  test('does not convert non-YouTube videos into YouTube links', () => {
    const metadata = gogMetadataFromProduct(
      {
        id: 1495134320,
        title: 'The Witcher 3',
        slug: 'the_witcher_3',
      },
      {
        videos: [
          {
            provider: 'wistia',
            video_url: 'https://fast.wistia.net/embed/iframe/testvideo',
          },
        ],
      },
    );

    expect(metadata.videos).toBeUndefined();
  });
});
