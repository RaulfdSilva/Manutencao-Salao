import { Text, View } from 'react-native';
import { useDemo } from '../demo/DemoProvider';
import { DataBoundary, EmptyState, Screen, ui } from '../components/UI';
import { TeamCard } from '../components/PreviewCards';
export function TeamScreen() {
  const { data } = useDemo();
  return (
    <Screen title="Equipe" subtitle="Conheça os papéis dos membros ativos.">
      <DataBoundary>
        <View style={ui.stack}>
          {data.team.length ? (
            <>
              <Text style={ui.eyebrow}>CADASTROS FICTÍCIOS</Text>
              {data.team.map((item) => (
                <TeamCard key={item.id} item={item} />
              ))}
              <Text style={ui.muted}>
                Esta lista demonstra apenas nomes e funções. Não representa
                pessoas ou uma sessão autenticada.
              </Text>
            </>
          ) : (
            <EmptyState
              title="Nenhum membro para exibir"
              description="Os membros ativos e seus papéis aparecerão nesta lista."
            />
          )}
        </View>
      </DataBoundary>
    </Screen>
  );
}
