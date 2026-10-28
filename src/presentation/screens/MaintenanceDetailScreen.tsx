import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDemo } from '../demo/DemoProvider';
import {
  categoryLabels,
  detailId,
  formatCivilDate,
} from '../demo/presentationModels';
import {
  DataBoundary,
  EmptyState,
  Screen,
  SectionTitle,
  ui,
} from '../components/UI';
import { StatusBadge } from '../components/StatusBadge';
import { colors } from '../theme/theme';
export function MaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const { data } = useDemo();
  const item = data.maintenances.find((entry) => entry.id === detailId(id));
  const back = () =>
    router.canGoBack() ? router.back() : router.replace('/maintenance');
  return (
    <Screen
      title={item?.title ?? 'Detalhes da manutenção'}
      subtitle="Exemplo fictício · consulta do checklist"
      back={back}
    >
      <DataBoundary>
        {!item ? (
          <EmptyState
            title="Manutenção não encontrada"
            description="Este endereço não corresponde a uma manutenção da fonte de demonstração."
          />
        ) : (
          <>
            <View style={ui.card}>
              <View style={ui.between}>
                <Text style={ui.eyebrow}>
                  {categoryLabels[item.category].toUpperCase()} · ÁUDIO
                </Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={ui.heading}>{formatCivilDate(item.date)}</Text>
              <Text style={ui.muted}>{item.time} · Horário de São Paulo</Text>
              <Text style={ui.muted}>
                Dados demonstrativos. Os resultados abaixo não representam uma
                execução real.
              </Text>
            </View>
            <View style={ui.stack}>
              <SectionTitle>Checklist por equipamento</SectionTitle>
              <Text style={ui.muted}>
                Referência do catálogo de áudio · revisão 2026. Cada tarefa é
                uma verificação independente para o equipamento indicado.
              </Text>
              {item.equipment.map((equipment) => (
                <View key={equipment.id} style={ui.card}>
                  <Text accessibilityRole="header" style={ui.heading}>
                    {equipment.name}
                  </Text>
                  {equipment.checks.map((check) => (
                    <View
                      key={check.key}
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        paddingTop: 14,
                        gap: 10,
                      }}
                    >
                      <Text style={ui.body}>{check.description}</Text>
                      <StatusBadge status={check.status} />
                    </View>
                  ))}
                </View>
              ))}
            </View>
            <Text style={ui.muted}>
              Visualização somente para leitura. Preenchimento, conclusão e
              cancelamento ainda não estão conectados a armazenamento real.
            </Text>
          </>
        )}
      </DataBoundary>
    </Screen>
  );
}
