'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Agent {
  id: string;
  name: string;
  phone: string;
  code: string;
  city: string;
  country: string;
  isActive: boolean;
  createdAt: string;
}

interface GlobalStats {
  agents: { total: number; active: number };
  stores: { total: number };
  subscription: Record<string, number>;
  topCities: Array<{ _id: string; count: number }>;
}

interface Store {
  storeId: string;
  storeName: string;
  phone: string;
  city: string;
  agentCode: string;
  subscriptionStatus: string;
  lastActiveAt: string;
}

export default function AdminDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/admin/login');
      return;
    }

    fetchAgents();
    fetchGlobalStats();
  }, []);

  const fetchGlobalStats = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setGlobalStats(data);
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const fetchAgents = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_URL}/admin/agents?approved=true&status=all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentStores = async (agentCode: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_URL}/admin/stores?agentCode=${agentCode}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setStores(data.stores || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAgent = (agentCode: string) => {
    setSelectedAgent(agentCode);
    fetchAgentStores(agentCode);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminPhone');
    router.push('/admin/login');
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: '#10b981',
      trial: '#f59e0b',
      grace: '#f97316',
      expired: '#ef4444',
    };
    return colors[status] || '#9ca3af';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Active',
      trial: 'Trial',
      grace: 'Grace',
      expired: 'Expirée',
      unused: 'Non utilisée',
    };
    return labels[status] || status;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const filteredAgents = agents.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.phone.includes(search) ||
    a.code.toLowerCase().includes(search.toLowerCase()) ||
    a.city.toLowerCase().includes(search.toLowerCase())
  );

  const filteredStores = stores.filter(s => 
    s.storeName.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search) ||
    s.city.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    totalAgents: globalStats?.agents.total || 0,
    activeAgents: globalStats?.agents.active || 0,
    totalStores: globalStats?.stores.total || stores.length,
    activeStores: globalStats?.subscription.active || stores.filter(s => s.subscriptionStatus === 'active').length,
    trialStores: globalStats?.subscription.trial || stores.filter(s => s.subscriptionStatus === 'trial').length,
    expiredStores: globalStats?.subscription.expired || stores.filter(s => s.subscriptionStatus === 'expired').length,
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>VocoShop</div>
          <span style={styles.badge}>Admin</span>
        </div>
        <nav style={styles.nav}>
          <a href="/admin/candidatures" style={styles.navLink}>Candidatures</a>
          <a href="/admin/dashboard" style={{...styles.navLink, ...styles.navLinkActive}}>Dashboard</a>
        </nav>
        <div style={styles.headerRight}>
          <button style={styles.logoutBtn} onClick={handleLogout}>Déconnexion</button>
        </div>
      </header>

      <main style={styles.main}>
        <h1 style={styles.pageTitle}>Dashboard Global</h1>

        {/* Stats */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalAgents}</div>
            <div style={styles.statLabel}>Agents</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.activeAgents}</div>
            <div style={styles.statLabel}>Actifs</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalStores}</div>
            <div style={styles.statLabel}>Boutiques</div>
          </div>
          <div style={styles.statCard}>
            <div style={{...styles.statValue, color: '#10b981'}}>{stats.activeStores}</div>
            <div style={styles.statLabel}>Actives</div>
          </div>
          <div style={styles.statCard}>
            <div style={{...styles.statValue, color: '#f59e0b'}}>{stats.trialStores}</div>
            <div style={styles.statLabel}>Trial</div>
          </div>
          <div style={styles.statCard}>
            <div style={{...styles.statValue, color: '#ef4444'}}>{stats.expiredStores}</div>
            <div style={styles.statLabel}>Expirées</div>
          </div>
        </div>

        <div style={styles.contentGrid}>
          {/* Agents List */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Agents</h2>
              <span style={styles.count}>{filteredAgents.length}</span>
            </div>
            
            <input
              type="text"
              style={styles.searchInput}
              placeholder="Rechercher un agent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div style={styles.list}>
              {filteredAgents.map((agent) => (
                <div 
                  key={agent.id} 
                  style={{
                    ...styles.listItem,
                    ...(selectedAgent === agent.code ? styles.listItemActive : {}),
                  }}
                  onClick={() => handleSelectAgent(agent.code)}
                >
                  <div style={styles.listItemAvatar}>
                    {(agent.name).charAt(0).toUpperCase()}
                  </div>
                  <div style={styles.listItemInfo}>
                    <div style={styles.listItemName}>{agent.name}</div>
                    <div style={styles.listItemMeta}>{agent.code} • {agent.city}</div>
                  </div>
                  <div style={{
                    ...styles.statusDot,
                    background: agent.isActive ? '#10b981' : '#9ca3af',
                  }} />
                </div>
              ))}
            </div>
          </div>

          {/* Stores List */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>
                {selectedAgent 
                  ? `Boutiques de l'agent ${selectedAgent}` 
                  : 'Sélectionnez un agent'}
              </h2>
              <span style={styles.count}>{filteredStores.length}</span>
            </div>

            {!selectedAgent ? (
              <div style={styles.emptyMessage}>
                Cliquez sur un agent pour voir ses boutiques
              </div>
            ) : loading ? (
              <div style={styles.loading}>Chargement...</div>
            ) : filteredStores.length === 0 ? (
              <div style={styles.emptyMessage}>Aucune boutique trouvée</div>
            ) : (
              <div style={styles.storeGrid}>
                {filteredStores.map((store) => (
                  <div key={store.storeId} style={styles.storeCard}>
                    <div style={styles.storeHeader}>
                      <div style={styles.storeName}>{store.storeName}</div>
                      <div style={{
                        ...styles.storeStatus,
                        background: getStatusColor(store.subscriptionStatus) + '20',
                        color: getStatusColor(store.subscriptionStatus),
                      }}>
                        {getStatusLabel(store.subscriptionStatus)}
                      </div>
                    </div>
                    <div style={styles.storeMeta}>
                      {store.phone} • {store.city}
                    </div>
                    <div style={styles.storeLastActive}>
                      Dernière activité: {formatDate(store.lastActiveAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#f8f9fc',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    background: 'white',
    borderBottom: '1px solid #e5e7eb',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#6b4cdb',
  },
  badge: {
    background: '#6b4cdb',
    color: 'white',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
  },
  nav: {
    display: 'flex',
    gap: '8px',
  },
  navLink: {
    padding: '8px 16px',
    borderRadius: '8px',
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
  },
  navLinkActive: {
    background: '#f3f4f6',
    color: '#111827',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid #e5e7eb',
    padding: '8px 16px',
    borderRadius: '8px',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: '14px',
  },
  main: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 24px 0',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '4px',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '350px 1fr',
    gap: '24px',
  },
  section: {
    background: 'white',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
  },
  count: {
    background: '#f3f4f6',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    color: '#6b7280',
  },
  searchInput: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    fontSize: '14px',
    marginBottom: '16px',
    boxSizing: 'border-box',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '500px',
    overflowY: 'auto',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  listItemActive: {
    background: '#f3f4f6',
  },
  listItemAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: '#6b4cdb',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: '600',
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
  },
  listItemMeta: {
    fontSize: '12px',
    color: '#6b7280',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  emptyMessage: {
    textAlign: 'center',
    padding: '40px',
    color: '#9ca3af',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280',
  },
  storeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
  },
  storeCard: {
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
  },
  storeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  storeName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#111827',
  },
  storeStatus: {
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
  },
  storeMeta: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '4px',
  },
  storeLastActive: {
    fontSize: '12px',
    color: '#9ca3af',
  },
};
