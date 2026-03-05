// src/components/Modals/DuplexManagerModal.tsx
import React, { useState, useMemo } from 'react';
import { useProjectStore } from '../../stores/projectStore';

interface DuplexManagerModalProps {
    onClose: () => void;
}

export const DuplexManagerModal: React.FC<DuplexManagerModalProps> = ({ onClose }) => {
    const { units, duplexPairs, addDuplexPair, updateDuplexPair, removeDuplexPair } = useProjectStore();
    const [lowerId, setLowerId] = useState('');
    const [upperId, setUpperId] = useState('');
    const [count, setCount] = useState(1);

    // --- YENİ: Dinamik Eşleşme Mantığı ---
    const availableUpperUnits = useMemo(() => {
        if (!lowerId) return []; // Önce giriş katı seçilmeli

        const selectedLowerUnit = units.find(u => u.id === lowerId);
        if (!selectedLowerUnit) return [];

        return units.filter(u => {
            // Bir tip kendisiyle eşleşemez dd
            if (u.id === lowerId) return false;

            const lowerType = selectedLowerUnit.floorType;
            const upperType = u.floorType;

            // Kural 1: Giriş Bodrum ise, diğeri sadece Zemin olabilir
            if (lowerType === 'basement') return upperType === 'ground';

            // Kural 2: Giriş Zemin ise, diğeri Bodrum (Ters Dubleks) veya Normal Kat olabilir
            if (lowerType === 'ground') return upperType === 'basement' || upperType === 'normal';

            // Kural 3: Giriş Normal Kat ise, diğeri Zemin veya başka bir Normal Kat olabilir (Bodrum Olamaz)
            if (lowerType === 'normal') return upperType === 'ground' || upperType === 'normal' || upperType === 'roof';

            return true;
        });
    }, [lowerId, units]);

    // Giriş katı değiştiğinde 2. kat seçimini sıfırla
    const handleLowerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setLowerId(e.target.value);
        setUpperId('');
    };

    const handleAdd = () => {
        if (!lowerId || !upperId) return alert('Lütfen eşleştirilecek iki kat tipini de seçin.');

        const lowerUnit = units.find(u => u.id === lowerId);
        const upperUnit = units.find(u => u.id === upperId);

        if (!lowerUnit || !upperUnit) return;

        // YENİ: Sadece BOŞTA KALAN (kullanılabilir) adetleri hesapla
        const usedLower = getUsedCount(lowerUnit.id);
        const usedUpper = getUsedCount(upperUnit.id);
        const availableLower = lowerUnit.count - usedLower;
        const availableUpper = upperUnit.count - usedUpper;

        const maxPossible = Math.min(availableLower, availableUpper);
        if (count > maxPossible) {
            return alert(`Eşleştirilecek adet (${count}), seçili tiplerin BOŞTA KALAN adetlerinden (${maxPossible}) fazla olamaz.\n\nNot: Bu tipler zaten başka bir dubleks eşleşmesinde kullanılıyor olabilir.`);
        }

        addDuplexPair({ lowerUnitId: lowerId, upperUnitId: upperId, count });
        setLowerId('');
        setUpperId('');
        setCount(1);
    };

    const getUnitName = (id: string) => units.find(u => u.id === id)?.name || 'Bilinmeyen Tip';

    // Kat tipini Türkçeleştiren yardımcı fonksiyon
    const getFloorLabel = (type: string) => type === 'basement' ? 'Bodrum' : type === 'ground' ? 'Zemin' : type === 'roof' ? 'Çatı' : 'Normal';

    const getUsedCount = (unitId: string, excludePairId?: string) => {
        return duplexPairs.reduce((sum, p) => {
            if (excludePairId && p.id === excludePairId) return sum;
            if (p.lowerUnitId === unitId || p.upperUnitId === unitId) return sum + p.count;
            return sum;
        }, 0);
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex justify-center items-center backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
                    <div>
                        <h3 className="text-white font-bold text-lg"><i className="fas fa-link mr-2 text-indigo-500"></i>Dubleks Kat Eşleştirme</h3>
                        <p className="text-xs text-slate-400 mt-1">İki farklı bağımsız bölüm tipini birleştirerek tek bir dubleks daire maliyeti çıkartın.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition"><i className="fas fa-times text-lg"></i></button>
                </div>

                <div className="p-4 border-b border-slate-700 bg-slate-800/30">
                    <div className="flex flex-col md:flex-row gap-3 items-end">
                        <div className="flex-1 w-full">
                            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Giriş Katı (1. Seçim)</label>
                            <select value={lowerId} onChange={handleLowerChange} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-indigo-500 outline-none">
                                <option value="">Önce bu katı seçiniz...</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.name} - [{getFloorLabel(u.floorType)}]</option>)}
                            </select>
                        </div>
                        <div className="flex items-center justify-center pb-2 px-2 hidden md:block">
                            <i className="fas fa-plus text-slate-500 text-sm"></i>
                        </div>
                        <div className="flex-1 w-full">
                            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Eşleşen Diğer Kat (2. Seçim)</label>
                            <select value={upperId} onChange={e => setUpperId(e.target.value)} disabled={!lowerId || availableUpperUnits.length === 0} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed">
                                <option value="">{lowerId ? (availableUpperUnits.length > 0 ? 'Seçiniz...' : 'Uygun eşleşme yok') : 'Önce giriş katını seçin'}</option>
                                {availableUpperUnits.map(u => <option key={u.id} value={u.id}>{u.name} - [{getFloorLabel(u.floorType)}]</option>)}
                            </select>
                        </div>
                        <div className="w-full md:w-24">
                            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Adet</label>
                            <input type="number" min="1" value={count} onChange={e => setCount(parseInt(e.target.value) || 1)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-indigo-500 outline-none text-center" />
                        </div>
                        <button onClick={handleAdd} disabled={!lowerId || !upperId} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 text-white px-4 py-2 rounded font-bold text-sm transition">
                            Eşleştir
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {duplexPairs.length === 0 ? (
                        <div className="text-center text-slate-500 text-sm py-8 border-2 border-dashed border-slate-700 rounded-lg">
                            Henüz eşleştirilmiş dubleks daire bulunmuyor.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {duplexPairs.map(pair => {
                                const lUnit = units.find(u => u.id === pair.lowerUnitId);
                                const uUnit = units.find(u => u.id === pair.upperUnitId);
                                return (
                                    <div key={pair.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1 w-full">
                                            <div className="bg-slate-900 border border-slate-600 rounded p-2 flex-1 text-center relative overflow-hidden">
                                                <div className="text-[10px] text-slate-400 font-bold mb-1">GİRİŞ KATI</div>
                                                <div className="text-sm font-bold text-white truncate" title={getUnitName(pair.lowerUnitId)}>{getUnitName(pair.lowerUnitId)}</div>
                                                <div className="text-[9px] text-indigo-400 mt-1">[{lUnit ? getFloorLabel(lUnit.floorType) : '?'}]</div>
                                            </div>
                                            <i className="fas fa-link text-indigo-400 text-lg"></i>
                                            <div className="bg-slate-900 border border-slate-600 rounded p-2 flex-1 text-center relative overflow-hidden">
                                                <div className="text-[10px] text-slate-400 font-bold mb-1">EŞLEŞEN KAT</div>
                                                <div className="text-sm font-bold text-white truncate" title={getUnitName(pair.upperUnitId)}>{getUnitName(pair.upperUnitId)}</div>
                                                <div className="text-[9px] text-indigo-400 mt-1">[{uUnit ? getFloorLabel(uUnit.floorType) : '?'}]</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={pair.count}
                                                    onChange={e => {
                                                        const newCount = Math.max(1, parseInt(e.target.value) || 1);
                                                        if (lUnit && uUnit) {
                                                            // YENİ: Güncelleme yaparken mevcut pair haricindeki kullanımları bul
                                                            const usedL = getUsedCount(lUnit.id, pair.id);
                                                            const usedU = getUsedCount(uUnit.id, pair.id);
                                                            const maxPossible = Math.min(lUnit.count - usedL, uUnit.count - usedU);

                                                            if (newCount > maxPossible) {
                                                                alert(`Adet, seçili tiplerin boşta kalan adetlerinden (${maxPossible}) fazla olamaz.`);
                                                                updateDuplexPair(pair.id, maxPossible);
                                                            } else {
                                                                updateDuplexPair(pair.id, newCount);
                                                            }
                                                        }
                                                    }}
                                                    className="w-16 bg-slate-950 border border-slate-600 rounded p-1.5 text-center text-white font-bold text-sm outline-none focus:border-indigo-500"
                                                />
                                                <span className="text-xs text-slate-400">Adet</span>
                                            </div>
                                            <button onClick={() => removeDuplexPair(pair.id)} className="text-slate-400 hover:text-red-500 transition bg-slate-900 w-8 h-8 rounded flex items-center justify-center border border-slate-700 hover:border-red-500">
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}