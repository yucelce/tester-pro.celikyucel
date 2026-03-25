
import React, { useEffect } from 'react';
import { ProjectProvider, useProjectStore } from './stores/projectStore';
import { UIProvider, useUIStore } from './stores/uiStore';
import { ThemeProvider } from './contexts/ThemeContext';
import { DownloadView } from './components/Report/DownloadView';

// Views
import { DashboardView } from './components/Dashboard/DashboardView';
import { EditorView } from './components/Editor/EditorView';
import { ReportView } from './components/Report/ReportView';

// Modals
import { BuildingModal } from './components/Modals/BuildingModals';
import { StructuralManagerModal } from './components/Modals/StructuralManagerModal';
import { RoomManagerModal } from './components/Modals/RoomManagerModal';
import { ProjectManagementModal } from './components/Modals/ProjectManagementModal';

import { BrandSelectionModal } from './components/Modals/BrandSelectionModal';

const AppLayout = () => {

    const {
        activeView, activeModal, activeModalUnitId, closeModal,
        authStatus, authMessage, setAuthStatus, setAuthMessage, setAccountId
    } = useUIStore();
    const { units, structuralUnits, buildingStats, setBuildingStats, isFetchingHeat, updateUnit, costs, updateCostItem } = useProjectStore();


    const urlParams = new URLSearchParams(window.location.search);
    const downloadId = urlParams.get('downloadId');

    if (downloadId) {
        // Eğer linkte downloadId varsa, auth (giriş) sormadan direkt indirme sayfasını göster
        return <DownloadView downloadId={downloadId} />;
    }


    // --- AUTHENTICATION LOGIC ---
    useEffect(() => {
        const checkAccess = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const apiKey = urlParams.get('apiKey');

            // ARTIK URL'DEN ACCOUNT ID ALMIYORUZ
            // const accountId = urlParams.get('accountId');

            if (!apiKey) {
                setAuthStatus('error');

                setAuthMessage("API anahtarı eksik. Lütfen ana sayfa üzerinden giriş yapın.");
                return;
            }

            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState(null, '', newUrl);

            setAuthStatus('loading');

            try {

                //silinecek TESTER MOD

                if (apiKey == "admin") { //silinecek TESTER MOD
                    setAuthStatus('success');
                    setAccountId("admin")
                    return
                }

                const response = await fetch(`https://www.celikyucel.com/_functions/validateKey`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }); const data = await response.json();

                if (data.valid === true) {
                    setAuthStatus('success');
                    // WIX'ten gelen üye ID'sini güvenli bir şekilde sisteme kaydediyoruz
                    if (data.memberId) {
                        setAccountId(data.memberId);
                    }
                } else {
                    setAuthStatus('error');
                    setAuthMessage(data.message || "API anahtarınızın süresi dolmuş veya geçersiz.");
                }
            } catch (error) {
                console.error("Doğrulama hatası:", error);
                setAuthStatus('error');


                setAuthMessage("Sistem doğrulaması şu an yapılamıyor. Lütfen daha sonra tekrar deneyin.");
            }
        };

        checkAccess();
    }, [setAuthStatus, setAuthMessage, setAccountId]);

    // --- RENDER AUTH STATES ---
    if (authStatus === 'loading') {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-lg animate-pulse">Giriş Yapılıyor...</p>
                </div>
            </div>
        );
    }

    if (authStatus === 'error') {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-900 p-4">
                <div className="bg-slate-800 p-8 rounded-xl border border-red-500/30 max-w-md w-full text-center shadow-2xl">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fas fa-lock text-red-500 text-3xl"></i>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Erişim Reddedildi</h2>
                    <p className="text-slate-400 mb-6">{authMessage}</p>
                    <a href="https://www.celikyucel.com" className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold transition">
                        Ana Sayfaya Dön
                    </a>
                </div>
            </div>
        );
    }

    // Helper to find unit for modals
    const getModalUnit = () => {
        if (!activeModalUnitId) return null;
        return units.find(u => u.id === activeModalUnitId) || structuralUnits.find(u => u.id === activeModalUnitId);
    };

    const modalUnit = getModalUnit();

    return (
        <>
            {activeView === 'dashboard' ? <DashboardView /> :
                activeView === 'editor' ? <EditorView /> :
                    activeView === 'report' ? <ReportView /> : null} {/* <-- BURAYI GÜNCELLEYİN */}

            {/* Modallar... */}

            {/* Global Modals Controlled by UI Store */}
            {activeModal === 'building' && (
                <BuildingModal
                    onClose={closeModal}
                    buildingStats={buildingStats}
                    setBuildingStats={setBuildingStats}
                    handleProvinceChange={(e) => setBuildingStats({ ...buildingStats, province: e.target.value })} // Simplified for brevity, logic in store ideally
                    handleDistrictChange={(e) => setBuildingStats({ ...buildingStats, district: e.target.value })}
                    isFetchingHeat={isFetchingHeat}
                />
            )}

            {activeModal === 'structuralManager' && modalUnit && (
                <StructuralManagerModal
                    unit={modalUnit}
                    onClose={closeModal}
                    onUpdateUnit={updateUnit}
                />
            )}

            {activeModal === 'roomManager' && modalUnit && (
                <RoomManagerModal
                    unit={modalUnit}
                    onClose={closeModal}
                    onUpdateUnit={updateUnit}
                    costs={costs}
                    buildingStats={buildingStats}
                    onUpdateCostItem={updateCostItem}
                />
            )}

            {activeModal === 'projectManagement' && (
                <ProjectManagementModal onClose={closeModal} />
            )}

            {activeModal === 'brandSelection' && (
                <BrandSelectionModal onClose={closeModal} />
            )}
        </>
    );
};

export const App = () => {
    return (
        <ThemeProvider>
            <UIProvider>
                <ProjectProvider>
                    <AppLayout />
                </ProjectProvider>
            </UIProvider>
        </ThemeProvider>
    );
};
