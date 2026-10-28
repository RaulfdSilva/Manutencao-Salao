import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDemo } from '../demo/DemoProvider';
import { maintenanceHref, nextMaintenance } from '../demo/presentationModels';
import {
  ActionButton,
  DataBoundary,
  DemoScenarioControl,
  EmptyState,
  Screen,
  SectionTitle,
  ui,
} from '../components/UI';
import { MaintenanceCard } from '../components/PreviewCards';
import { colors } from '../theme/theme';

export function HomeScreen() {
  const { data } = useDemo();
  const router = useRouter();
  const next = nextMaintenance(data.maintenances);
  const openProblems = data.problems.filter(
    (p) => p.status === 'pending',
  ).length;
  return (
    <Screen
      title="Olá, seja bem-vindo."
      subtitle="Cuidar do salão é um trabalho em equipe."
    >
      <DataBoundary>
        <View style={ui.stack}>
          <SectionTitle>Próxima manutenção no exemplo</SectionTitle>
          {next ? (
            <MaintenanceCard
              item={next}
              onPress={() => router.push(maintenanceHref(next.id))}
            />
          ) : (
            <EmptyState
              title="Nenhuma manutenção programada"
              description="As próximas manutenções aparecerão aqui quando houver dados disponíveis."
            />
          )}
        </View>
        <View style={[ui.card, { backgroundColor: colors.accentSurface }]}>
          <Text style={ui.eyebrow}>ACOMPANHAMENTO TÉCNICO</Text>
          <View style={ui.row}>
            <Text
              style={{ color: colors.text, fontSize: 36, fontWeight: '700' }}
            >
              {openProblems}
            </Text>
            <Text style={ui.body}>
              {openProblems === 1
                ? 'pendência aberta no exemplo'
                : 'pendências abertas no exemplo'}
            </Text>
          </View>
          <Text style={ui.muted}>
            Problemas técnicos para acompanhar, sem avaliação individual.
          </Text>
          <ActionButton
            label="Consultar pendências"
            onPress={() => router.push('/issues')}
            secondary
          />
        </View>
        <View style={ui.stack}>
          <SectionTitle>Encontre o que precisa</SectionTitle>
          <View style={[ui.card, ui.between]}>
            <View style={{ flex: 1, minWidth: 150, gap: 6 }}>
              <Text style={ui.heading}>Programação de áudio</Text>
              <Text style={ui.muted}>
                Veja as datas e explore os checklists por equipamento.
              </Text>
            </View>
            <ActionButton
              label="Ver manutenções"
              onPress={() => router.push('/maintenance')}
            />
          </View>
        </View>
      </DataBoundary>
      <DemoScenarioControl />
    </Screen>
  );
}
