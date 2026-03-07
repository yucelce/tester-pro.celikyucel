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

    useEffect(() => {
        if (isOpen) {
            fetchSuppliers();
        }
    }, [isOpen, buildingStats.province, buildingStats.district]);

    const fetchSuppliers = async () => {
        setIsLoading(true);
        try {
            // SİZİN LİNKİNİZİN DÜZELTİLMİŞ TSV FORMATI:
            const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7I9ioyi6FWmgpt3BimD2IDCBu0C0FzjGrC3MWMGDraun2cjS4RCC7XPtuGXnux-Rcy6UwhhSJLlVR/pub?output=tsv";
            
            const response = await fetch(sheetUrl);
            
            if (!response.ok) {
                throw new Error("Veri çekilemedi: " + response.statusText);
            }

            const text = await response.text();
            const rows = text.split('\n').slice(1); // İlk satırı (Başlıkları) atla
            
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
            }).filter(s => s.il && s.firmaAdi); // Sadece ili ve firma adı dolu olanları al

            // 1. Önce kullanıcının İli ve İlçesiyle tam eşleşenleri bul
            let filtered = parsedSuppliers.filter(s => s.il === buildingStats.province && s.ilce === buildingStats.district);

            // 2. Eğer o ilçede nalbur yoksa, o İldeki diğer nalburları getir
            if (filtered.length === 0) {
                filtered = parsedSuppliers.filter(s => s.il === buildingStats.province);
            }

            setSuppliers(filtered);
        } catch (error) {
            console.error("Tedarikçi listesi çekilemedi:", error);
            alert("Tedarikçi listesi şu an yüklenemiyor. Bağlantınızı kontrol edin.");
        } finally {
            setIsLoading(false);
        }
    };

    const generateMessageText = () => {
        let msg = `Merhaba, CY Pro İnşaat Manager üzerinden malzeme teklifi almak istiyorum. İhtiyaç listem aşağıdadır:\n\n`;
        msg += `Proje Konumu: ${buildingStats.province} / ${buildingStats.district}\n\n`;
        
        procurementGroups.forEach(group => {
            msg += `--- ${group.taskName.toUpperCase()} AŞAMASI ---\n`;
            group.items.forEach(item => {
                const qty = item.unit === 'Paket' ? '1 Paket' : `${item.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} ${item.unit}`;
                msg += `• ${item.name}: ${qty}\n`;
            });
            msg += `\n`;
        });
        
        return encodeURIComponent(msg);
    };

    const formatPhoneForWA = (phone: string) => {
        let clean = phone.replace(/\D/g, ''); 
        if (clean.startsWith('0')) clean = clean.substring(1); 
        if (!clean.startsWith('90')) clean = '90' + clean; 
        return clean;
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
                            {suppliers.map((supplier, idx) => (
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
                                    
                                    <div className="flex-1 space-y-2.5 mb-5 text-xs text-slate-600 dark:text-slate-400">
                                        {supplier.telefon && (
                                            <div className="flex items-center gap-2">
                                                <i className="fas fa-phone text-slate-400 w-4"></i>
                                                <span className="font-mono">{supplier.telefon}</span>
                                            </div>
                                        )}
                                        {supplier.eposta && (
                                            <div className="flex items-center gap-2">
                                                <i className="fas fa-envelope text-slate-400 w-4"></i>
                                                <span className="truncate" title={supplier.eposta}>{supplier.eposta}</span>
                                            </div>
                                        )}
                                        {supplier.adres && (
                                            <div className="flex items-start gap-2">
                                                <i className="fas fa-map-marker-alt text-slate-400 w-4 mt-0.5"></i>
                                                <span className="leading-snug line-clamp-2" title={supplier.adres}>{supplier.adres}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mt-auto">
                                        <a 
                                            href={`https://wa.me/${formatPhoneForWA(supplier.telefon)}?text=${generateMessageText()}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="bg-[#25D366] hover:bg-[#1DA851] text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                                        >
                                            <i className="fab fa-whatsapp text-lg"></i> WhatsApp
                                        </a>
                                        <a 
                                            href={`mailto:${supplier.eposta}?subject=CY Pro Malzeme Fiyat Teklifi Talebi&body=${generateMessageText()}`}
                                            className="bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                                        >
                                            <i className="fas fa-envelope text-sm"></i> E-Posta
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};