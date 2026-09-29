import { afterEach, describe, expect, test } from 'bun:test';

import { resetCurrencyCacheForTests, setUsdToTryRateForTests } from '@/services/store/currency';
import {
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

  test('picks exact product id from catalog results', () => {
    const products: GogProduct[] = [
      { id: 1495134320, title: 'The Witcher 3', slug: 'the_witcher_3' },
      { id: 2093619782, title: 'Cyberpunk 2077', slug: 'cyberpunk_2077' },
    ];

    expect(pickGogProductById(products, '2093619782')?.title).toBe('Cyberpunk 2077');
  });
});
