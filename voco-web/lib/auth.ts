export function clearAuth(role: 'admin' | 'manager' | 'agent') {
  if (role === 'admin') {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    document.cookie = 'adminToken=; path=/; max-age=0';
  } else if (role === 'manager') {
    localStorage.removeItem('managerToken');
    localStorage.removeItem('managerInfo');
    document.cookie = 'managerToken=; path=/; max-age=0';
  } else if (role === 'agent') {
    localStorage.removeItem('agentToken');
    localStorage.removeItem('agentData');
    localStorage.removeItem('agentInfo');
    document.cookie = 'agentToken=; path=/; max-age=0';
  }
}

export function setAuthCookie(role: 'admin' | 'manager' | 'agent', token: string) {
  const cookieName = role === 'admin' ? 'adminToken' : role === 'manager' ? 'managerToken' : 'agentToken';
  document.cookie = `${cookieName}=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
}
