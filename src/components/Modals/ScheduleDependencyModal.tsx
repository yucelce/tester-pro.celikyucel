// Dosya: src/components/Modals/ScheduleDependencyModal.tsx

import React, { useState } from 'react';
import { ScheduleItem } from '../../../api/_utils/scheduleCalculator';
import { useProjectStore } from '../../stores/projectStore';

interface ScheduleDependencyModalProps {
    schedule: ScheduleItem[];
    onClose: () => void;
}

export const ScheduleDependencyModal: React.FC<ScheduleDependencyModalProps> = ({ schedule, onClose }) => {
    const { updateScheduleOverride, scheduleOverrides } = useProjectStore();
    const [editingId, setEditingId] = useState<string | null>(null);

    // Düzenleme Geçici State'i
    const [tempDeps, setTempDeps] = useState<string[]>([]);
    const [tempType, setTempType] = useState<'finish_to_start' | 'start_to_start'>('finish_to_start');
    const [tempLag, setTempLag] = useState<number>(0);

    const startEdit = (item: ScheduleItem) => {
        setEditingId(item.id);
        setTempDeps(item.dependencies);
        setTempType(item.dependencyType);
        setTempLag(item.lagWeeks);
    };

    const handleSave = () => {
        if (!editingId) return;
        updateScheduleOverride(editingId, {
            manualDependencies: tempDeps,
            manualDependencyType: tempType,
            manualLagWeeks: tempLag
        });
        setEditingId(null);
    };

    const toggleDep = (depId: string) => {
        if (tempDeps.includes(depId)) {
            setTempDeps(tempDeps.filter(d => d !== depId));
        } else {
            setTempDeps([...tempDeps, depId]);
        }
    };

    // Kendisi veya döngüsel bağımlılık yaratacakları filtrelemek gerekir (basitçe kendisini çıkaralım)
    const availableDependencies = schedule.filter(s => s.id !== editingId);

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">
                        <i className="fas fa-project-diagram mr-2 text-blue-500"></i>
                        İş Akışı ve Bağımlılık Yöneticisi
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500"><i className="fas fa-times text-xl"></i></button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                    {/* SOL LİSTE: GÖREVLER */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                        <div className="text-xs text-slate-500 mb-2 font-bold uppercase">Proje İş Kalemleri</div>
                        {schedule.map((item) => (
                            <div key={item.id} className={`border rounded-lg p-3 transition ${editingId === item.id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 dark:bg-blue-900/20' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                                        <div>
                                            <h5 className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</h5>
                                            <div className="text-[10px] text-slate-500">
                                                {item.durationWeeks} Hafta | {item.startDate.toLocaleDateString('tr-TR')}
                                            </div>
                                        </div>
                                    </div>
                                    {editingId !== item.id && (
                                        <button onClick={() => startEdit(item)} className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded hover:bg-blue-100 text-slate-600 dark:text-slate-300">
                                            <i className="fas fa-pen mr-1"></i>Düzenle
                                        </button>
                                    )}
                                </div>

                                {/* Düzenleme Modu */}
                                {editingId === item.id ? (
                                    <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 animate-fadeIn">
                                        <div className="grid grid-cols-2 gap-4 mb-3">
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Bağımlılık Tipi</label>
                                                <select
                                                    value={tempType}
                                                    onChange={(e) => setTempType(e.target.value as any)}
                                                    className="w-full text-xs p-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                                >
                                                    <option value="finish_to_start">Bitiş - Başlangıç (FS)</option>
                                                    <option value="start_to_start">Başlangıç - Başlangıç (SS)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Bekleme (Hafta)</label>
                                                <input
                                                    type="number"
                                                    value={tempLag}
                                                    onChange={(e) => setTempLag(parseInt(e.target.value) || 0)}
                                                    className="w-full text-xs p-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Öncül Görevleri Seçin (Çoklu)</label>
                                            <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-900 space-y-1">
                                                {availableDependencies.map(dep => (
                                                    <label key={dep.id} className="flex items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-slate-800 p-1 rounded">
                                                        <input
                                                            type="checkbox"
                                                            checked={tempDeps.includes(dep.id)}
                                                            onChange={() => toggleDep(dep.id)}
                                                            className="rounded text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span className="text-xs text-slate-700 dark:text-slate-300">{dep.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 mt-3 justify-end">
                                            <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded text-xs text-slate-500 hover:bg-slate-200">İptal</button>
                                            <button onClick={handleSave} className="px-3 py-1.5 rounded text-xs bg-blue-600 text-white hover:bg-blue-500 font-bold">Kaydet</button>
                                        </div>
                                    </div>
                                ) : (
                                    // Görüntüleme Modu
                                    item.dependencies.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {item.dependencies.map(depId => {
                                                const depName = schedule.find(s => s.id === depId)?.name || depId;
                                                return (
                                                    <span key={depId} className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                                        <i className="fas fa-link mr-1"></i>{depName}
                                                    </span>
                                                )
                                            })}
                                            <span className="text-[9px] text-slate-400 self-center ml-1">
                                                ({item.dependencyType === 'finish_to_start' ? 'FS' : 'SS'} + {item.lagWeeks}w)
                                            </span>
                                        </div>
                                    )
                                )}
                            </div>
                        ))}
                    </div>

                    {/* SAĞ PANEL: BİLGİ */}
                    <div className="hidden md:block w-full md:w-64 bg-slate-50 dark:bg-slate-800/50 p-4 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 text-xs space-y-4">                        <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
                        <h4 className="font-bold mb-2">Nasıl Çalışır?</h4>
                        <p className="mb-2">Bir iş kaleminin başlaması için başka bir işin bitmesi (FS) veya başlaması (SS) gerekiyorsa buradan ayarlayabilirsiniz.</p>
                        <ul className="list-disc pl-4 space-y-1 opacity-80">
                            <li><strong>FS (Finish-Start):</strong> Önceki iş biter, bu başlar.</li>
                            <li><strong>SS (Start-Start):</strong> Önceki iş başlar, belli bir süre sonra bu da başlar.</li>
                            <li><strong>Bekleme (Lag):</strong> Araya hafta cinsinden boşluk koyar.</li>
                        </ul>
                    </div>
                        <div className="text-slate-500">
                            <i className="fas fa-exclamation-triangle text-yellow-500 mr-1"></i>
                            Manuel değişiklikler, otomatik oluşturulan mantığı geçersiz kılar. Döngüsel bağımlılık (A-&gt;B-&gt;A) oluşturmamaya dikkat edin.                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-right">
                    <button onClick={onClose} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded text-sm font-bold">Kapat</button>
                </div>
            </div>
        </div>
    );
};