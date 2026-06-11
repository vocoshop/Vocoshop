'use client';

import { ReactNode } from 'react';

export default function PhoneMockup({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`phone-mockup animate-floatSlow ${className}`} style={{ position: 'relative' }}>
      {/* Glow behind phone */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, #a855f725 0%, transparent 70%)',
        filter: 'blur(40px)',
        pointerEvents: 'none',
        zIndex: -1,
      }} />
      <div className="phone-screen">
        {children}
      </div>
    </div>
  );
}
