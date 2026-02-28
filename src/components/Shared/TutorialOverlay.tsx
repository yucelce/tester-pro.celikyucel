// src/components/Shared/TutorialOverlay.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useUIStore } from '../../stores/uiStore';

const STEPS = [
    { targetId: 'tour-total-cost', title: 'Hoş Geldiniz! 🚀', content: 'Siz projeyi şekillendirdikçe, buradaki toplam maliyet canlı olarak güncellenecektir.' },
    { targetId: 'tour-building-stats', title: '1. Yapı Genel Bilgileri', content: 'Projeye buradan başlayın. Arsa alanı, il/ilçe ve kat sayılarını girdiğinizde program; hafriyat, iskele, çatı ve yalıtım gibi birçok kaba metrajı otomatik hesaplar.' },
    { targetId: 'tour-structural', title: '2. İskelet Sistemi', content: 'Kaba yapınızı detaylandırın. İsterseniz otomatik modda bırakın, isterseniz "Detaylı" moda geçip kendi duvar, kolon ve döşemelerinizi çizerek nokta atışı metraj alın.' },
    { targetId: 'tour-units', title: '3. Bağımsız Bölümler', content: 'Daire tiplerinizi (2+1 vb.) oluşturun. İçine eklediğiniz odaların tipine göre zemin, seramik, boya ve kapı/pencere metrajları otomatik yazılır.' },
    { targetId: 'tour-cost-details', title: '4. Maliyet Detayları', content: 'Tüm bu veriler burada birleşir. Sistem piyasa ortalaması fiyatlar sunar, ancak dilediğiniz kalemin birim fiyatına veya metrajına manuel müdahale edebilirsiniz.' },
    { targetId: 'tour-financial', title: '5. Zaman ve Nakit', content: 'İnşaat sürenize göre aylık nakit akışınızı görün, enflasyon stres testi yapın ve başa baş noktanızı analiz edin.' },
    { targetId: 'tour-report-btn', title: '6. Çıktı Alma', content: 'Her şey tamamsa, müşteriniz için kurumsal logolu, kapaklı ve kâr marjlı profesyonel bir PDF teklif dosyası oluşturabilirsiniz. İyi çalışmalar!' },
];

export const TutorialOverlay: React.FC = () => {
    const { isTutorialActive, tutorialStep, nextTutorialStep, prevTutorialStep, closeTutorial } = useUIStore();
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    // Sadece kutunun (maskenin) pozisyonunu günceller (Titremeyi önler)
    const updateRectPosition = useCallback(() => {
        if (!isTutorialActive) return;
        const currentStep = STEPS[tutorialStep];
        if (!currentStep) return;

        const element = document.getElementById(currentStep.targetId);
        if (element) {
            setTargetRect(element.getBoundingClientRect());
        }
    }, [isTutorialActive, tutorialStep]);

    // Adım değiştiğinde yumuşak şekilde hedefe kaydırır
    useEffect(() => {
        if (!isTutorialActive) {
            setTargetRect(null);
            return;
        }
        
        const currentStep = STEPS[tutorialStep];
        if (!currentStep) {
            closeTutorial();
            return;
        }

        const element = document.getElementById(currentStep.targetId);
        if (element) {
            // Maliyet detayları gibi büyük panellerde üst kısmı (başlığı) baz al, diğerlerinde ortala
            const isLargePanel = ['tour-cost-details', 'tour-structural', 'tour-units', 'tour-financial'].includes(currentStep.targetId);
            
            element.scrollIntoView({ 
                behavior: 'smooth', 
                block: isLargePanel ? 'start' : 'center' 
            });
            
            // Animasyon süresi bitince kutuyu hizala
            setTimeout(() => {
                setTargetRect(element.getBoundingClientRect());
            }, 400);
        } else {
            console.warn("Tutorial target not found, skipping:", currentStep.targetId);
            nextTutorialStep();
        }
    }, [isTutorialActive, tutorialStep, closeTutorial, nextTutorialStep]);

    // Dinamik Ekran Değişimlerini Dinle
    useEffect(() => {
        window.addEventListener('resize', updateRectPosition);
        window.addEventListener('scroll', updateRectPosition, true);
        
        return () => {
            window.removeEventListener('resize', updateRectPosition);
            window.removeEventListener('scroll', updateRectPosition, true);
        };
    }, [updateRectPosition]);

    if (!isTutorialActive || !targetRect) return null;

    const currentStepData = STEPS[tutorialStep];
    const isLastStep = tutorialStep === STEPS.length - 1;
    const padding = 12;

    // --- BALON KONUMLANDIRMA MANTIĞI (GELİŞTİRİLDİ) ---
    let popoverTop = targetRect.bottom + padding + 10;
    let popoverLeft = targetRect.left;

    // Alt tarafa taşıyorsa yukarı al
    if (popoverTop + 200 > window.innerHeight) {
        popoverTop = targetRect.top - padding - 220; 
    }

    // Yukarıya alındığında da taşıyorsa (hedef alan çok büyükse), ortala
    if (popoverTop < 10) {
        popoverTop = window.innerHeight / 2 - 100; // Ekranın ortasına sabitle
        popoverLeft = window.innerWidth / 2 - 160; 
    }

    // Sol ve sağ kenarlardan ekran dışına çıkmasını engelle
    popoverLeft = Math.max(10, Math.min(popoverLeft, window.innerWidth - 340));

    return (
        <>
            {/* Karanlık Maske */}
            <div 
                className="fixed z-[9998] pointer-events-none transition-all duration-500 ease-in-out"
                style={{
                    top: targetRect.top - padding,
                    left: targetRect.left - padding,
                    width: targetRect.width + padding * 2,
                    height: targetRect.height + padding * 2,
                    boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.75)', // slate-900 / 75%
                    borderRadius: '0.75rem',
                }}
            />

            {/* Bilgi Balonu */}
            <div 
                className="fixed z-[9999] w-[320px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-blue-500/30 p-5 flex flex-col gap-3 transition-all duration-500 ease-in-out"
                style={{
                    top: popoverTop,
                    left: popoverLeft,
                }}
            >
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                        Adım {tutorialStep + 1} / {STEPS.length}
                    </span>
                    <button onClick={closeTutorial} className="text-slate-400 hover:text-red-500 transition">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{currentStepData.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{currentStepData.content}</p>
                </div>

                <div className="flex justify-between items-center mt-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <button 
                        onClick={prevTutorialStep}
                        disabled={tutorialStep === 0}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 transition"
                    >
                        Geri
                    </button>
                    
                    <button 
                        onClick={isLastStep ? closeTutorial : nextTutorialStep}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition"
                    >
                        {isLastStep ? 'Turu Bitir' : 'İleri'} <i className={`fas ${isLastStep ? 'fa-check' : 'fa-arrow-right'} ml-1`}></i>
                    </button>
                </div>
            </div>
        </>
    );
};