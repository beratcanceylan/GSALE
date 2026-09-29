import type { Rule } from 'eslint';
import type { Expression, Literal, MemberExpression, Node } from 'estree';

const ALLOWED_LITERALS = new Set([
  'transparent',
  'none',
  'auto',
  'hidden',
  'visible',
  'scroll',
  'cover',
  'contain',
  'center',
  'stretch',
  'repeat',
]);

const TYPOGRAPHY_PROPS = new Set(['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing']);
const SPACING_PROPS = new Set([
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'margin',
  'marginHorizontal',
  'marginVertical',
  'gap',
  'rowGap',
  'columnGap',
]);
const RADIUS_PROPS = new Set([
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
]);
const COLOR_PROPS = new Set([
  'color',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRightColor',
  'shadowColor',
  'textShadowColor',
  'overlayColor',
  'tintColor',
]);

function isLiteralNumber(node: Node): node is Literal {
  return node.type === 'Literal' && typeof node.value === 'number';
}

function isLiteralString(node: Node): node is Literal & { value: string } {
  return node.type === 'Literal' && typeof node.value === 'string';
}

function isMemberExpression(node: Node, objectName: string): node is MemberExpression {
  return (
    node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' &&
    node.object.name === objectName
  );
}

function isAllowedColor(value: string): boolean {
  if (!value) return false;
  if (/^rgba?\s*\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.0\d+\s*\)$/i.test(value)) return true;
  if (/^#fff(?:fff)?$/i.test(value)) return true;
  if (/^#000(?:000)?$/i.test(value)) return true;
  return false;
}

type StylePropertyChecker = (
  context: Rule.RuleContext,
  propName: string,
  valueNode: Expression,
) => boolean;

const checkTypographyProperty: StylePropertyChecker = (context, propName, valueNode) => {
  if (!TYPOGRAPHY_PROPS.has(propName)) return false;

  if (isMemberExpression(valueNode, 'Typography')) return true;
  if (isMemberExpression(valueNode, 'Font')) return true;
  if (valueNode.type === 'TemplateLiteral' || valueNode.type === 'BinaryExpression') return true;
  if (
    propName === 'fontWeight' &&
    isLiteralString(valueNode) &&
    (valueNode.value === 'normal' || valueNode.value === 'bold')
  ) {
    return true;
  }

  if (isLiteralNumber(valueNode) || isLiteralString(valueNode)) {
    context.report({
      node: valueNode,
      messageId: 'noHardcodedTypography',
      data: { prop: propName },
    });
  }
  return true;
};

const checkSpacingProperty: StylePropertyChecker = (context, propName, valueNode) => {
  if (!SPACING_PROPS.has(propName)) return false;

  if (isMemberExpression(valueNode, 'Spacing')) return true;
  if (valueNode.type === 'BinaryExpression' || valueNode.type === 'TemplateLiteral') return true;
  if (isLiteralString(valueNode) && valueNode.value.includes('%')) return true;
  if (isLiteralNumber(valueNode) && (valueNode.value === 0 || Number(valueNode.value) > 32)) return true;

  if (isLiteralNumber(valueNode)) {
    context.report({
      node: valueNode,
      messageId: 'noHardcodedSpacing',
      data: { prop: propName },
    });
  }
  return true;
};

const checkRadiusProperty: StylePropertyChecker = (context, propName, valueNode) => {
  if (!RADIUS_PROPS.has(propName)) return false;

  if (isMemberExpression(valueNode, 'Radius')) return true;
  if (valueNode.type === 'BinaryExpression' || valueNode.type === 'TemplateLiteral') return true;
  if (isLiteralNumber(valueNode) && Number(valueNode.value) > 100) return true;

  if (isLiteralNumber(valueNode)) {
    context.report({
      node: valueNode,
      messageId: 'noHardcodedRadius',
      data: { prop: propName },
    });
  }
  return true;
};

const checkColorProperty: StylePropertyChecker = (context, propName, valueNode) => {
  if (!COLOR_PROPS.has(propName)) return false;

  if (isMemberExpression(valueNode, 'Palette')) return true;
  if (
    valueNode.type === 'ConditionalExpression' ||
    valueNode.type === 'LogicalExpression' ||
    valueNode.type === 'BinaryExpression'
  ) {
    return true;
  }

  if (isLiteralString(valueNode)) {
    if (ALLOWED_LITERALS.has(valueNode.value)) return true;
    if (isAllowedColor(valueNode.value)) return true;
    context.report({
      node: valueNode,
      messageId: 'noHardcodedColor',
      data: { prop: propName, value: valueNode.value },
    });
  }
  return true;
};

const STYLE_PROPERTY_CHECKERS: StylePropertyChecker[] = [
  checkTypographyProperty,
  checkSpacingProperty,
  checkRadiusProperty,
  checkColorProperty,
];

const enforceDesignTokens: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce DesignSystem tokens instead of hardcoded style values',
      recommended: true,
    },
    messages: {
      noHardcodedTypography: "Use DesignSystem Typography tokens instead of hardcoded '{{prop}}' value.",
      noHardcodedSpacing: "Use DesignSystem Spacing tokens instead of hardcoded '{{prop}}' value.",
      noHardcodedRadius: "Use DesignSystem Radius tokens instead of hardcoded '{{prop}}' value.",
      noHardcodedColor:
        "Use DesignSystem Palette tokens instead of hardcoded '{{prop}}' value '{{value}}'.",
      noHardcodedShadow: 'Use DesignSystem Shadows tokens instead of inline shadow objects.',
    },
    schema: [],
  },
  create(context) {
    let insideStyleSheet = false;
    let styleSheetDepth = 0;

    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'StyleSheet' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'create'
        ) {
          insideStyleSheet = true;
        }
      },
      'CallExpression:exit'(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'StyleSheet' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'create'
        ) {
          insideStyleSheet = false;
        }
      },
      ObjectExpression() {
        if (insideStyleSheet) styleSheetDepth++;
      },
      'ObjectExpression:exit'() {
        if (insideStyleSheet) styleSheetDepth--;
      },
      Property(node) {
        if (!insideStyleSheet || styleSheetDepth < 2) return;
        const propName =
          node.key.type === 'Identifier' ? node.key.name : String((node.key as Literal).value);
        const valueNode = node.value as Expression;

        for (const checker of STYLE_PROPERTY_CHECKERS) {
          if (checker(context, propName, valueNode)) return;
        }
      },
    };
  },
};

export default enforceDesignTokens;
