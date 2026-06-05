import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuthHeaders, getStoredUser, roleLabel, type UserRole } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

type UserRow = {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function Users() {
  const me = getStoredUser();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<{ username: string; password: string; role: UserRole }>({
    username: '',
    password: '',
    role: 'viewer',
  });
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetPwd, setResetPwd] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/users`, { headers: getAuthHeaders() });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Không thể tải danh sách');
      }
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Lỗi tạo user');
      setShowCreate(false);
      setCreateForm({ username: '', password: '', role: 'viewer' });
      await fetchUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Lỗi');
    }
  };

  const handleChangeRole = async (user: UserRow, role: UserRole) => {
    if (role === user.role) return;
    try {
      const res = await fetch(`${API_BASE}/users/${user.id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Lỗi');
      await fetchUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Lỗi');
    }
  };

  const handleToggleActive = async (user: UserRow) => {
    try {
      const res = await fetch(`${API_BASE}/users/${user.id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Lỗi');
      await fetchUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Lỗi');
    }
  };

  const handleDelete = async (user: UserRow) => {
    if (!window.confirm(`Xoá user "${user.username}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/users/${user.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || 'Lỗi');
      await fetchUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Lỗi');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    try {
      const res = await fetch(`${API_BASE}/users/${resetTarget.id}/reset-password`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPwd }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Lỗi');
      alert('Đã đặt lại mật khẩu');
      setResetTarget(null);
      setResetPwd('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Lỗi');
    }
  };

  return (
    <main className="inventory-app">
      <header className="header">
        <div>
          <p className="eyebrow">User Management</p>
          <h1>Quản lý người dùng</h1>
          <p className="subtitle">Tạo, phân quyền và quản lý tài khoản hệ thống.</p>
        </div>
        <div className="header-right">
          <Link to="/inventory" className="ghost-btn">← Tồn kho</Link>
        </div>
      </header>

      <section className="panel">
        <div className="toolbar">
          <div></div>
          <div className="toolbar-actions">
            <button type="button" onClick={() => setShowCreate(true)}>+ Tạo user mới</button>
          </div>
        </div>
      </section>

      {loading && <p>Đang tải...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && !error && (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th>Tác vụ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = me?.id === u.id;
                return (
                  <tr key={u.id}>
                    <td>{u.username}{isSelf && ' (bạn)'}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => void handleChangeRole(u, e.target.value as UserRole)}
                        disabled={isSelf}
                      >
                        <option value="warehouse">Thủ kho</option>
                        <option value="viewer">Người xem</option>
                      </select>
                    </td>
                    <td>
                      <span style={{ color: u.isActive ? 'green' : '#999' }}>
                        {u.isActive ? 'Đang hoạt động' : 'Đã khoá'}
                      </span>
                    </td>
                    <td>{new Date(u.createdAt).toLocaleString('vi-VN')}</td>
                    <td className="action-cell">
                      <button type="button" onClick={() => setResetTarget(u)}>Reset MK</button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => void handleToggleActive(u)}
                        disabled={isSelf}
                      >
                        {u.isActive ? 'Khoá' : 'Mở khoá'}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => void handleDelete(u)}
                        disabled={isSelf}
                        style={{ color: 'red' }}
                      >
                        Xoá
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {showCreate && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowCreate(false)}>
          <section className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Tạo user</p>
                <h2>Tạo user mới</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form onSubmit={handleCreate} className="item-form grid-form">
              <div className="field-group">
                <label>Username *</label>
                <input
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  required
                />
              </div>
              <div className="field-group">
                <label>Mật khẩu *</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                  minLength={4}
                />
              </div>
              <div className="field-group">
                <label>Vai trò *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                >
                  <option value="viewer">Người xem</option>
                  <option value="warehouse">Thủ kho</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="ghost-btn" onClick={() => setShowCreate(false)}>Hủy</button>
                <button type="submit">Tạo</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {resetTarget && (
        <div className="modal-backdrop" role="presentation" onClick={() => setResetTarget(null)}>
          <section className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Reset mật khẩu</p>
                <h2>Đặt lại mật khẩu: {resetTarget.username}</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setResetTarget(null)}>×</button>
            </div>
            <form onSubmit={handleResetPassword} className="item-form grid-form">
              <div className="field-group">
                <label>Mật khẩu mới *</label>
                <input
                  type="password"
                  value={resetPwd}
                  onChange={(e) => setResetPwd(e.target.value)}
                  required
                  minLength={4}
                  autoFocus
                />
              </div>
              <div className="form-actions">
                <button type="button" className="ghost-btn" onClick={() => setResetTarget(null)}>Hủy</button>
                <button type="submit">Đặt lại</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

// Helper export để App.tsx render badge role
export function RoleBadge() {
  const u = getStoredUser();
  if (!u) return null;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      background: u.role === 'warehouse' ? '#1976d2' : '#888',
      color: 'white',
      fontSize: 12,
      marginLeft: 8,
    }}>
      {roleLabel(u.role)}
    </span>
  );
}
