// src/components/Modals/ProcurementModal.tsx
import React from 'react';
import { createPortal } from 'react-dom';

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

interface ProcurementModalProps {
    isOpen: boolean;
    onClose: () => void;
    procurementGroups: ProcurementGroup[];
}

export const ProcurementModal: React.FC<ProcurementModalProps> = ({ isOpen, onClose, procurementGroups }) => {
    if (!isOpen) return null;

    const grandTotal = procurementGroups.reduce((sum, group) => sum + group.totalCost, 0);
    const totalItems = procurementGroups.reduce((sum, group) => sum + group.items.length, 0);

    const modalContent = (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
                
                @media print {
                    body > div#root { display: none !important; }
                    body, html {
                        background-color: white !important;
                        color: #0f172a !important; 
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        min-height: auto !important;
                        overflow: visible !important;
                        font-family: 'Inter', sans-serif !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .print-wrapper {
                        position: relative !important;
                        display: block !important;
                        height: auto !important;
                        min-height: auto !important;
                        overflow: visible !important;
                        background: white !important;
                    }
                    @page {
                        margin: 15mm 15mm 20mm 15mm;
                        size: A4 portrait;
                    }
                    .break-inside-avoid {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                    .print\\:hidden { display: none !important; }
                    .print\\:block { display: block !important; }
                }
            `}</style>

            <div className="print-wrapper fixed inset-0 z-[9999] flex items-center justify-center p-2 md:p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn print:static print:bg-white print:p-0 print:backdrop-blur-none">
                
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[90vh] print:hidden">
                    
                    <div className="bg-slate-900 text-white p-4 md:p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="bg-emerald-500/20 w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-inner">
                                <i className="fas fa-truck-loading text-emerald-400 text-xl"></i>
                            </div>
                            <div>
                                <h3 className="font-extrabold text-lg md:text-xl tracking-tight">Malzeme Tedarik ve Sevkiyat Planı</h3>
                                <p className="text-xs text-slate-400 font-medium hidden md:block mt-0.5">
                                    İş programına göre şantiyeye sevk edilecek <span className="text-emerald-400 font-bold">{totalItems} fiziksel malzeme kalemi</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-5">
                            <div className="text-right hidden sm:block mr-2 border-r border-slate-700 pr-5">
                                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Genel Toplam</div>
                                <div className="font-extrabold text-emerald-400 font-mono text-xl drop-shadow-md">
                                    {grandTotal.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                </div>
                            </div>
                            <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition shadow-sm">
                                <i className="fas fa-times text-lg"></i>
                            </button>
                        </div>
                    </div>

                    <div className="p-0 flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950/50 custom-scrollbar relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="relative p-4 md:p-6 border-l-2 border-slate-200 dark:border-slate-700 ml-[100px] md:ml-[150px] my-6 space-y-10 z-10">                                
                            {procurementGroups.length === 0 && (
                                <div className="text-center text-slate-500 py-10 font-medium">Hesaplanan bir malzeme verisi bulunamadı. Lütfen proje metrajlarını kontrol edin.</div>
                            )}

                            {procurementGroups.map((group, i) => (
                            <div key={i} className="relative pl-6 md:pl-8">
                                <div className="absolute w-5 h-5 bg-white dark:bg-slate-900 rounded-full -left-[11px] top-1 border-[5px] border-emerald-500 shadow-md"></div>
                                
                                <div className="absolute -left-[115px] md:-left-[165px] top-0 text-xs w-[90px] md:w-[125px] text-right">
                                    <div className="text-slate-700 dark:text-slate-300 font-mono bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 inline-block shadow-sm font-bold">
                                        {new Date(group.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition duration-300 hover:border-emerald-300 dark:hover:border-emerald-700">
                                    <div className="bg-slate-50 dark:bg-slate-800/80 p-3 md:p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                                            <div className="w-7 h-7 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                                <i className="fas fa-layer-group"></i>
                                            </div>
                                            {group.taskName}
                                        </h4>
                                        <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1 rounded-lg text-[10px] md:text-xs font-bold shadow-sm">
                                            Aşama Toplamı: {group.totalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                        </span>
                                    </div>
                                    <div className="p-3 md:p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {group.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700/50 hover:border-emerald-200 dark:hover:border-emerald-800 transition group">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-emerald-400 shrink-0 transition-colors"></div>
                                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate" title={item.name}>{item.name}</span>
                                                    </div>
                                                    <div className="text-right shrink-0 ml-2">
                                                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                                            {item.unit === 'Paket' ? '1 Paket' : `${item.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} ${item.unit}`}
                                                        </div>
                                                        <div className="text-xs text-slate-900 dark:text-white font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                                            {item.totalPrice.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="p-4 md:p-5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                        <div className="text-xs text-slate-500 font-medium hidden md:flex items-center gap-2">
                            <i className="fas fa-info-circle text-emerald-500"></i>
                            Tedarik tarihleri, iş başlangıcından 3 ila 7 gün öncesi baz alınarak otomatik hesaplanmıştır.
                        </div>
                        <div className="flex gap-3 w-full md:w-auto justify-end">
                            <button onClick={() => window.print()} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition active:scale-95">
                                <i className="fas fa-print"></i> Yazdır / PDF
                            </button>
                            <button onClick={onClose} className="flex-1 md:flex-none bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white px-6 py-2.5 rounded-xl font-bold text-sm transition active:scale-95">
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>

                <div className="hidden print:block w-full font-sans text-slate-900 bg-white">
                    <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 bg-slate-900 text-white rounded flex items-center justify-center">
                                    <i className="fas fa-building"></i>
                                </div>
                                <span className="font-bold text-slate-500 tracking-widest uppercase text-xs">CY Pro İnşaat Maliyet & Yönetim</span>
                            </div>
                            <h1 className="text-3xl font-extrabold text-slate-900 uppercase tracking-tight">Malzeme Tedarik Planı</h1>
                            <p className="text-sm text-slate-500 mt-1 font-medium">İş zaman programına göre şantiyeye sevk edilecek malzeme listesi.</p>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Rapor Tarihi</div>
                            <div className="font-bold text-slate-800 text-base border border-slate-200 bg-slate-50 px-4 py-2 rounded-lg">
                                {new Date().toLocaleDateString('tr-TR')}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {procurementGroups.map((group, i) => (
                            <div key={i} className="break-inside-avoid border border-slate-200 rounded-xl overflow-hidden shadow-sm page-break-inside-avoid">
                                <div className="bg-slate-100 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold font-mono border border-slate-200 shadow-sm flex items-center gap-2">
                                            <i className="far fa-calendar-alt text-emerald-500"></i>
                                            {new Date(group.date).toLocaleDateString('tr-TR')}
                                        </div>
                                        <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">{group.taskName} AŞAMASI</h2>
                                    </div>
                                    <div className="text-sm flex items-center gap-2">
                                        <span className="text-slate-500 uppercase text-[10px] tracking-widest font-bold">Aşama Toplamı:</span>
                                        <span className="font-bold text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-sm">
                                            {group.totalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                        </span>
                                    </div>
                                </div>
                                <div className="p-0">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-white text-slate-400 border-b border-slate-200">
                                            <tr>
                                                <th className="py-2.5 px-5 font-bold uppercase tracking-wider text-[10px] w-1/2">Malzeme Adı</th>
                                                <th className="py-2.5 px-5 text-right font-bold uppercase tracking-wider text-[10px] w-1/4">Miktar</th>
                                                <th className="py-2.5 px-5 text-right font-bold uppercase tracking-wider text-[10px] w-1/4">Tutar</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {group.items.map((item, idx) => (
                                                <tr key={idx} className="even:bg-slate-50/50">
                                                    <td className="py-2.5 px-5 text-slate-700 font-medium">{item.name}</td>
                                                    <td className="py-2.5 px-5 text-right text-slate-600 font-mono">
                                                        {item.unit === 'Paket' ? '1 Paket' : `${item.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} ${item.unit}`}
                                                    </td>
                                                    <td className="py-2.5 px-5 text-right font-bold text-slate-900 font-mono">
                                                        {item.totalPrice.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-10 pt-6 border-t-2 border-slate-900 flex justify-between items-center break-inside-avoid bg-slate-50 p-6 rounded-xl border border-slate-200">
                        <div>
                            <h3 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight">Genel Tedarik Toplamı</h3>
                            <p className="text-xs text-slate-500 mt-1 font-medium">Şantiyeye inecek tüm fiziksel malzemelerin bütçesidir.</p>
                        </div>
                        <div className="text-4xl font-extrabold text-emerald-700 font-mono drop-shadow-sm">
                            {grandTotal.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                        </div>
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(modalContent, document.body);
};