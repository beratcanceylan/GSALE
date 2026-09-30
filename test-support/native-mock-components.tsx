/**
 * Component stand-ins for React Native and Expo Router under `bun test`. Plain host
 * views are mocked as element-type strings in native-mocks; these need behaviour.
 */
import React, { type ReactNode } from 'react';

type Props = Record<string, unknown> & { children?: ReactNode };

export function Pressable(props: Props) {
  const { style, children, ...rest } = props;
  const resolvedStyle = typeof style === 'function' ? (style as (s: { pressed: boolean }) => unknown)({ pressed: true }) : style;
  const content = typeof children === 'function' ? (children as (s: { pressed: boolean }) => ReactNode)({ pressed: false }) : children;
  return React.createElement('Pressable', { ...rest, style: resolvedStyle }, content);
}

export function Modal(props: Props) {
  return props['visible'] ? React.createElement('Modal', props, props.children) : null;
}

type ListProps = Props & {
  data?: readonly unknown[] | null;
  renderItem?: (info: { item: unknown; index: number }) => ReactNode;
  keyExtractor?: (item: unknown, index: number) => string;
  ListHeaderComponent?: ReactNode;
  ListEmptyComponent?: ReactNode;
  ListFooterComponent?: ReactNode;
  refreshControl?: ReactNode;
};

export function FlatList(props: ListProps) {
  const data = props.data ?? [];
  const items = data.map((item, index) =>
    React.createElement(
      React.Fragment,
      { key: props.keyExtractor ? props.keyExtractor(item, index) : String(index) },
      props.renderItem?.({ item, index }),
    ),
  );
  return React.createElement(
    'FlatList',
    { ...props, data: undefined },
    props.ListHeaderComponent,
    items.length > 0 ? items : props.ListEmptyComponent,
    props.ListFooterComponent,
  );
}

export function ScrollView(props: ListProps) {
  return React.createElement('ScrollView', props, props.refreshControl, props.children);
}

type ScreenElementProps = { name: string; options?: Record<string, unknown>; listeners?: Record<string, () => void> };
type NavigatorProps = Props & { screenOptions?: Record<string, unknown> };

/** Screens rendered as `<name>.Screen` hosts with their options, listeners and tab icon. */
function renderNavigator(name: string, props: NavigatorProps) {
  const screens = React.Children.toArray(props.children).filter(React.isValidElement<ScreenElementProps>);
  const rendered = screens.map((screen) => {
    const options = screen.props.options ?? {};
    const icon = options['tabBarIcon'];
    return React.createElement(
      `${name}.Screen`,
      { key: screen.props.name, name: screen.props.name, options, listeners: screen.props.listeners },
      typeof icon === 'function' ? (icon as (p: object) => ReactNode)({ color: '#fff', size: 24, focused: true }) : null,
    );
  });
  return React.createElement(name, { screenOptions: props.screenOptions }, rendered);
}

export function Tabs(props: NavigatorProps) {
  return renderNavigator('Tabs', props);
}
Tabs.Screen = 'Tabs.Screen';

export function Stack(props: NavigatorProps) {
  return renderNavigator('Stack', props);
}
Stack.Screen = 'Stack.Screen';
