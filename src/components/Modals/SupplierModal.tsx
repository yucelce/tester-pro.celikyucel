// src/components/Modals/SupplierModal.tsx
import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';

interface ProcurementItem {
    id: string;
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    taskId: string;
    taskName: string;
    deliveryDate: Date;
}

interface ProcurementGroup {
    date: Date | string;
    taskName: string;
    totalCost: number;
    items: ProcurementItem[];
}

interface Supplier {
    il: string;
    ilce: string;
    firmaAdi: string;
    telefon: string;
    eposta: string;
    adres: string;
}

interface SupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    procurementGroups: ProcurementGroup[];
}

export const SupplierModal: React.FC<SupplierModalProps> = ({ isOpen, onClose, procurementGroups }) => {
    const { buildingStats } = useProjectStore();
    const [isLoading, setIsLoading] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    const [shareLink, setShareLink] = useState<string | null>(null);
    const [isCreatingLink, setIsCreatingLink] = useState(false);
    
    // Kopyalama işlemi için durum tutucu
    const [isCopied, setIsCopied] = useState(false);
    
    // Hangi butonun yüklendiğini takip etmek için (örn: "Denizler Yapı - Eposta")
    const [loadingAction, setLoadingAction] = useState<{ id: string, type: 'wa' | 'email' } | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchSuppliers();
        }
    }, [isOpen, buildingStats.province]);

    const fetchSuppliers = async () => {
        setIsLoading(true);
        try {
            const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7I9ioyi6FWmgpt3BimD2IDCBu0C0FzjGrC3MWMGDraun2cjS4RCC7XPtuGXnux-Rcy6UwhhSJLlVR/pub?output=tsv";
            const response = await fetch(sheetUrl);

            if (!response.ok) {
                throw new Error("Veri çekilemedi: " + response.statusText);
            }

            const text = await response.text();
            const rows = text.split('\n').slice(1); 

            const parsedSuppliers: Supplier[] = rows.map(row => {
                const cols = row.split('\t');
                return {
                    il: cols[0]?.trim() || '',
                    ilce: cols[1]?.trim() || '',
                    firmaAdi: cols[2]?.trim() || '',
                    telefon: cols[3]?.trim() || '',
                    eposta: cols[4]?.trim() || '',
                    adres: cols[5]?.trim() || ''
                };
            }).filter(s => s.il && s.firmaAdi); 

            const filtered = parsedSuppliers.filter(s => s.il === buildingStats.province);

            setSuppliers(filtered);
        } catch (error) {
            console.error("Tedarikçi listesi çekilemedi:", error);
            alert("Tedarikçi listesi şu an yüklenemiyor. Bağlantınızı kontrol edin.");
        } finally {
            setIsLoading(false);
        }
    };

    // YENİ EKLENEN: İletişim bilgisinin geçerli olup olmadığını kontrol eden yardımcı fonksiyon
    const isValidContact = (val: string) => {
        if (!val) return false;
        const lower = val.trim().toLowerCase();
        return !['bulunamadı', 'bilinmiyor', 'yok', '-', 'null'].includes(lower);
    };

    // --- LİNK OLUŞTURMA MANTIĞI ---
    const ensureShareLink = async (): Promise<string | null> => {
        if (shareLink) return shareLink; // Zaten varsa hemen döndür

        setIsCreatingLink(true);
        try {
            const response = await fetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectName: `${buildingStats.province} / ${buildingStats.district} Projesi`,
                    procurementData: procurementGroups
                })
            });
            const result = await response.json();
            if (result.success) {
                const newLink = `${window.location.origin}/?downloadId=${result.uuid}`;
                setShareLink(newLink);
                return newLink;
            } else {
                alert("Teklif linki oluşturulamadı.");
                return null;
            }
        } catch (e) {
            console.error(e);
            alert("Bir hata oluştu.");
            return null;
        } finally {
            setIsCreatingLink(false);
        }
    };

    // Dinamik Link Alan Mesaj Üretici
    const generateMessageText = (linkToUse: string | null) => {
        let msg = `Merhaba, CY Pro İnşaat Manager üzerinden malzeme teklifi almak istiyorum.\n\n`;
        msg += `Proje Konumu: ${buildingStats.province} / ${buildingStats.district}\n\n`;

        if (linkToUse) {
            msg += `Malzeme listesini Excel formatında indirip fiyatlandırmak için aşağıdaki bağlantıya tıklayabilirsiniz:\n${linkToUse}\n\n`;
        } else {
            procurementGroups.forEach(group => {
                msg += `--- ${group.taskName.toUpperCase()} AŞAMASI ---\n`;
                group.items.forEach(item => {
                    const qty = item.unit === 'Paket' ? '1 Paket' : `${item.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} ${item.unit}`;
                    msg += `• ${item.name}: ${qty}\n`;
                });
                msg += `\n`;
            });
        }
        msg += `İyi çalışmalar dilerim.`;
        return encodeURIComponent(msg);
    };

    const formatPhoneForWA = (phone: string) => {
        let clean = phone.replace(/\D/g, '');
        if (clean.startsWith('0')) clean = clean.substring(1);
        if (!clean.startsWith('90')) clean = '90' + clean;
        return clean;
    };

    // E-Posta Gönderme Aksiyonu (mailto: ile)
    const handleSendEmail = async (supplier: Supplier, idx: number) => {
        setLoadingAction({ id: supplier.firmaAdi + idx, type: 'email' });
        const link = await ensureShareLink();
        setLoadingAction(null);

        if (link) {
            const subject = encodeURIComponent("CY Pro Malzeme Fiyat Teklifi Talebi");
            const body = generateMessageText(link);
            const mailUrl = `mailto:${supplier.eposta}?subject=${subject}&body=${body}`;
            
            // mailto linkleri popup engelleyicilere takılmaz, doğrudan çalışır
            window.location.href = mailUrl;
        }
    };

    // WhatsApp Gönderme Aksiyonu
    const handleSendWA = async (supplier: Supplier, idx: number) => {
        setLoadingAction({ id: supplier.firmaAdi + idx, type: 'wa' });
        const link = await ensureShareLink();
        setLoadingAction(null);

        if (link) {
            const waUrl = `https://wa.me/${formatPhoneForWA(supplier.telefon)}?text=${generateMessageText(link)}`;
            const newWindow = window.open(waUrl, '_blank');

            if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                alert("Tarayıcınız yeni pencere açılmasını engelledi. Dosya linkiniz hazırlandı, lütfen 'WhatsApp' butonuna tekrar tıklayın.");
            }
        }
    };

    // Link Kopyalama Aksiyonu
    const handleCopyLink = () => {
        if (shareLink) {
            navigator.clipboard.writeText(shareLink);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000); // 2 saniye sonra "Linki Kopyala" yazısına döner
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex justify-center items-center backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col h-[85vh]">

                <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center shrink-0 rounded-t-xl">
                    <div>
                        <h3 className="font-bold text-lg md:text-xl text-slate-900 dark:text-white flex items-center gap-2">
                            <i className="fas fa-store text-amber-500"></i> Bölgenizdeki Tedarikçiler
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
                    {!isLoading && suppliers.length > 0 && (
                        <div className="mb-6 bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/50 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Akıllı Teklif Linki Durumu</h4>
                                <p className="text-xs text-slate-500 mt-1">Tedarikçilere mesaj veya e-posta gönderdiğinizde link otomatik üretilir. İsterseniz <strong>manuel paylaşmak için kopyalayabilirsiniz.</strong></p>
                            </div>
                            <button
                                onClick={shareLink ? handleCopyLink : ensureShareLink}
                                disabled={isCreatingLink}
                                className={`px-5 py-2.5 rounded-lg text-sm font-bold shadow-md transition-all shrink-0 flex items-center gap-2
                                    ${shareLink 
                                        ? (isCopied ? 'bg-emerald-600 text-white border border-emerald-600' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 active:scale-95')
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'}`}
                                title={shareLink ? "Manuel paylaşım için linki kopyalayın" : ""}
                            >
                                {isCreatingLink ? <i className="fas fa-spinner fa-spin"></i> :
                                    shareLink ? (isCopied ? <i className="fas fa-check-double"></i> : <i className="far fa-copy"></i>) : <i className="fas fa-link"></i>}
                                {isCreatingLink ? 'Oluşturuluyor...' : 
                                    shareLink ? (isCopied ? 'Kopyalandı!' : 'Linki Kopyala') : 'Sadece Link Üret'}
                            </button>
                        </div>
                    )}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <i className="fas fa-circle-notch fa-spin text-4xl mb-4 text-amber-500"></i>
                            <p className="font-medium">Tedarikçi veri tabanı aranıyor...</p>
                        </div>
                    ) : suppliers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 bg-white dark:bg-slate-900/50">
                            <i className="fas fa-search-location text-5xl mb-4 text-slate-300 dark:text-slate-600"></i>
                            <p className="font-bold text-lg text-slate-700 dark:text-slate-300">Kayıtlı tedarikçi bulunamadı.</p>
                            <p className="text-sm mt-2 text-center max-w-md leading-relaxed">Şu an için <strong>{buildingStats.province}</strong> ilinde sisteme kayıtlı bir anlaşmalı yapı marketimiz bulunmuyor.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {suppliers.map((supplier, idx) => {
                                const hasPhone = isValidContact(supplier.telefon);
                                const hasEmail = isValidContact(supplier.eposta);
                                const hasAddress = isValidContact(supplier.adres);

                                return (
                                    <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm hover:shadow-lg transition flex flex-col">
                                        <div className="flex items-start justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                                            <div>
                                                <h4 className="font-bold text-slate-900 dark:text-white text-base leading-tight mb-1.5">{supplier.firmaAdi}</h4>
                                                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded">
                                                    {supplier.il} / {supplier.ilce}
                                                </span>
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center shrink-0 text-xl border border-amber-100 dark:border-amber-800/50">
                                                <i className="fas fa-hard-hat"></i>
                                            </div>
                                        </div>

                                        <div className="flex-1 space-y-3 mb-5 text-xs text-slate-600 dark:text-slate-400">
                                            {hasPhone && (
                                                <div className="flex items-center gap-2">
                                                    <i className="fas fa-phone text-slate-400 w-4"></i>
                                                    <span className="font-mono">{supplier.telefon}</span>
                                                </div>
                                            )}
                                            {hasEmail && (
                                                <div className="flex items-center gap-2">
                                                    <i className="fas fa-envelope text-slate-400 w-4"></i>
                                                    <span className="truncate" title={supplier.eposta}>{supplier.eposta}</span>
                                                </div>
                                            )}
                                            {hasAddress && (
                                                <div className="flex items-start gap-2">
                                                    <i className="fas fa-map-marker-alt text-slate-400 w-4 mt-0.5"></i>
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className="leading-snug line-clamp-2" title={supplier.adres}>{supplier.adres}</span>
                                                        <a 
                                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(supplier.adres)}`} 
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
                                            {/* WHATSAPP BUTONU */}
                                            {hasPhone && (
                                                <button
                                                    onClick={() => handleSendWA(supplier, idx)}
                                                    disabled={loadingAction !== null}
                                                    className="bg-[#25D366] hover:bg-[#1DA851] text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-60"
                                                >
                                                    {loadingAction?.id === supplier.firmaAdi + idx && loadingAction.type === 'wa' ? (
                                                        <><i className="fas fa-circle-notch fa-spin text-lg"></i> Bekleyin...</>
                                                    ) : (
                                                        <><i className="fab fa-whatsapp text-lg"></i> WhatsApp</>
                                                    )}
                                                </button>
                                            )}

                                            {/* E-POSTA BUTONU */}
                                            {hasEmail && (
                                                <button
                                                    onClick={() => handleSendEmail(supplier, idx)}
                                                    disabled={loadingAction !== null}
                                                    className="bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-60"
                                                >
                                                    {loadingAction?.id === supplier.firmaAdi + idx && loadingAction.type === 'email' ? (
                                                        <><i className="fas fa-circle-notch fa-spin text-sm"></i> Üretiliyor...</>
                                                    ) : (
                                                        <><i className="fas fa-envelope text-sm"></i> Mail Gönder</>
                                                    )}
                                                </button>
                                            )}

                                            {/* NE TELEFON NE MAIL YOKSA VE ADRES VARSA BÜYÜK ADRESE GİT BUTONU */}
                                            {!hasPhone && !hasEmail && hasAddress && (
                                                <a 
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(supplier.adres)}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                                                >
                                                    <i className="fas fa-map-marked-alt text-lg text-blue-500"></i> Adrese Git
                                                </a>
                                            )}

                                            {/* HİÇBİR BİLGİ YOKSA */}
                                            {!hasPhone && !hasEmail && !hasAddress && (
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