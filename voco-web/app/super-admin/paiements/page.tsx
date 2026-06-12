'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const fmt = (n: number) => n.toLocaleString('fr-FR');

export default function PaiementsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0 });
  const [stats, setStats] = useState({ totalRevenue: 0, totalInvoices: 0 });
  const [revenueMonthly, setRevenueMonthly] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [wdStats, setWdStats] = useState<any>({});

  useEffect(() => {
    const t = localStorage.getItem('adminToken');
    if (!t) { router.push('/admin/login'); return; }
    (async () => {
      try {
        const h = { Authorization: `Bearer ${t}` };
        const [pr, wr, ws] = await Promise.all([
          fetch(`${API}/admin/payments?limit=50`, { headers: h }).catch(() => null),
          fetch(`${API}/admin/withdrawals?limit=100`, { headers: h }).catch(() => null),
          fetch(`${API}/admin/withdrawals/stats`, { headers: h }).catch(() => null),
        ]);
        if (pr?.ok) { const d = await pr.json(); setPayments(d.payments); setMeta(d.meta); setStats(d.stats); setRevenueMonthly(d.revenueMonthly || []); }
        if (wr?.ok) setWithdrawals((await wr.json()).withdrawals || []);
        if (ws?.ok) setWdStats(await ws.json());
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const approvedTotal = wdStats?.approved?.total || 0;
  const pendingCount = wdStats?.pending?.count || withdrawals.filter(w => w.status === 'pending').length;
  const pendingTotal = wdStats?.pending?.total || 0;
  const currentMonthRevenue = (stats as any).currentMonthRevenue || 0;

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', height: '40vh', alignItems: 'center' }}><div style={{ width: 32, height: 32, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>💰 Paiements</h2>
      <p style={{ fontSize: 12, color: '#71717a', marginBottom: 20 }}>
        {fmt(meta.total)} factures · {fmt(currentMonthRevenue)} XAF ce mois · {fmt(stats.totalRevenue)} XAF total
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Revenu total', value: `${fmt(stats.totalRevenue)} XAF`, color: '#22c55e' },
          { label: 'Ce mois', value: `${fmt(currentMonthRevenue)} XAF`, color: '#a855f7' },
          { label: 'Factures', value: fmt(meta.total), color: '#3b82f6' },
          { label: 'Retraits en attente', value: `${pendingCount} (${fmt(pendingTotal)} XAF)`, color: '#eab308' },
          { label: 'Retraits approuvés', value: `${fmt(approvedTotal)} XAF`, color: '#22c55e' },
        ].map(s => (
          <div key={s.label} style={{ background: '#18181b', borderRadius: 10, padding: 16, border: '1px solid #27272a', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      {revenueMonthly.length > 1 && (
        <div style={{ background: '#18181b', borderRadius: 12, padding: 16, border: '1px solid #27272a', marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: '0 0 12px' }}>Évolution des revenus (12 mois)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
            {revenueMonthly.slice().reverse().map((r: any, i: number) => {
              const max = Math.max(...revenueMonthly.map((x: any) => x.totalRevenue), 1);
              const h = (r.totalRevenue / max) * 100;
              return (
                <div key={r.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', height: `${Math.max(h, 4)}%`, borderRadius: '3px 3px 0 0', background: i === revenueMonthly.length - 1 ? '#a855f7' : '#a855f760', transition: 'height 0.3s' }} />
                  <span style={{ fontSize: 8, color: '#52525b', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{r.month?.slice(-2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payments table */}
      <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: 0 }}>Factures</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead><tr style={{ borderBottom: '1px solid #27272a' }}>
            {['Facture', 'Boutique', 'Montant', 'Transaction', 'Date', 'Agent'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 60, color: '#71717a', fontSize: 13 }}>Aucune facture trouvée</td></tr>
            ) : payments.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #27272a' }}>
                <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'monospace', color: '#a855f7' }}>{p.invoiceNumber}</td>
                <td style={{ padding: '10px 14px', fontWeight: 500, color: '#fff', fontSize: 13 }}>{p.storeName}</td>
                <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#22c55e' }}>{fmt(p.amount)} {p.currency}</td>
                <td style={{ padding: '10px 14px', fontSize: 11, color: '#a1a1aa', fontFamily: 'monospace' }}>{p.transactionId || '-'}</td>
                <td style={{ padding: '10px 14px', fontSize: 11, color: '#52525b' }}>{p.paidAt ? new Date(p.paidAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td style={{ padding: '10px 14px', fontSize: 11, color: '#a855f7' }}>{p.agentCode || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Withdrawals */}
      {withdrawals.length > 0 && (
        <div style={{ marginTop: 24, background: '#18181b', borderRadius: 12, border: '1px solid #27272a', overflow: 'auto' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: 0 }}>Retraits agents</h3>
            <span style={{ fontSize: 12, color: '#71717a' }}>{withdrawals.length} total</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead><tr style={{ borderBottom: '1px solid #27272a' }}>
              {['Agent', 'Montant', 'Téléphone', 'Date', 'Statut'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {withdrawals.slice(0, 20).map((w: any) => (
                <tr key={w.id} style={{ borderBottom: '1px solid #27272a' }}>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#a855f7', fontFamily: 'monospace' }}>{w.agentCode || w.agentId}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#fff' }}>{Number(w.amount || 0).toLocaleString()} XAF</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>{w.phone || '-'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: '#52525b' }}>{w.createdAt ? new Date(w.createdAt).toLocaleDateString('fr-FR') : '-'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: w.status === 'approved' ? '#22c55e20' : w.status === 'pending' ? '#eab30820' : '#ef444420', color: w.status === 'approved' ? '#22c55e' : w.status === 'pending' ? '#eab308' : '#ef4444' }}>
                      {w.status === 'approved' ? 'Approuvé' : w.status === 'pending' ? 'En attente' : 'Rejeté'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
