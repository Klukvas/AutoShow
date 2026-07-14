import { redirect } from 'next/navigation';
import { adminApi } from '@/lib/api/admin';
import { requireServerToken } from '@/lib/auth/refresh';
import { TeamTable } from '@/components/admin/team/team-table';

export const dynamic = 'force-dynamic';

/** Handoff 1g — admin-only. Editors get bounced (nav already hides it). */
export default async function AdminTeamPage() {
  const auth = await requireServerToken('/admin/team');
  if (auth.session.user.role !== 'admin') redirect('/admin/listings');

  const users = await adminApi.listUsers({ accessToken: auth.accessToken });

  return (
    <div className="mx-auto max-w-[760px]">
      <TeamTable users={users} currentUserId={auth.session.user.id} />
    </div>
  );
}
