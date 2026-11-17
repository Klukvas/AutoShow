'use client';

import { useCompareModel } from '@/lib/storefront/use-compare-model';
import { Compare } from '@theme/compare';

// A client page: the model is browser state (saved slugs, client-side loading) with
// callbacks, which a server component could not hand to the theme's view.
export default function ComparePage() {
  const model = useCompareModel();
  return <Compare model={model} />;
}
