// src/components/Modals/BrandSelectionModal.tsx
import React, { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { BRAND_CATEGORIES, BrandCategory } from '../../brand_data';

interface BrandSelectionModalProps {
    onClose: () => void;
}

export const BrandSelectionModal: React.FC<BrandSelectionModalProps> = ({ onClose }) => {
    const { reportSettings, updateReportSettings } = useProjectStore();
    
    // Geçici seçimleri dizi yapısı ile tutalım
    const [tempSelections, setTempSelections] = useState<Record<string, string[]>>(reportSettings.selectedBrands || {});
    const [activeTab, setActiveTab] = useState<string>(BRAND_CATEGORIES[0].categoryId);

    const handleSelect = (categoryId: string, brandId: string) => {
        setTempSelections(prev => {
            const currentCategorySelections = prev[categoryId] || [];
            
            // Eğer zaten seçiliyse diziden çıkart
            if (currentCategorySelections.includes(brandId)) {
                const newCategorySelections = currentCategorySelections.filter(id => id !== brandId);
                if (newCategorySelections.length === 0) {
                    const newState = { ...prev };
                    delete newState[categoryId];
                    return newState;
                }
                return { ...prev, [categoryId]: newCategorySelections };
            } 
            // Seçili değilse diziye ekle
            else {
                return { ...prev, [categoryId]: [...currentCategorySelections, brandId] };
            }
        });
    };

    const handleSave = () => {
        updateReportSettings({ selectedBrands: tempSelections });
        onClose();
    };

    const activeCategory = BRAND_CATEGORIES.find(c => c.categoryId === activeTab);

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden transition-colors duration-300">
                
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
                    <div>
                        <h3 className="text-slate-900 dark:text-white font-bold text-lg flex items-center gap-2">
                            <i className="fas fa-tags text-indigo-500"></i> Proje Marka Seçimi
                        </h3>
                        <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">Bu seçimler sadece "Çıktı Raporunda" görünecek, fiyatları etkilemeyecektir. Herhangi bir kategoride birden fazla marka seçebilirsiniz.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition"><i className="fas fa-times text-xl"></i></button>
                </div>

                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    
                    {/* Sol Kısım: Kategoriler */}
                    <div className="w-full md:w-56 bg-slate-100 dark:bg-slate-800/50 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 overflow-x-auto md:overflow-y-auto flex md:flex-col shrink-0 custom-scrollbar">
                        {BRAND_CATEGORIES.map((cat: BrandCategory) => {
                            // Kategoride en az 1 marka seçiliyse onay işaretini göster
                            const isSelected = !!tempSelections[cat.categoryId] && tempSelections[cat.categoryId].length > 0;
                            return (
                                <button
                                    key={cat.categoryId}
                                    onClick={() => setActiveTab(cat.categoryId)}
                                    className={`px-4 py-3 text-left font-bold text-xs md:text-sm border-b md:border-b-0 md:border-l-4 transition whitespace-nowrap flex justify-between items-center
                                        ${activeTab === cat.categoryId 
                                            ? 'bg-white dark:bg-slate-900 border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                                            : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                                >
                                    <span>{cat.title}</span>
                                    {isSelected && <i className="fas fa-check-circle text-green-500 text-[10px]"></i>}
                                </button>
                            );
                        })}
                    </div>

                    {/* Sağ Kısım: Markalar */}
                    <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900 custom-scrollbar">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {activeCategory?.brands.map(brand => {
                                // Seçili mi kontrol et (Dizi içinde ara)
                                const isActive = tempSelections[activeCategory.categoryId]?.includes(brand.id);
                                return (
                                    <div 
                                        key={brand.id}
                                        onClick={() => handleSelect(activeCategory.categoryId, brand.id)}
                                        className={`cursor-pointer rounded-xl border-2 transition-all duration-200 overflow-hidden relative group bg-white dark:bg-slate-800 flex flex-col h-32
                                            ${isActive ? 'border-indigo-500 shadow-md ring-2 ring-indigo-500/30' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'}`}
                                    >
                                        <div className="flex-1 p-2 flex items-center justify-center bg-white">
                                            {brand.image ? (
                                                <img src={brand.image} alt={brand.name} className="max-w-full max-h-full object-contain mix-blend-multiply" />
                                            ) : (
                                                <span className="text-slate-400 text-xs italic">Görsel Yok</span>
                                            )}
                                        </div>
                                        <div className={`p-2 text-center text-xs font-bold truncate border-t transition-colors
                                            ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}>
                                            {brand.name}
                                        </div>
                                        
                                        {isActive && (
                                            <div className="absolute top-2 right-2 bg-indigo-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                                                <i className="fas fa-check text-[10px]"></i>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-6 py-2 rounded-lg font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition">İptal</button>
                    <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-2 rounded-lg font-bold text-sm shadow-lg shadow-indigo-500/30 transition">Uygula ve Kaydet</button>
                </div>
            </div>
        </div>
    );
};