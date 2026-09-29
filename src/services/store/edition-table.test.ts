import { describe, expect, test } from 'bun:test';

import { acceptEditionCandidate } from '@/services/store/edition-table';

describe('acceptEditionCandidate', () => {
  test('keeps editions of the same game', () => {
    expect(acceptEditionCandidate('ELDEN RING Deluxe Edition', 'ELDEN RING')).toBe('deluxe');
    expect(acceptEditionCandidate('ELDEN RING', 'ELDEN RING Deluxe Edition')).toBe('base');
  });

  test('rejects DLC and other games', () => {
    expect(acceptEditionCandidate('ELDEN RING Shadow of the Erdtree Season Pass', 'ELDEN RING')).toBeNull();
    expect(acceptEditionCandidate('Final Fantasy XVI Deluxe Edition', 'Final Fantasy XV')).toBeNull();
    expect(acceptEditionCandidate('Hades', 'Hades II')).toBeNull();
  });
});
