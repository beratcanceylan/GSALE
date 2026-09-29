import { Platform, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Top padding for scroll screens: iOS uses contentInsetAdjustmentBehavior; Android uses insets. */
export function useScrollSafeAreaStyle(): ViewStyle {
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'ios') {
    return { flex: 1 };
  }
  return { flex: 1, paddingTop: insets.top };
}
