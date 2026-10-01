import { describe, expect, test } from 'bun:test';
import { productDevices } from '@/services/store/devices';

describe('productDevices', () => {
  test('reports only explicitly named consoles', () => {
    expect(productDevices('Xbox', 'Game')).toEqual([]);
    expect(productDevices('PlayStation', 'Game PS4 ve PS5')).toEqual(['PlayStation 4', 'PlayStation 5']);
    expect(productDevices('Nintendo', 'Game Nintendo Switch 2')).toEqual(['Nintendo Switch 2']);
  });
});
