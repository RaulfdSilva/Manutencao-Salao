import { createPublicDemoSource } from '@/composition/publicDemo';
export { MaintenanceDetailScreen as default } from '@/presentation/screens/MaintenanceDetailScreen';

export async function generateStaticParams() {
  const data = await createPublicDemoSource().load();
  return data.maintenances.map((item) => ({ id: item.id }));
}
