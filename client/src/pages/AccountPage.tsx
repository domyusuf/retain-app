import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
export function AccountPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <h1>Your account</h1>
        </div>
      </div>
      <section className="profile-panel account-profile" aria-labelledby="profile-title">
        <div className="panel-heading">
          <h2 id="profile-title">Your profile</h2>
          <ShieldCheck size={20} />
        </div>
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Email address</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Account type</dt>
            <dd>
              <span className="role-badge">
                {user.role === 'admin' ? 'Administrator' : 'Personal account'}
              </span>
            </dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>
              {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
                new Date(user.createdAt),
              )}
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
