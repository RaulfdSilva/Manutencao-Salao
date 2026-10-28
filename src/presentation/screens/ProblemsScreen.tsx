import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDemo } from '../demo/DemoProvider';
import { problemHref } from '../demo/presentationModels';
import {
  DataBoundary,
  EmptyState,
  FilterChip,
  Screen,
  ui,
} from '../components/UI';
import { ProblemCard } from '../components/PreviewCards';
import type { ProblemPreview } from '../demo/PresentationSource';
export function ProblemsScreen() {
  const { data } = useDemo();
  const router = useRouter();
  const [filter, setFilter] = useState<ProblemPreview['status'] | 'all'>('all');
  const options = [
    ['all', 'Todas'],
    ['pending', 'Pendentes'],
    ['resolved', 'Concluídas'],
  ] as const;
  const items = data.problems.filter(
    (item) => filter === 'all' || item.status === filter,
  );
  return (
    <Screen
      title="Pendências"
      subtitle="Problemas técnicos e seu histórico de resolução."
    >
      <DataBoundary>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {options.map(([key, label]) => (
            <FilterChip
              key={key}
              label={label}
              selected={filter === key}
              onPress={() => setFilter(key)}
            />
          ))}
        </View>
        <View style={ui.stack}>
          {items.length ? (
            items.map((item) => (
              <ProblemCard
                key={item.id}
                item={item}
                onPress={() => router.push(problemHref(item.id))}
              />
            ))
          ) : (
            <EmptyState
              title="Nenhuma pendência nesta seleção"
              description="Os problemas registrados durante os checklists aparecerão aqui."
            />
          )}
        </View>
      </DataBoundary>
    </Screen>
  );
}
