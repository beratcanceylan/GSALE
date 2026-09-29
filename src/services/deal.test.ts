import { describe, expect, test } from 'bun:test';

import { cheapestDeal, freeDeal, mapDeal } from '@/services/deal';

const deal = (platform: string, price: string) => mapDeal({ platform, price, discount: '' });

describe('cheapestDeal', () => {
  test('prefers the cheapest paid deal, then free, and ignores unavailable', () => {
    expect(cheapestDeal([])).toBeNull();
    expect(cheapestDeal([deal('A', 'Bilinmiyor')])).toBeNull();
    expect(cheapestDeal([deal('A', '20,00 TL'), deal('B', '10,00 TL'), deal('C', 'Ücretsiz')])?.platform).toBe('B');
    expect(cheapestDeal([deal('A', 'Ücretsiz')])?.platform).toBe('A');
    expect(cheapestDeal([freeDeal('Epic Games', ''), deal('B', 'Game Pass')])?.platform).toBe('Epic Games');
  });
});
