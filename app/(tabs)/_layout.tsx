import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabIcon } from '@/presentation/components/TabIcon';
import { tabRoutes } from '@/presentation/demo/presentationModels';
import { colors } from '@/presentation/theme/theme';
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 70 + Math.max(insets.bottom, 8),
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginTop: 4 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {tabRoutes.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ color }) => (
              <TabIcon name={tab.icon} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
