import { expect, it } from 'vitest';
import { getStorefrontPresentation } from '../../components/home/presentation/registry';
import {
  CinematicInventoryCard,
  DetailedInventoryCard,
} from '../../components/home/presentation/inventory-card';

it('keeps the current approved card and selects a variant without duplicating the homepage model/view', () => {
  const current = getStorefrontPresentation('current');
  const compact = getStorefrontPresentation('compact');
  expect(current.InventoryCard).toBe(CinematicInventoryCard);
  expect(compact.InventoryCard).toBe(DetailedInventoryCard);
  expect(compact.Home).toBe(current.Home);
});
