import React from 'react';

export default function Logo({ className = 'h-14 sm:h-16', isDark = false, ...props }) {
  return (
    <div className={`inline-flex items-center select-none ${className}`} {...props}>
      <img
        src={isDark ? "/brand/logo-irmaos-barreiro-white.png" : "/brand/logo-irmaos-barreiro.png"}
        alt="Irmãos Barreiro"
        className={`h-full w-auto object-contain ${isDark ? '' : 'mix-blend-multiply'}`}
      />
    </div>
  );
}
