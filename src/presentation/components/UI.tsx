import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { PropsWithChildren } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/theme';
import { useDemo } from '../demo/DemoProvider';
import type { DemoScenario } from '../demo/DemoProvider';

export const ui = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    flexShrink: 1,
  },
  heading: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '600',
    flexShrink: 1,
  },
  body: { color: colors.text, fontSize: 16, lineHeight: 24, flexShrink: 1 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  stack: { gap: 16 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
});
export function Screen({
  title,
  subtitle,
  children,
  back,
}: PropsWithChildren<{ title: string; subtitle: string; back?: () => void }>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 22,
          paddingBottom: 32,
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{ width: '100%', maxWidth: 860, alignSelf: 'center', gap: 24 }}
        >
          {back ? (
            <ActionButton label="‹  Voltar" onPress={back} secondary />
          ) : (
            <Text style={ui.eyebrow}>MANUTENÇÃO SALÃO</Text>
          )}
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="header" style={ui.title}>
              {title}
            </Text>
            <Text style={ui.muted}>{subtitle}</Text>
          </View>
          <DemoNotice />
          {children}
        </View>
      </ScrollView>
    </View>
  );
}
export function DemoNotice() {
  return (
    <View
      style={{
        borderLeftWidth: 3,
        borderLeftColor: colors.accent,
        paddingLeft: 12,
        gap: 3,
      }}
    >
      <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
        Demonstração · somente leitura
      </Text>
      <Text style={ui.muted}>Dados fictícios. Nenhuma alteração é salva.</Text>
    </View>
  );
}
export function SectionTitle({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={ui.heading}>
      {children}
    </Text>
  );
}
export function ActionButton({
  label,
  onPress,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingVertical: 13,
        paddingHorizontal: 18,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: secondary ? colors.border : colors.accent,
        backgroundColor: secondary ? colors.surface : colors.accent,
        opacity: pressed ? 0.7 : 1,
        alignSelf: 'flex-start',
      })}
    >
      <Text
        style={{
          color: secondary ? colors.text : colors.background,
          fontWeight: '600',
          fontSize: 15,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={[ui.card, { alignItems: 'center', paddingVertical: 32 }]}>
      <Text style={{ color: colors.accent, fontSize: 24 }} accessible={false}>
        ◇
      </Text>
      <Text
        accessibilityRole="header"
        style={[ui.heading, { textAlign: 'center' }]}
      >
        {title}
      </Text>
      <Text style={[ui.muted, { textAlign: 'center', maxWidth: 400 }]}>
        {description}
      </Text>
    </View>
  );
}
export function DataBoundary({ children }: PropsWithChildren) {
  const { status, reload } = useDemo();
  if (status === 'loading')
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Carregando demonstração"
        style={[ui.card, { alignItems: 'center', padding: 30 }]}
      >
        <ActivityIndicator color={colors.accent} />
        <Text style={ui.muted}>Carregando a demonstração…</Text>
      </View>
    );
  if (status === 'error')
    return (
      <View style={ui.stack}>
        <EmptyState
          title="Não foi possível carregar"
          description="A fonte de demonstração não respondeu. Tente carregar novamente."
        />
        <ActionButton label="Tentar novamente" onPress={reload} />
      </View>
    );
  return children;
}
export function DemoScenarioControl() {
  const { scenario, setScenario } = useDemo();
  const choices: readonly [DemoScenario, string][] = [
    ['examples', 'Com exemplos'],
    ['empty', 'Sem dados'],
    ['loading', 'Carregando'],
  ];
  return (
    <View style={[ui.card, { backgroundColor: colors.background }]}>
      <Text style={ui.muted}>Explorar os estados da interface</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {choices.map(([key, label]) => (
          <FilterChip
            key={key}
            label={label}
            selected={scenario === key}
            onPress={() => setScenario(key)}
          />
        ))}
      </View>
      <Text style={ui.muted}>
        Este controle altera apenas a visualização dos exemplos.
      </Text>
    </View>
  );
}
export function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        justifyContent: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: selected ? colors.accentSurface : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? colors.accent : colors.muted,
          fontWeight: selected ? '600' : '400',
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
