import { Text, View } from 'react-native';
import { colors } from '../theme/theme';
export const statusLabels = {
  scheduled: 'Programada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  pending: 'Pendente',
  resolved: 'Concluída',
  unfilled: 'Sem preenchimento',
  problem_found: 'Problema encontrado',
  not_applicable: 'Não se aplica',
} as const;
export function StatusBadge({ status }: { status: keyof typeof statusLabels }) {
  const tone =
    status === 'completed' || status === 'resolved'
      ? 'success'
      : status === 'pending' || status === 'problem_found'
        ? 'warning'
        : status === 'scheduled'
          ? 'accent'
          : 'muted';
  const foreground = colors[tone];
  const background =
    tone === 'success'
      ? colors.successSurface
      : tone === 'warning'
        ? colors.warningSurface
        : tone === 'accent'
          ? colors.accentSurface
          : colors.elevated;
  return (
    <View
      style={{
        backgroundColor: background,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <View
        accessible={false}
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: foreground,
        }}
      />
      <Text
        style={{
          color: foreground,
          fontSize: 12,
          fontWeight: '600',
          flexShrink: 1,
        }}
      >
        {statusLabels[status]}
      </Text>
    </View>
  );
}
