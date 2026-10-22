import Svg, { Circle, Path } from 'react-native-svg';

import type { MainTabParamList } from './types';

interface MainTabIconProps {
  name: keyof MainTabParamList;
  color: string;
  size: number;
  focused?: boolean;
}

/** Draw tab icons without relying on an Android system glyph or icon font. */
export function MainTabIcon({ name, color, size, focused = false }: MainTabIconProps) {
  return (
    <Svg
      accessible={false}
      pointerEvents="none"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={focused ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'Materials' ? (
        <Path d="M12 6.5C9.5 4.6 6.5 4.2 3 5v14c3.5-.8 6.5-.4 9 1.5 2.5-1.9 5.5-2.3 9-1.5V5c-3.5-.8-6.5-.4-9 1.5ZM12 6.5v14" />
      ) : name === 'Records' ? (
        <Path d="M4 3v17h17M8 16v-5m5 5V6m5 10V9" />
      ) : (
        <>
          <Circle cx="12" cy="7.5" r="3.5" />
          <Path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        </>
      )}
    </Svg>
  );
}
