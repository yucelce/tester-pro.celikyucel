// src/components/Report/DownloadView.tsx
import React, { useEffect, useState } from 'react';
import { exportProcurementToExcel } from '../../utils/excelUtils';

export const DownloadView = ({ downloadId }: { downloadId: string }) => {
    const [data, setData] = useState<any>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

    useEffect(() => {
        fetch(`/api/share?uuid=${downloadId}`)
            .then(res => res.json())
            .then(json => {
                if (json.success && json.data) {
                    setData(json.data);
                    setStatus('ready');
                } else {
                    setStatus('error');
                }
            })
            .catch(() => setStatus('error'));
    }, [downloadId]);

    if (status === 'loading') {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-lg animate-pulse font-bold tracking-widest">TEKLİF DOSYASI HAZIRLANIYOR...</p>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-900 p-4">
                <div className="bg-slate-800 p-8 rounded-2xl border border-red-500/30 max-w-md w-full text-center shadow-2xl">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fas fa-exclamation-triangle text-red-500 text-3xl"></i>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Bağlantı Geçersiz</h2>
                    <p className="text-slate-400 mb-6">Bu teklif bağlantısının süresi dolmuş (1 ay limiti) veya hatalı olabilir. Lütfen dosyayı gönderen firma ile iletişime geçin.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white p-6 relative overflow-hidden">
            {/* Arka plan dekoru */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="bg-slate-800/80 backdrop-blur-md p-8 md:p-12 rounded-3xl border border-slate-700 max-w-lg w-full text-center shadow-2xl z-10">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30 shadow-inner">
                    <i className="fas fa-file-excel text-emerald-400 text-4xl"></i>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold mb-3 text-white tracking-tight">{data.project_name}</h1>
                <p className="text-slate-400 mb-8 text-sm leading-relaxed">
                    Malzeme listesi ve fiyatlandırma şablonunuz hazır. Dosyayı Excel formatında indirip, birim fiyatlarınızı girerek geri dönüş yapabilirsiniz.
                </p>
                
                <button 
                    onClick={() => exportProcurementToExcel(data.project_name, data.data)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                    <i className="fas fa-download text-xl"></i>
                    Excel Formatında İndir
                </button>
            </div>
            <p className="mt-10 text-[10px] text-slate-600 uppercase tracking-widest font-bold z-10">CY Pro İnşaat Manager Tarafından Oluşturulmuştur</p>
        </div>
    );
};