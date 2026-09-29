import type { Rule } from 'eslint';

const preferExpoImage: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer expo-image Image component over react-native Image for consistency',
      recommended: true,
    },
    messages: {
      preferExpoImage:
        "Use Image from 'expo-image' instead of 'react-native' for consistent image handling, caching, and contentFit support.",
    },
    schema: [],
  },
  create(context) {
    let reactNativeImageImported = false;
    let reactNativeImportNode: unknown;

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'react-native') {
          const imageSpecifier = node.specifiers.find(
            (spec) =>
              spec.type === 'ImportSpecifier' &&
              spec.imported.type === 'Identifier' &&
              spec.imported.name === 'Image',
          );
          if (imageSpecifier) {
            reactNativeImageImported = true;
            reactNativeImportNode = imageSpecifier;
          }
        }
      },
      'Program:exit'() {
        if (reactNativeImageImported && reactNativeImportNode != null) {
          context.report({
            node: reactNativeImportNode as import('estree').ImportSpecifier,
            messageId: 'preferExpoImage',
          });
        }
      },
    };
  },
};

export default preferExpoImage;
