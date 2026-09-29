import enforceDesignTokens from './rules/enforce-design-tokens';
import noReactEffects from './rules/no-react-effects';
import preferExpoImage from './rules/prefer-expo-image';

export default {
  meta: {
    name: 'eslint-plugin-gsale',
    version: '1.0.0',
  },
  rules: {
    'enforce-design-tokens': enforceDesignTokens,
    'no-react-effects': noReactEffects,
    'prefer-expo-image': preferExpoImage,
  },
};
