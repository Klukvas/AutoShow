import { getAboutModel } from '@/lib/storefront/about-model';
import { About } from '@theme/about';

export const revalidate = 300;

export default async function AboutPage() {
  const model = await getAboutModel();
  return <About model={model} />;
}
