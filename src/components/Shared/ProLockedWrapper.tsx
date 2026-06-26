import React from 'react';

interface ProLockedWrapperProps {
  children: React.ReactNode;
  isPro: boolean;
}

export const ProLockedWrapper: React.FC<ProLockedWrapperProps> = ({ children, isPro }) => {
  if (isPro) {
    return <>{children}</>;
  }

  return (
    <div 
      className="relative group cursor-pointer w-full"
      onClick={() => window.open('https://www.celikyucel.com/abonelikler', '_blank')}
    >
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max bg-slate-800 text-slate-200 text-xs py-1.5 px-3 rounded shadow border border-slate-700 z-50">
        Düzenlemek için Pro Plana Geçin
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
      </div>
      
      {/* Kilit İkonu ve Arkaplan Filtresi (Dark Mode Uyumlu) */}
      <div className="absolute inset-0 bg-slate-900/70 rounded-md z-10 flex items-center justify-end pr-3 pointer-events-none border border-slate-700/50">
         {/* Projedeki mevcut FontAwesome yapısı kullanıldı */}
         <i className="fas fa-lock text-slate-400 text-sm"></i>
      </div>

      {/* İçerik */}
      <div className="pointer-events-none opacity-50 bg-slate-800/50 rounded-md">
        {children}
      </div>
    </div>
  );
};