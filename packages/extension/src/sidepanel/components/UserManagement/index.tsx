import { useEffect } from 'react';
import { useStore } from '../../store/index';
import type { AdminUser } from '../../../shared/types';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    padding: '16px',
  },
  header: {
    fontSize: '18px',
    fontWeight: 700 as const,
    color: '#1a202c',
  },
  loading: {
    color: '#a0aec0',
    fontSize: '14px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  userRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    backgroundColor: '#f7fafc',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    flex: 1,
  },
  email: {
    fontWeight: 600,
    color: '#1a202c',
    fontSize: '14px',
  },
  meta: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
  },
  badge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600 as const,
  },
  authorBadge: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  userBadge: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  activeBadge: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  inactiveBadge: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  button: {
    padding: '6px 12px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600 as const,
    transition: 'opacity 0.12s',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    color: '#fff',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
    color: '#fff',
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  empty: {
    color: '#a0aec0',
    textAlign: 'center' as const,
    padding: '32px 16px',
    fontSize: '14px',
  },
};

export function UserManagement() {
  const { users, userId, isLoading, loadUsers, deleteUser, activateUser, updateUserRole } = useStore();

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleDeleteUser = (id: string, email: string) => {
    if (confirm(`Deactivate ${email}? They won't be able to log in.`)) {
      deleteUser(id);
    }
  };

  const handleActivateUser = (id: string, email: string) => {
    if (confirm(`Reactivate ${email}?`)) {
      activateUser(id);
    }
  };

  const handleUpdateRole = (id: string, newRole: 'author' | 'user') => {
    const action = newRole === 'author' ? 'Make Author' : 'Revoke Author';
    if (confirm(`${action} this user?`)) {
      updateUserRole(id, newRole);
    }
  };

  if (isLoading && users.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Users</div>
        <p style={styles.loading}>Loading users…</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Users</div>
      {users.length === 0 ? (
        <div style={styles.empty}>No users yet</div>
      ) : (
        <div style={styles.list}>
          {users.map(user => (
            <div key={user.id} style={styles.userRow}>
              <div style={styles.userInfo}>
                <div style={styles.email}>{user.email}</div>
                <div style={styles.meta}>
                  <span style={{ ...styles.badge, ...(user.role === 'author' ? styles.authorBadge : styles.userBadge) }}>
                    {user.role === 'author' ? '👑 Author' : 'User'}
                  </span>
                  <span style={{ ...styles.badge, ...(user.isActive ? styles.activeBadge : styles.inactiveBadge) }}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span style={{ color: '#a0aec0', fontSize: '11px' }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div style={styles.actions}>
                {user.id !== userId && (
                  <>
                    {user.role === 'user' && (
                      <button
                        onClick={() => handleUpdateRole(user.id, 'author')}
                        style={{
                          ...styles.button,
                          ...styles.primaryButton,
                          ...(isLoading ? styles.disabledButton : {}),
                        }}
                        disabled={isLoading}
                      >
                        Make Author
                      </button>
                    )}
                    {user.role === 'author' && (
                      <button
                        onClick={() => handleUpdateRole(user.id, 'user')}
                        style={{
                          ...styles.button,
                          ...styles.primaryButton,
                          ...(isLoading ? styles.disabledButton : {}),
                        }}
                        disabled={isLoading}
                      >
                        Revoke Author
                      </button>
                    )}
                  </>
                )}
                {user.isActive && user.id !== userId && (
                  <button
                    onClick={() => handleDeleteUser(user.id, user.email)}
                    style={{
                      ...styles.button,
                      ...styles.dangerButton,
                      ...(isLoading ? styles.disabledButton : {}),
                    }}
                    disabled={isLoading}
                  >
                    Deactivate
                  </button>
                )}
                {!user.isActive && user.id !== userId && (
                  <button
                    onClick={() => handleActivateUser(user.id, user.email)}
                    style={{
                      ...styles.button,
                      ...styles.primaryButton,
                      ...(isLoading ? styles.disabledButton : {}),
                    }}
                    disabled={isLoading}
                  >
                    Activate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
