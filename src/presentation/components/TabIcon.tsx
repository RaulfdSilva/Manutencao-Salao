import { Text, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { colors } from '../theme/theme';
export function TabIcon({
  name,
  color,
}: {
  name: 'home' | 'calendar' | 'issue' | 'team';
  color: ColorValue | null;
}) {
  const stroke = color ?? colors.muted;
  const line = { borderColor: stroke, borderWidth: 1.7 };
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 24, height: 24 }}
    >
      {name === 'home' ? (
        <>
          <View
            style={{
              ...line,
              width: 13,
              height: 13,
              transform: [{ rotate: '45deg' }],
              borderRightWidth: 0,
              borderBottomWidth: 0,
              position: 'absolute',
              left: 5,
              top: 1,
            }}
          />
          <View
            style={{
              ...line,
              width: 16,
              height: 14,
              position: 'absolute',
              left: 4,
              top: 8,
              borderTopWidth: 0,
              borderRadius: 2,
            }}
          />
          <View
            style={{
              ...line,
              width: 5,
              height: 8,
              borderBottomWidth: 0,
              position: 'absolute',
              left: 9,
              top: 14,
            }}
          />
        </>
      ) : name === 'calendar' ? (
        <>
          <View
            style={{
              ...line,
              width: 20,
              height: 19,
              borderRadius: 4,
              left: 2,
              top: 4,
            }}
          />
          <View
            style={{
              height: 1.7,
              backgroundColor: stroke,
              position: 'absolute',
              top: 10,
              left: 3,
              right: 3,
            }}
          />
          <View
            style={{
              width: 2,
              height: 6,
              backgroundColor: stroke,
              position: 'absolute',
              top: 1,
              left: 7,
            }}
          />
          <View
            style={{
              width: 2,
              height: 6,
              backgroundColor: stroke,
              position: 'absolute',
              top: 1,
              right: 7,
            }}
          />
        </>
      ) : name === 'issue' ? (
        <View
          style={{
            ...line,
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: stroke, fontSize: 16, fontWeight: '600' }}>
            !
          </Text>
        </View>
      ) : (
        <>
          <View
            style={{
              ...line,
              width: 9,
              height: 9,
              borderRadius: 5,
              left: 8,
              top: 1,
            }}
          />
          <View
            style={{
              ...line,
              width: 20,
              height: 10,
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              position: 'absolute',
              left: 2,
              top: 13,
            }}
          />
        </>
      )}
    </View>
  );
}
