import { describe, expect, test } from 'bun:test';

import { normalizeProtocolRelativeUri } from '@/services/store/image-uri';

describe('image-uri', () => {
  test('prefixes protocol-relative URIs with https', () => {
    const raw = '//store-images.s-microsoft.com/image/apps.test';
    expect(normalizeProtocolRelativeUri(raw)).toBe(`https:${raw}`);
  });
});
