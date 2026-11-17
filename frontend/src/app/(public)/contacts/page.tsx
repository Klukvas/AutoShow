import { getContactsModel } from '@/lib/storefront/contacts-model';
import { Contacts } from '@theme/contacts';

export const revalidate = 300;

export default async function ContactsPage() {
  const model = await getContactsModel();
  return <Contacts model={model} />;
}
