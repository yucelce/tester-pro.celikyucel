// src/stores/uiStore.tsx

import React, { createContext, useContext, useState, useCallback } from 'react';

type ViewType = 'dashboard' | 'editor' | 'report';
type ModalType = 'building' | 'structuralManager' | 'roomManager' | 'projectManagement' | 'brandSelection' | null;
type AuthStatus = 'idle' | 'loading' | 'success' | 'error';

interface UIContextType {
    activeView: ViewType;
    editorScope: 'architectural' | 'structural';
    activeUnitId: string | null;
    activeModal: ModalType;
    activeModalUnitId: string | null;

    // Auth State
    authStatus: AuthStatus;
    authMessage: string;
    accountId: string | null;
    setAuthStatus: (status: AuthStatus) => void;
    setAuthMessage: (message: string) => void;
    setAccountId: (id: string | null) => void;

    // Actions
    navigateToDashboard: () => void;
    navigateToEditor: (unitId: string, scope: 'architectural' | 'structural') => void;
    openModal: (type: ModalType, unitId?: string | null) => void;
    closeModal: () => void;

    // Dashboard Specific
    expandedCategories: Record<string, boolean>;
    toggleCategory: (id: string) => void;
    toggleAllCategories: (isExpanded: boolean, categoryIds: string[]) => void; // YENİ EKLENDİ
    navigateToReport: () => void;

    isTutorialActive: boolean;
    tutorialStep: number;
    startTutorial: () => void;
    nextTutorialStep: () => void;
    prevTutorialStep: () => void;
    closeTutorial: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeView, setActiveView] = useState<ViewType>('dashboard');
    const [editorScope, setEditorScope] = useState<'architectural' | 'structural'>('architectural');
    const [activeUnitId, setActiveUnitId] = useState<string | null>(null);

    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [activeModalUnitId, setActiveModalUnitId] = useState<string | null>(null);

    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    const [isTutorialActive, setIsTutorialActive] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);

    const startTutorial = useCallback(() => { 
        setIsTutorialActive(true); 
        setTutorialStep(0); 
    }, []);
    const nextTutorialStep = useCallback(() => setTutorialStep(p => p + 1), []);
    const prevTutorialStep = useCallback(() => setTutorialStep(p => Math.max(0, p - 1)), []);
    const closeTutorial = useCallback(() => { 
        setIsTutorialActive(false); 
        setTutorialStep(0); 
    }, []);

    // Auth State
    const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
    const [authMessage, setAuthMessage] = useState<string>('');
    const [accountId, setAccountId] = useState<string | null>(null);

    const navigateToDashboard = useCallback(() => {
        setActiveView('dashboard');
        setActiveUnitId(null);
    }, []);

    const navigateToEditor = useCallback((unitId: string, scope: 'architectural' | 'structural') => {
        setActiveUnitId(unitId);
        setEditorScope(scope);
        setActiveView('editor');
    }, []);

    const openModal = useCallback((type: ModalType, unitId: string | null = null) => {
        setActiveModal(type);
        setActiveModalUnitId(unitId);
    }, []);

    const closeModal = useCallback(() => {
        setActiveModal(null);
        setActiveModalUnitId(null);
    }, []);

    const navigateToReport = useCallback(() => {
        setActiveView('report');
    }, []);

    const toggleCategory = useCallback((id: string) => {
        setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
    }, []);

    // YENİ EKLENEN FONKSİYON
    const toggleAllCategories = useCallback((isExpanded: boolean, categoryIds: string[]) => {
        setExpandedCategories(prev => {
            const newState = { ...prev };
            categoryIds.forEach(id => {
                newState[id] = isExpanded;
            });
            return newState;
        });
    }, []);

    return (
        <UIContext.Provider value={{
            activeView, editorScope, activeUnitId, activeModal, activeModalUnitId,
            authStatus, authMessage, accountId, setAuthStatus, setAuthMessage, setAccountId,
            navigateToDashboard, navigateToEditor, openModal, closeModal,
            expandedCategories, toggleCategory, toggleAllCategories, navigateToReport,
            // --- EKLENECEK KISIM ---
            isTutorialActive, tutorialStep, startTutorial, nextTutorialStep, prevTutorialStep, closeTutorial
        }}>
            {children}
        </UIContext.Provider>
    );
};

export const useUIStore = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error("useUIStore must be used within UIProvider");
    return context;
};