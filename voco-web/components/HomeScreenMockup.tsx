'use client';

import { useEffect, useState } from 'react';

/* =====================================================
   ANIMATED COUNTER
===================================================== */
function AnimCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 2000;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    const timer = setTimeout(() => requestAnimationFrame(step), 800);
    return () => clearTimeout(timer);
  }, [target]);
  return <>{prefix}{val.toLocaleString('fr-FR')}{suffix}</>;
}

/* =====================================================
   HOME SCREEN MOCKUP — Écran du marchand
===================================================== */
export default function HomeScreenMockup() {
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab((p) => (p + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#0f0f13',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Status bar */}
      <div style={{
        padding: '28px 16px 8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 11,
        color: '#71717a',
        fontWeight: 600,
      }}>
        <span>9:41</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <div style={{ width: 16, height: 10, border: '1px solid #71717a', borderRadius: 2, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 1, background: '#22c55e', borderRadius: 1 }} />
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{ padding: '4px 16px 12px' }}>
        <div style={{ fontSize: 11, color: '#71717a' }}>Bonjour 👋</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', marginTop: 2 }}>Ma Boutique</div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 12px' }}>
        <KpiCard
          label="Ventes"
          value={<AnimCounter target={45} />}
          color="#a855f7"
          icon="📊"
          active={activeTab === 0}
        />
        <KpiCard
          label="Chiffre"
          value={<AnimCounter target={125000} prefix="" suffix=" F" />}
          color="#22c55e"
          icon="💰"
          active={activeTab === 1}
        />
        <KpiCard
          label="Produits"
          value={<AnimCounter target={28} />}
          color="#3b82f6"
          icon="📦"
          active={activeTab === 2}
        />
        <KpiCard
          label="Stock"
          value={<AnimCounter target={156} />}
          color="#eab308"
          icon="🏪"
          active={activeTab === 0}
        />
      </div>

      {/* Dernières ventes */}
      <div style={{ padding: '12px 12px 4px', fontSize: 12, fontWeight: 600, color: '#a1a1aa' }}>
        Dernières ventes
      </div>
      <div style={{ flex: 1, padding: '0 12px', overflow: 'hidden' }}>
        {[
          { name: 'Savon Malta', qty: 3, price: '1 500 F', time: 'Il y a 2h' },
          { name: 'Riz 5kg', qty: 1, price: '4 500 F', time: 'Il y a 4h' },
          { name: 'Huile 1L', qty: 2, price: '3 000 F', time: 'Hier' },
        ].map((sale, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 0',
            borderBottom: '1px solid #1a1a1f',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{sale.name}</div>
              <div style={{ fontSize: 10, color: '#71717a', marginTop: 2 }}>x{sale.qty} · {sale.time}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{sale.price}</div>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        padding: '10px 0 16px',
        borderTop: '1px solid #1a1a1f',
        background: '#0f0f13',
      }}>
        {['🏠', '📷', '📊', '👤'].map((icon, i) => (
          <div key={i} style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: i === 0 ? '#a855f720' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}>{icon}</div>
        ))}
      </div>
    </div>
  );
}

/* =====================================================
   KPI CARD
===================================================== */
function KpiCard({ label, value, color, icon, active }: {
  label: string;
  value: React.ReactNode;
  color: string;
  icon: string;
  active: boolean;
}) {
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 12,
      background: active ? `${color}10` : '#141418',
      border: `1px solid ${active ? `${color}30` : '#1a1a1f'}`,
      transition: 'all 0.5s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12 }}>{icon}</span>
      </div>
      <div style={{
        fontSize: 18,
        fontWeight: 800,
        color: active ? color : '#fafafa',
        marginTop: 4,
        transition: 'color 0.5s ease',
      }}>{value}</div>
    </div>
  );
}
