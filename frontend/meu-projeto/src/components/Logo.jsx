import React from 'react';

export default function Logo({ className = 'h-14 sm:h-16' }) {
  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <img
        src="/brand/logo-irmaos-barreiro.png"
        alt="Irmãos Barreiro"
        className="h-full w-auto object-contain mix-blend-multiply"
      />
    </div>
  );
}
