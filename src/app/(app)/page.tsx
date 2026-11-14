// Purpose: the role home. It only redirects: no session to sign-in, forced change to the password page, else the role home.
// Rules: spec S01 section 2 and the dispatch note: `/` never answers 404.
import { redirect } from 'next/navigation';
import { FORCED_CHANGE_PATH, roleHome } from '@/domain/auth/rules';
import { getSession } from '@/lib/auth/session';

export default async function RoleHomePage() {
  const session = await getSession();
  if (session === null) redirect('/sign-in');
  if (session.mustChangePassword) redirect(FORCED_CHANGE_PATH);
  redirect(roleHome(session.role));
}
