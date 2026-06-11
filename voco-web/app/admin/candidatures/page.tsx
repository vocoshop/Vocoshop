'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return size;
}

function useIsMobile() {
  const { width } = useWindowSize();
  return width < 768;
}

interface Candidate {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  country: string;
  gender: string;
  birthDate: string;
  idType: string;
  idNumber: string;
  idPhotoPath?: string;
  selfiePhotoPath?: string;
  createdAt: string;
}

export default function Candidatures() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [approved, setApproved] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [successData, setSuccessData] = useState<{code: string; authCode: string; phone: string; name: string} | null>(null);
  const isMobile = useIsMobile();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/admin/login');
      return;
    }
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [pendingRes, approvedRes] = await Promise.all([
        fetch(`${API_URL}/admin/agents?approved=pending`, { headers }),
        fetch(`${API_URL}/admin/agents?approved=true`, { headers }),
      ]);

      const pendingData = await pendingRes.json();
      const approvedData = await approvedRes.json();

      setCandidates(pendingData.agents || []);
      setApproved(approvedData.agents || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_URL}/admin/agents/${id}/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ sendSms: true }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessData({
          code: data.agent?.code || '',
          authCode: data.authCode || '',
          phone: data.agent?.phone || '',
          name: `${data.agent?.firstName || ''} ${data.agent?.name || ''}`,
        });
        fetchData();
      } else {
        alert(data.error || 'Erreur');
      }
    } catch (err) {
      alert('Erreur de connexion');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string, name: string) => {
    const reason = prompt(`Raison du refus pour ${name}:`, '');
    
    if (reason === null) return;
    
    setActionLoading(id);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_URL}/admin/agents/${id}/reject`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ reason: reason || '', sendSms: true }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`✗ Candidature rejetée. ${data.smsSent ? 'SMS envoyé.' : ''}`);
        fetchData();
      } else {
        alert(data.error || 'Erreur');
      }
    } catch (err) {
      alert('Erreur de connexion');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminPhone');
    router.push('/admin/login');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getIdTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      cni: 'CNI',
      passport: 'Passeport',
      driver_license: 'Permis',
      voter_card: 'Carte électorale',
      other: 'Autre',
    };
    return labels[type] || type;
  };

  const getGenderLabel = (gender: string) => {
    const labels: Record<string, string> = {
      male: 'Homme',
      female: 'Femme',
      other: 'Autre',
    };
    return labels[gender] || gender;
  };

  const currentList = filter === 'pending' ? candidates : approved;
  const filteredList = currentList.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{...styles.container, flexDirection: isMobile ? 'column' : 'row'}}>
      {isMobile && mobileMenuOpen && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99}} onClick={() => setMobileMenuOpen(false)}></div>
      )}
      <aside style={{
        ...styles.sidebar, 
        width: isMobile ? '100%' : '260px',
        position: isMobile ? (mobileMenuOpen ? 'fixed' : 'absolute') : 'relative',
        left: isMobile ? (mobileMenuOpen ? 0 : '-100%') : 0,
        height: isMobile ? 'auto' : '100vh',
        zIndex: 100,
      }}>
        <div style={styles.logoSection}>
          <div style={styles.logo}>⚡ VocoShop</div>
        </div>
        <nav style={styles.nav}>
          <button style={styles.navItem} onClick={() => router.push('/super-admin/dashboard')}>
            <span style={styles.navIcon}>📊</span> Dashboard
          </button>
          <button style={{...styles.navItem, ...styles.navItemActive}}>
            <span style={styles.navIcon}>📋</span> Candidatures
          </button>
          <button style={styles.navItem} onClick={() => router.push('/admin/stores')}>
            <span style={styles.navIcon}>🏪</span> Boutiques
          </button>
        </nav>
        <div style={styles.sidebarFooter}>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            <span>🚪</span> Déconnexion
          </button>
        </div>
      </aside>

      {isMobile && (
        <div style={{...styles.topBar, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #27272a', background: '#111113'}}>
          <button style={{background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer'}} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>☰</button>
          <span style={{fontSize: '18px', fontWeight: '700', color: '#6b4cdb'}}>⚡ VocoShop</span>
          <div style={{width: '40px'}}></div>
        </div>
      )}

      <main style={{
        ...styles.main, 
        marginLeft: isMobile ? 0 : '260px',
        padding: isMobile ? '16px' : '32px',
      }}>
        <header style={{...styles.topBar, display: isMobile ? 'none' : 'block'}}>
          <div>
            <h1 style={styles.pageTitle}>Gestion des Candidatures</h1>
            <p style={styles.subtitle}>Approuvez ou rejetez les demandes d'agents</p>
          </div>
        </header>

        <div style={{...styles.controls, flexDirection: isMobile ? 'column' : 'row'}}>
          <div style={{...styles.searchBox, width: isMobile ? '100%' : 'auto', flex: isMobile ? 'none' : 1}}>
            <span style={styles.searchIcon}>🔍</span>
            <input 
              type="text" 
              placeholder="Rechercher par nom, téléphone, ville..." 
              style={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={styles.filterTabs}>
            <button 
              style={{...styles.filterTab, ...(filter === 'pending' ? styles.filterTabActive : {})}}
              onClick={() => setFilter('pending')}
            >
              ⏳ En attente <span style={styles.badgeCount}>{candidates.length}</span>
            </button>
            <button 
              style={{...styles.filterTab, ...(filter === 'approved' ? styles.filterTabActive : {})}}
              onClick={() => setFilter('approved')}
            >
              ✅ Approuvés <span style={styles.badgeCount}>{approved.length}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div style={styles.loading}>
            <div style={styles.spinner}></div>
            <p>Chargement...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>📭</div>
            <h3>Aucune candidature</h3>
            <p>{searchTerm ? 'Aucun résultat pour cette recherche' : filter === 'pending' ? 'Aucune candidature en attente' : 'Aucun agent approuvé'}</p>
          </div>
        ) : (
          <>
          <div style={{...styles.stats, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : '16px'}}>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{candidates.length}</span>
              <span style={styles.statLabel}>En attente</span>
            </div>
            <div style={{...styles.statCard, borderColor: '#10b981'}}>
              <span style={{...styles.statValue, color: '#10b981'}}>{approved.length}</span>
              <span style={styles.statLabel}>Approuvés</span>
            </div>
          </div>
          <div style={isMobile ? styles.gridMobile : styles.grid}>
            {filteredList.map((candidate) => (
              <div key={candidate.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={styles.avatar}>
                    {(candidate.firstName || candidate.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={styles.cardInfo}>
                    <div style={styles.cardName}>{candidate.firstName} {candidate.lastName}</div>
                    <div style={styles.cardPhone}>📱 {candidate.phone}</div>
                  </div>
                  <button 
                    style={styles.viewBtn}
                    onClick={() => { setSelectedCandidate(candidate); setShowModal(true); }}
                  >
                    👁
                  </button>
                </div>

                <div style={styles.cardDetails}>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>📍 Ville:</span>
                    <span style={styles.detailValue}>{candidate.city || '-'}, {candidate.country || '-'}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>🎂 Né(e) le:</span>
                    <span style={styles.detailValue}>{formatDate(candidate.birthDate)}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>⚤ Genre:</span>
                    <span style={styles.detailValue}>{getGenderLabel(candidate.gender)}</span>
                  </div>
                  {candidate.idType && (
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>🪪 Pièce:</span>
                      <span style={styles.detailValue}>
                        {getIdTypeLabel(candidate.idType)} - {candidate.idNumber}
                      </span>
                    </div>
                  )}
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>📅 Date:</span>
                    <span style={styles.detailValue}>{formatDate(candidate.createdAt)}</span>
                  </div>
                </div>

                {filter === 'pending' && (
                  <div style={styles.cardActions}>
                    <button 
                      style={{...styles.approveBtn}}
                      onClick={() => handleApprove(candidate.id)}
                      disabled={actionLoading === candidate.id}
                    >
                      {actionLoading === candidate.id ? '⏳' : '✓'} Approuver
                    </button>
                    <button 
                      style={{...styles.rejectBtn}}
                      onClick={() => handleReject(candidate.id, `${candidate.firstName} ${candidate.lastName}`)}
                      disabled={actionLoading === candidate.id}
                    >
                      ✗ Rejeter
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          </>
        )}
      </main>

      {showModal && selectedCandidate && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2>Détails du candidat</h2>
              <button style={styles.closeBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.modalSection}>
                <h3>Informations personnelles</h3>
                <div style={styles.modalGrid}>
                  <div style={styles.modalItem}>
                    <span style={styles.modalLabel}>Nom complet</span>
                    <span style={styles.modalValue}>{selectedCandidate.firstName} {selectedCandidate.lastName}</span>
                  </div>
                  <div style={styles.modalItem}>
                    <span style={styles.modalLabel}>Téléphone</span>
                    <span style={styles.modalValue}>{selectedCandidate.phone}</span>
                  </div>
                  <div style={styles.modalItem}>
                    <span style={styles.modalLabel}>Genre</span>
                    <span style={styles.modalValue}>{getGenderLabel(selectedCandidate.gender)}</span>
                  </div>
                  <div style={styles.modalItem}>
                    <span style={styles.modalLabel}>Date de naissance</span>
                    <span style={styles.modalValue}>{formatDate(selectedCandidate.birthDate)}</span>
                  </div>
                </div>
              </div>
              <div style={styles.modalSection}>
                <h3>Localisation</h3>
                <div style={styles.modalGrid}>
                  <div style={styles.modalItem}>
                    <span style={styles.modalLabel}>Ville</span>
                    <span style={styles.modalValue}>{selectedCandidate.city || '-'}</span>
                  </div>
                  <div style={styles.modalItem}>
                    <span style={styles.modalLabel}>Pays</span>
                    <span style={styles.modalValue}>{selectedCandidate.country || '-'}</span>
                  </div>
                </div>
              </div>
              <div style={styles.modalSection}>
                <h3>Pièce d'identité</h3>
                <div style={styles.modalGrid}>
                  <div style={styles.modalItem}>
                    <span style={styles.modalLabel}>Type</span>
                    <span style={styles.modalValue}>{getIdTypeLabel(selectedCandidate.idType)}</span>
                  </div>
                  <div style={styles.modalItem}>
                    <span style={styles.modalLabel}>Numéro</span>
                    <span style={styles.modalValue}>{selectedCandidate.idNumber}</span>
                  </div>
                </div>
              </div>
              <div style={styles.modalSection}>
                <h3>Date de soumission</h3>
                <div style={styles.modalGrid}>
                  <div style={styles.modalItem}>
                    <span style={styles.modalLabel}>Créé le</span>
                    <span style={styles.modalValue}>{formatDate(selectedCandidate.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {successData && (
        <div style={styles.modalOverlay} onClick={() => setSuccessData(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2>✓ Agent approuvé</h2>
              <button style={styles.closeBtn} onClick={() => setSuccessData(null)}>✕</button>
            </div>
            <div style={{padding: '24px'}}>
              <div style={{background: '#6b4cdb10', border: '1px solid #6b4cdb40', borderRadius: '12px', padding: '20px', marginBottom: '20px'}}>
                <p style={{margin: '0 0 16px 0', color: '#a1a1aa', fontSize: '14px'}}>
                  Voici les identifiants de connexion à communiquer à l'agent :
                </p>
                <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#111113', borderRadius: '8px'}}>
                    <span style={{color: '#a1a1aa'}}>Agent</span>
                    <span style={{color: '#fafafa', fontWeight: 600}}>{successData.name}</span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#111113', borderRadius: '8px'}}>
                    <span style={{color: '#a1a1aa'}}>Code agent</span>
                    <span style={{color: '#6b4cdb', fontWeight: 700, fontSize: '18px', letterSpacing: '2px'}}>{successData.code}</span>
                  </div>
                  {successData.authCode && (
                    <div style={{display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#111113', borderRadius: '8px'}}>
                      <span style={{color: '#a1a1aa'}}>Code de connexion</span>
                      <span style={{color: '#10b981', fontWeight: 700, fontSize: '18px', letterSpacing: '2px'}}>{successData.authCode}</span>
                    </div>
                  )}
                  <div style={{display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#111113', borderRadius: '8px'}}>
                    <span style={{color: '#a1a1aa'}}>Téléphone</span>
                    <span style={{color: '#fafafa'}}>{successData.phone}</span>
                  </div>
                </div>
              </div>
              <div style={{background: '#1a1a1c', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#71717a'}}>
                L'agent se connecte sur <strong style={{color: '#a1a1aa'}}>/login</strong> avec son code agent et le code de connexion, puis définit son mot de passe.
              </div>
              <button 
                onClick={() => setSuccessData(null)}
                style={{width: '100%', marginTop: '20px', padding: '12px', background: '#6b4cdb', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px'}}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: '#0a0a0b',
    color: '#fafafa',
  },
  sidebar: {
    width: '260px',
    background: '#111113',
    borderRight: '1px solid #27272a',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
  },
  logoSection: {
    marginBottom: '32px',
  },
  logo: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#6b4cdb',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '10px',
    background: 'transparent',
    border: 'none',
    color: '#a1a1aa',
    cursor: 'pointer',
    fontSize: '14px',
    textAlign: 'left',
  },
  navItemActive: {
    background: '#6b4cdb20',
    color: '#6b4cdb',
  },
  navIcon: {
    fontSize: '16px',
  },
  sidebarFooter: {
    marginTop: 'auto',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '10px',
    background: '#ef444420',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: '14px',
    width: '100%',
  },
  main: {
    flex: 1,
    padding: '32px',
  },
  topBar: {
    marginBottom: '24px',
  },
  pageTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#fff',
    margin: 0,
  },
  subtitle: {
    fontSize: '14px',
    color: '#71717a',
    marginTop: '4px',
  },
  controls: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    minWidth: '280px',
    display: 'flex',
    alignItems: 'center',
    background: '#18181b',
    borderRadius: '10px',
    padding: '0 16px',
    border: '1px solid #27272a',
  },
  searchIcon: {
    fontSize: '16px',
    marginRight: '12px',
  },
  searchInput: {
    flex: 1,
    padding: '14px 0',
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  filterTabs: {
    display: 'flex',
    gap: '8px',
  },
  filterTab: {
    padding: '12px 20px',
    borderRadius: '10px',
    border: '1px solid #27272a',
    background: '#18181b',
    color: '#a1a1aa',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  filterTabActive: {
    background: '#6b4cdb',
    color: '#fff',
    borderColor: '#6b4cdb',
  },
  badgeCount: {
    background: '#27272a',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '12px',
  },
  stats: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    padding: '16px 24px',
    background: '#18181b',
    borderRadius: '12px',
    border: '1px solid #27272a',
    borderLeft: '4px solid #6b4cdb',
    display: 'flex',
    flexDirection: 'column',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: '12px',
    color: '#71717a',
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#71717a',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #27272a',
    borderTopColor: '#6b4cdb',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 16px',
  },
  empty: {
    textAlign: 'center',
    padding: '60px',
    color: '#71717a',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '20px',
  },
  gridMobile: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '16px',
  },
  card: {
    background: '#18181b',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid #27272a',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '16px',
  },
  avatar: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #6b4cdb 0%, #7c3aed 100%)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    fontWeight: '600',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#fff',
  },
  cardPhone: {
    fontSize: '13px',
    color: '#71717a',
    marginTop: '2px',
  },
  viewBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#27272a',
    border: 'none',
    color: '#a1a1aa',
    cursor: 'pointer',
    fontSize: '16px',
  },
  cardDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingBottom: '16px',
    borderBottom: '1px solid #27272a',
    marginBottom: '16px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
  },
  detailLabel: {
    color: '#71717a',
  },
  detailValue: {
    color: '#e4e4e7',
    fontWeight: '500',
  },
  cardActions: {
    display: 'flex',
    gap: '10px',
  },
  approveBtn: {
    flex: 1,
    padding: '14px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  rejectBtn: {
    flex: 1,
    padding: '14px',
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#18181b',
    borderRadius: '20px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflow: 'auto',
    border: '1px solid #27272a',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px',
    borderBottom: '1px solid #27272a',
  },
  closeBtn: {
    background: '#27272a',
    border: 'none',
    color: '#fff',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  modalBody: {
    padding: '24px',
  },
  modalSection: {
    marginBottom: '24px',
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    marginTop: '12px',
  },
  modalItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  modalLabel: {
    fontSize: '12px',
    color: '#71717a',
  },
  modalValue: {
    fontSize: '15px',
    color: '#fff',
    fontWeight: '500',
  },
};
