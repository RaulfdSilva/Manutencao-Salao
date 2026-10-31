import { createPublicDemoSource } from '@/composition/publicDemo';
export { ProblemDetailScreen as default } from '@/presentation/screens/ProblemDetailScreen';

export async function generateStaticParams() {
  const data = await createPublicDemoSource().load();
  return data.problems.map((item) => ({ id: item.id }));
}
