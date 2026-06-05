export type UserRole = 'warehouse' | 'viewer';

export type AuthUserInfo = {
  id: string;
  username: string;
  role: UserRole;
};

const TOKEN_KEY = 'token';
const USER_KEY = 'authUser';

export const getStoredToken = (): string | null =>
  localStorage.getItem(TOKEN_KEY);

export const getStoredUser = (): AuthUserInfo | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUserInfo;
  } catch {
    return null;
  }
};

export const getStoredRole = (): UserRole | null => {
  return getStoredUser()?.role ?? null;
};

export const saveAuth = (token: string, user: AuthUserInfo) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const roleLabel = (role: UserRole | null | undefined): string => {
  if (role === 'warehouse') return 'Thủ kho';
  if (role === 'viewer') return 'Người xem';
  return '';
};
