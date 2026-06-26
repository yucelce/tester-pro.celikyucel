import React from 'react';
import { Lock } from 'lucide-react'; // Projenizde hangi ikon seti varsa (lucide, heroicons vb.) ona göre güncelleyebilirsiniz.

interface ProLockedWrapperProps {
  children: React.ReactNode;
  isPro: boolean; // Kullanıcının Pro olup olmadığını kontrol eden prop
}

export const ProLockedWrapper: React.FC<ProLockedWrapperProps> = ({ children, isPro }) => {
  // Eğer kullanıcı Pro ise, kilit mekanizmasını hiç gösterme, içeriği normal render et
  if (isPro) {
    return <>{children}</>;
  }

  // Kullanıcı Pro DEĞİLSE kilitli görünümü render et
  return (
    <div 
      className="relative group cursor-pointer w-full"
      onClick={() => window.open('https://www.celikyucel.com/abonelikler', '_blank')}
    >
      {/* Tooltip - Sadece üzerine gelindiğinde (hover) görünür */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max bg-gray-800 text-white text-xs py-1.5 px-3 rounded shadow-lg z-50">
        Düzenlemek için Pro Plana Geçin
        {/* Tooltip oku (Tailwind ile ufak bir üçgen) */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
      </div>
      
      {/* Kilit İkonu ve Arkaplan Filtresi (Görsel Pasifleştirme) */}
      <div className="absolute inset-0 bg-gray-50/40 rounded-md z-10 flex items-center justify-end pr-3 pointer-events-none border border-gray-200">
         <Lock className="w-4 h-4 text-gray-500" />
      </div>

      {/* İçerik (Inputlar): pointer-events-none sayesinde input'a tıklanamaz,
        tıklamayı üstteki ana div yakalar ve yönlendirmeyi yapar.
        opacity-70 ile görsel olarak "sabit/okunabilir ama değiştirilemez" hissi verilir.
      */}
      <div className="pointer-events-none opacity-70 bg-gray-100 rounded-md">
        {children}
      </div>
    </div>
  );
};