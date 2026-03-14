// src/components/Modals/ArchitectModal.tsx
import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';

interface Architect {
    il: string;
    ilce: string;
    ofisAdi: string;
    telefon: string;
    eposta: string;
    adres: string;
    website?: string; // Website opsiyonel olarak eklendi
}

interface ArchitectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ArchitectModal: React.FC<ArchitectModalProps> = ({ isOpen, onClose }) => {
    const { buildingStats, totalConstructionArea } = useProjectStore();
    const [isLoading, setIsLoading] = useState(false);
    const [architects, setArchitects] = useState<Architect[]>([]);
    
    // Hangi butonun yüklendiğini takip etmek için
    const [loadingAction, setLoadingAction] = useState<{ id: string, type: 'wa' | 'email' } | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchArchitects();
        }
    }, [isOpen, buildingStats.province]);

    const fetchArchitects = async () => {
        setIsLoading(true);
        try {
            // Artık Google'a değil, kendi güvenli sunucumuza istek atıyoruz
            const response = await fetch('/api/architects');
            
            if (!response.ok) {
                throw new Error("Sunucudan veri çekilemedi");
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error);
            }

            // Sadece projeyle eşleşen ildeki mimarları filtrele
            const filtered = result.data.filter((a: Architect) => a.il === buildingStats.province);
            setArchitects(filtered);
            
        } catch (error) {
            console.error("Mimari ofis listesi çekilemedi:", error);
            // alert("Mimari ofis listesi şu an yüklenemiyor."); 
        } finally {
            setIsLoading(false);
        }
    };

    const isValidContact = (val: string | undefined) => {
        if (!val) return false;
        const lower = val.trim().toLowerCase();
        return !['bulunamadı', 'bilinmiyor', 'yok', '-', 'null'].includes(lower);
    };

    // Mimarlara gönderilecek özel mesaj şablonu
    const generateMessageText = () => {
        const type = buildingStats.buildingType === 'villa' ? 'Müstakil Villa' : 'Apartman/Çok Katlı';
        let msg = `Merhaba, CY Pro İnşaat Manager üzerinden ulaşıyorum. Yeni projemiz için mimari tasarım ve ruhsat projesi teklifi almak istiyoruz.\n\n`;
        msg += `📍 Konum: ${buildingStats.province} / ${buildingStats.district}\n`;
        msg += `🏢 Proje Tipi: ${type}\n`;
        msg += `📐 Arsa Alanı: ${buildingStats.landArea} m²\n`;
        msg += `📏 Tahmini İnşaat Alanı: ${totalConstructionArea.toLocaleString()} m²\n\n`;
        msg += `Müsaitliğiniz varsa detayları görüşmek isteriz. İyi çalışmalar dilerim.`;
        return encodeURIComponent(msg);
    };

    const formatPhoneForWA = (phone: string) => {
        let clean = phone.replace(/\D/g, '');
        if (clean.startsWith('0')) clean = clean.substring(1);
        if (!clean.startsWith('90')) clean = '90' + clean;
        return clean;
    };

    const handleSendEmail = (architect: Architect, idx: number) => {
        setLoadingAction({ id: architect.ofisAdi + idx, type: 'email' });
        setTimeout(() => {
            const subject = encodeURIComponent("CY Pro Mimari Proje Teklifi Talebi");
            const body = generateMessageText();
            window.location.href = `mailto:${architect.eposta}?subject=${subject}&body=${body}`;
            setLoadingAction(null);
        }, 500);
    };

    const handleSendWA = (architect: Architect, idx: number) => {
        setLoadingAction({ id: architect.ofisAdi + idx, type: 'wa' });
        setTimeout(() => {
            const waUrl = `https://wa.me/${formatPhoneForWA(architect.telefon)}?text=${generateMessageText()}`;
            window.open(waUrl, '_blank');
            setLoadingAction(null);
        }, 500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex justify-center items-center backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col h-[85vh]">

                <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center shrink-0 rounded-t-xl">
                    <div>
                        <h3 className="font-bold text-lg md:text-xl text-slate-900 dark:text-white flex items-center gap-2">
                            <i className="fas fa-drafting-compass text-purple-500"></i> Bölgenizdeki Mimari Ofisler
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Proje Konumu: <strong className="text-slate-700 dark:text-slate-300">{buildingStats.province} / {buildingStats.district}</strong>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition bg-slate-200 dark:bg-slate-800 w-10 h-10 rounded-full flex items-center justify-center">
                        <i className="fas fa-times text-lg"></i>
                    </button>
                </div>

                <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-100 dark:bg-slate-950 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <i className="fas fa-circle-notch fa-spin text-4xl mb-4 text-purple-500"></i>
                            <p className="font-medium">Mimari ofis veri tabanı aranıyor...</p>
                        </div>
                    ) : architects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 bg-white dark:bg-slate-900/50">
                            <i className="fas fa-search-location text-5xl mb-4 text-slate-300 dark:text-slate-600"></i>
                            <p className="font-bold text-lg text-slate-700 dark:text-slate-300">Kayıtlı ofis bulunamadı.</p>
                            <p className="text-sm mt-2 text-center max-w-md leading-relaxed">Şu an için <strong>{buildingStats.province}</strong> ilinde sisteme kayıtlı bir mimari ofisimiz bulunmuyor.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {architects.map((architect, idx) => {
                                const hasPhone = isValidContact(architect.telefon);
                                const hasEmail = isValidContact(architect.eposta);
                                const hasAddress = isValidContact(architect.adres);
                                const hasWebsite = isValidContact(architect.website);

                                return (
                                    <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm hover:shadow-lg transition flex flex-col">
                                        <div className="flex items-start justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                                            <div>
                                                <h4 className="font-bold text-slate-900 dark:text-white text-base leading-tight mb-1.5">{architect.ofisAdi}</h4>
                                                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded">
                                                    {architect.il} / {architect.ilce}
                                                </span>
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center shrink-0 text-xl border border-purple-100 dark:border-purple-800/50">
                                                <i className="fas fa-pen-nib"></i>
                                            </div>
                                        </div>

                                        <div className="flex-1 space-y-3 mb-5 text-xs text-slate-600 dark:text-slate-400">
                                            {hasPhone && (
                                                <div className="flex items-center gap-2">
                                                    <i className="fas fa-phone text-slate-400 w-4"></i>
                                                    <span className="font-mono">{architect.telefon}</span>
                                                </div>
                                            )}
                                            {hasEmail && (
                                                <div className="flex items-center gap-2">
                                                    <i className="fas fa-envelope text-slate-400 w-4"></i>
                                                    <span className="truncate" title={architect.eposta}>{architect.eposta}</span>
                                                </div>
                                            )}
                                            {hasWebsite && architect.website && (
                                                <div className="flex items-center gap-2">
                                                    <i className="fas fa-globe text-slate-400 w-4"></i>
                                                    <a 
                                                        href={architect.website.startsWith('http') ? architect.website : `https://${architect.website}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="truncate text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition hover:underline"
                                                        title={architect.website}
                                                    >
                                                        {architect.website.replace(/^https?:\/\//, '')}
                                                    </a>
                                                </div>
                                            )}
                                            {hasAddress && (
                                                <div className="flex items-start gap-2">
                                                    <i className="fas fa-map-marker-alt text-slate-400 w-4 mt-0.5"></i>
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className="leading-snug line-clamp-2" title={architect.adres}>{architect.adres}</span>
                                                        <a 
                                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(architect.adres)}`} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="text-[10px] text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-bold flex items-center gap-1 transition"
                                                        >
                                                            <i className="fas fa-location-arrow"></i> Haritada Gör
                                                        </a>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className={`grid gap-2 mt-auto ${(hasPhone && hasEmail) ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                            {hasPhone && (
                                                <button
                                                    onClick={() => handleSendWA(architect, idx)}
                                                    disabled={loadingAction !== null}
                                                    className="bg-[#25D366] hover:bg-[#1DA851] text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-60"
                                                >
                                                    <i className="fab fa-whatsapp text-lg"></i> WhatsApp
                                                </button>
                                            )}

                                            {hasEmail && (
                                                <button
                                                    onClick={() => handleSendEmail(architect, idx)}
                                                    disabled={loadingAction !== null}
                                                    className="bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-60"
                                                >
                                                    <i className="fas fa-envelope text-sm"></i> Mail Gönder
                                                </button>
                                            )}

                                            {!hasPhone && !hasEmail && hasAddress && (
                                                <a 
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(architect.adres)}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                                                >
                                                    <i className="fas fa-map-marked-alt text-lg text-blue-500"></i> Adrese Git
                                                </a>
                                            )}

                                            {!hasPhone && !hasEmail && !hasAddress && !hasWebsite && (
                                                <div className="text-center text-[10px] text-slate-400 italic py-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                                                    İletişim bilgisi bulunamadı
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};