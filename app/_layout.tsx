import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createPublicDemoSource } from '@/composition/publicDemo';
import { DemoProvider } from '@/presentation/demo/DemoProvider';
import { colors } from '@/presentation/theme/theme';

// Explicit composition only; loading this read-only source never provisions business records.
const demoSource = createPublicDemoSource();
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DemoProvider source={demoSource}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="maintenance/[id]" />
          <Stack.Screen name="issues/[id]" />
        </Stack>
      </DemoProvider>
    </SafeAreaProvider>
  );
}
