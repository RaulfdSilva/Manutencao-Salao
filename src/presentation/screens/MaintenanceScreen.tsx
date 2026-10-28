import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDemo } from '../demo/DemoProvider';
import { maintenanceHref } from '../demo/presentationModels';
import {
  DataBoundary,
  EmptyState,
  FilterChip,
  Screen,
  ui,
} from '../components/UI';
import { MaintenanceCard } from '../components/PreviewCards';
import type { MaintenancePreview } from '../demo/PresentationSource';
export function MaintenanceScreen() {
  const { data } = useDemo();
  const router = useRouter();
  const [filter, setFilter] = useState<MaintenancePreview['status'] | 'all'>(
    'all',
  );
  const options = [
    ['all', 'Todas'],
    ['scheduled', 'Programadas'],
    ['completed', 'Concluídas'],
    ['cancelled', 'Canceladas'],
  ] as const;
  const items = data.maintenances.filter(
    (item) => filter === 'all' || item.status === filter,
  );
  return (
    <Screen
      title="Manutenções"
      subtitle="Programação e cuidados com os equipamentos de áudio."
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
              <MaintenanceCard
                key={item.id}
                item={item}
                onPress={() => router.push(maintenanceHref(item.id))}
              />
            ))
          ) : (
            <EmptyState
              title="Nenhuma manutenção por aqui"
              description="Não há manutenções para esta seleção. As datas aparecerão nesta lista."
            />
          )}
        </View>
      </DataBoundary>
    </Screen>
  );
}
