import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDemo } from '../demo/DemoProvider';
import {
  detailId,
  formatCivilDate,
  maintenanceHref,
} from '../demo/presentationModels';
import {
  ActionButton,
  DataBoundary,
  EmptyState,
  Screen,
  SectionTitle,
  ui,
} from '../components/UI';
import { StatusBadge } from '../components/StatusBadge';
export function ProblemDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const { data } = useDemo();
  const item = data.problems.find((entry) => entry.id === detailId(id));
  const back = () =>
    router.canGoBack() ? router.back() : router.replace('/issues');
  return (
    <Screen
      title="Detalhes da pendência"
      subtitle="Registro técnico fictício · somente leitura"
      back={back}
    >
      <DataBoundary>
        {!item ? (
          <EmptyState
            title="Pendência não encontrada"
            description="Este endereço não corresponde a um problema da fonte de demonstração."
          />
        ) : (
          <>
            <View style={ui.card}>
              <StatusBadge status={item.status} />
              <Text accessibilityRole="header" style={ui.heading}>
                {item.equipmentName}
              </Text>
              <Text style={ui.body}>{item.description}</Text>
            </View>
            <View style={ui.card}>
              <SectionTitle>Origem do registro</SectionTitle>
              <Text style={ui.muted}>Verificação do catálogo</Text>
              <Text style={ui.body}>{item.verificationDescription}</Text>
              <Text style={ui.muted}>
                Data no exemplo: {formatCivilDate(item.recordedOn)}
              </Text>
              <ActionButton
                label="Ver manutenção de origem"
                onPress={() => router.push(maintenanceHref(item.maintenanceId))}
                secondary
              />
            </View>
            <Text style={ui.muted}>
              A resolução não está disponível nesta demonstração. Nenhum
              reparador é atribuído e nenhuma alteração é salva.
            </Text>
          </>
        )}
      </DataBoundary>
    </Screen>
  );
}
