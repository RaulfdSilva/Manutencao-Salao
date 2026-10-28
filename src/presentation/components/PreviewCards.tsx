import { Pressable, Text, View } from 'react-native';
import type {
  MaintenancePreview,
  ProblemPreview,
  TeamPreview,
} from '../demo/PresentationSource';
import {
  categoryLabels,
  dateTile,
  formatCivilDate,
  roleLabels,
} from '../demo/presentationModels';
import { colors } from '../theme/theme';
import { ui } from './UI';
import { StatusBadge } from './StatusBadge';
export function MaintenanceCard({
  item,
  onPress,
}: {
  item: MaintenancePreview;
  onPress: () => void;
}) {
  const tile = dateTile(item.date);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${formatCivilDate(item.date)}, ${item.status === 'scheduled' ? 'programada' : item.status === 'completed' ? 'concluída' : 'cancelada'}. Ver detalhes`}
      onPress={onPress}
      style={({ pressed }) => [ui.card, { opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={ui.row}>
        <View
          accessible={false}
          style={{
            width: 58,
            minHeight: 68,
            backgroundColor: colors.elevated,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 25, fontWeight: '700' }}>
            {tile.day}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1 }}>
            {tile.month}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={ui.eyebrow}>
            ÁUDIO · {categoryLabels[item.category].toUpperCase()}
          </Text>
          <Text style={[ui.heading, { fontSize: 17 }]}>{item.title}</Text>
          <Text style={ui.muted}>{item.time} · Exemplo fictício</Text>
        </View>
        <Text accessible={false} style={{ color: colors.accent, fontSize: 24 }}>
          ›
        </Text>
      </View>
      <View style={ui.between}>
        <StatusBadge status={item.status} />
        <Text style={ui.muted}>{formatCivilDate(item.date)}</Text>
      </View>
    </Pressable>
  );
}
export function ProblemCard({
  item,
  onPress,
}: {
  item: ProblemPreview;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.description} Ver detalhes técnicos`}
      onPress={onPress}
      style={({ pressed }) => [ui.card, { opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={ui.between}>
        <Text style={ui.eyebrow}>{item.equipmentName.toUpperCase()}</Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={ui.body}>{item.description}</Text>
      <Text style={ui.muted}>Ver detalhes técnicos ›</Text>
    </Pressable>
  );
}
export function TeamCard({ item }: { item: TeamPreview }) {
  return (
    <View style={[ui.card, ui.row]}>
      <View
        accessible={false}
        style={{
          width: 46,
          height: 46,
          backgroundColor: colors.accentSurface,
          borderRadius: 23,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.accent, fontSize: 18 }}>
          {item.name.slice(0, 1)}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[ui.heading, { fontSize: 16 }]}>{item.name}</Text>
        <Text style={ui.muted}>{roleLabels[item.role]}</Text>
      </View>
    </View>
  );
}
