import type { Rule } from 'eslint';

const BANNED_IDENTIFIERS = new Set(['useEffect', 'useLayoutEffect', 'useFocusEffect']);

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow useEffect, useLayoutEffect, and useFocusEffect — use bootstrap, events, or useSyncExternalStore instead.',
    },
    schema: [],
    messages: {
      banned:
        '{{name}} is not allowed. Use index bootstrap, tab screenListeners, pull-to-refresh, or useSyncExternalStore.',
    },
  },
  create(context) {
    return {
      ImportSpecifier(node) {
        if (
          node.imported.type === 'Identifier' &&
          BANNED_IDENTIFIERS.has(node.imported.name)
        ) {
          context.report({
            node: node.imported,
            messageId: 'banned',
            data: { name: node.imported.name },
          });
        }
      },
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && BANNED_IDENTIFIERS.has(node.callee.name)) {
          context.report({
            node: node.callee,
            messageId: 'banned',
            data: { name: node.callee.name },
          });
        }
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          BANNED_IDENTIFIERS.has(node.callee.property.name)
        ) {
          context.report({
            node: node.callee.property,
            messageId: 'banned',
            data: { name: node.callee.property.name },
          });
        }
      },
    };
  },
};

export default rule;
