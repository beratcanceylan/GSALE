import { describe, expect, test } from 'bun:test';

import { nativeState, resetNativeState } from '../../test-support/native-mocks';

const { applyLayoutDirection } = await import('@/i18n/rtl');

describe('applyLayoutDirection', () => {
  test('forces right-to-left for Arabic and reports that a restart is needed', () => {
    resetNativeState();
    expect(applyLayoutDirection('ar')).toBeTrue();
    expect(nativeState.rtl).toMatchObject({ allowed: true, forced: true });
  });

  test('keeps left-to-right languages without a restart', () => {
    resetNativeState();
    expect(applyLayoutDirection('de')).toBeFalse();
    expect(nativeState.rtl).toMatchObject({ allowed: false, forced: false });
  });

  test('leaving Arabic needs a restart while the layout is still right-to-left', () => {
    resetNativeState();
    nativeState.rtl.isRTL = true;
    expect(applyLayoutDirection('tr')).toBeTrue();
    expect(applyLayoutDirection('ar')).toBeFalse();
  });
});
