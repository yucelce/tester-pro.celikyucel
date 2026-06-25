// src/components/Dashboard/FinancialAnalysisPanel.tsx

import React, { useState, useMemo, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { NumericInput } from '../Shared/NumericInput';
import { SalePlan } from '../../types';

// --- TARIH YARDIMCI FONKSIYONLARI ---
const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}

const formatMonth = (date: Date) => {
    return date.toISOString().slice(0, 7);
}

const formatMonthDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    return `${months[parseInt(month) - 1]} ${year}`;
}

const calculateSCurve = (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x * x * (3 - 2 * x);
}

export const FinancialAnalysisPanel: React.FC = () => {
    const { projectTotalCost, totalConstructionArea, projectSchedule, financialSettings, updateFinancialSettings, addSale, removeSale, units, buildingStats, projectCostDetails, globalStats, duplexPairs } = useProjectStore();
    const [isExpanded, setIsExpanded] = useState(false);
    // --- YENİ UI STATE'LERİ (SEKMELER VE GÖRÜNÜM İÇİN) ---
    const [leftTab, setLeftTab] = useState<'sermaye' | 'gelir' | 'risk'>('sermaye');
    const [rightView, setRightView] = useState<'chart' | 'table'>('chart');

    const [equityAmount, setEquityAmount] = useState<number | null>(null);
    const [useLoan, setUseLoan] = useState(false);
    const [loanAmount, setLoanAmount] = useState<number | null>(null);
    const [loanDate, setLoanDate] = useState<string>('');
    const [loanRepayStartDate, setLoanRepayStartDate] = useState<string>('');
    const [loanDuration, setLoanDuration] = useState<number>(12);
    const [loanInterestRate, setLoanInterestRate] = useState(4.5);
    const [stressCostIncrease, setStressCostIncrease] = useState(0);
    const [stressDelayMonths, setStressDelayMonths] = useState(0);
    const [targetProfitMargin, setTargetProfitMargin] = useState(30);
    const [hoveredChartIndex, setHoveredChartIndex] = useState<number | null>(null);

    const startDate = useMemo(() => {
        if (buildingStats.projectStartDate) return new Date(buildingStats.projectStartDate);
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d;
    }, [buildingStats.projectStartDate]);

    const constructionEndDate = useMemo(() => {
        if (projectSchedule.length > 0) {
            return new Date(Math.max(...projectSchedule.map(t => t.endDate.getTime())));
        }
        return addMonths(startDate, 12);
    }, [projectSchedule, startDate]);

    const currentEquityAmount = equityAmount !== null ? equityAmount : (useLoan ? Math.max(0, projectTotalCost - (loanAmount || 0)) : projectTotalCost);
    const currentLoanAmount = useLoan && loanAmount !== null ? loanAmount : 0;
    const currentLoanDate = loanDate || formatMonth(startDate);
    const currentLoanRepayDate = loanRepayStartDate || formatMonth(addMonths(new Date(currentLoanDate + '-01'), 1));

    const financialEndDate = useMemo(() => {
        let maxD = new Date(constructionEndDate);

        financialSettings.sales.forEach(s => {
            if (s.saleDate) {
                const originalDate = new Date(s.saleDate + '-01');
                const sd = addMonths(originalDate, stressDelayMonths);
                if (sd > maxD) maxD = sd;
            }
        });
        if (useLoan && currentLoanAmount > 0 && currentLoanRepayDate && loanDuration > 0) {
            const repayEnd = addMonths(new Date(currentLoanRepayDate + '-01'), loanDuration - 1);
            if (repayEnd > maxD) maxD = repayEnd;
        }
        return maxD;
    }, [constructionEndDate, financialSettings.sales, useLoan, currentLoanAmount, currentLoanRepayDate, loanDuration, stressDelayMonths]);

    const financialEndDateStr = formatMonth(financialEndDate);
    const defaultSaleDate = formatMonth(addMonths(constructionEndDate, 3));
    const [newSale, setNewSale] = useState({ name: '', amount: 0, saleDate: defaultSaleDate, vatRate: 0.20 });

    const handleAddSale = () => {
        if (!newSale.name || newSale.amount <= 0 || !newSale.saleDate) return;
        addSale({ id: Date.now().toString(), name: newSale.name, amount: newSale.amount, month: 0, saleDate: newSale.saleDate, vatRate: newSale.vatRate });
        setNewSale({ name: '', amount: 0, saleDate: defaultSaleDate, vatRate: 0.20 });
    };
    const revenueModel = financialSettings.revenueModel || 'yap_sat';
    const progressPayments = financialSettings.progressPayments || [];

    const handleUpdateProgressPayment = (taskId: string, percentage: number) => {
        let updated = [...progressPayments];
        const existingIndex = updated.findIndex(p => p.taskId === taskId);
        if (existingIndex >= 0) {
            updated[existingIndex].percentage = percentage;
        } else {
            updated.push({ id: Date.now().toString(), taskId, percentage });
        }
        updateFinancialSettings({ progressPayments: updated });
    };

    const autoPopulateHakedis = () => {
        const mainTasks = projectSchedule.filter(t => ['structure', 'walls', 'mep_rough', 'flooring', 'handover'].includes(t.id));
        if (mainTasks.length > 0) {
            const share = Math.floor(100 / mainTasks.length);
            const newPps = mainTasks.map((t, i) => ({
                id: Math.random().toString(),
                taskId: t.id,
                percentage: i === mainTasks.length - 1 ? 100 - (share * (mainTasks.length - 1)) : share
            }));
            updateFinancialSettings({ progressPayments: newPps });
        }
    };

    const toggleFixedTask = (taskId: string) => {
        const fixed = financialSettings.fixedPriceTaskIds || [];
        if (fixed.includes(taskId)) {
            updateFinancialSettings({ fixedPriceTaskIds: fixed.filter(id => id !== taskId) });
        } else {
            updateFinancialSettings({ fixedPriceTaskIds: [...fixed, taskId] });
        }
    };

    // --- NAKİT AKIŞI HESAPLAMA MANTIĞI (AYNEN KORUNDU) ---
    const cashflow = useMemo(() => {
        if (!projectTotalCost || projectSchedule.length === 0) return null;

        const stressedTotalCost = projectTotalCost * (1 + (stressCostIncrease / 100));
        const depositInterestRate = financialSettings.monthlyInterestRate / 100;
        const inflationRate = (financialSettings.monthlyInflationRate || 0) / 100;
        const fixedTasks = financialSettings.fixedPriceTaskIds || [];

        const r = loanInterestRate / 100;
        const EMI = r > 0 && currentLoanAmount > 0 && loanDuration > 0
            ? (currentLoanAmount * r * Math.pow(1 + r, loanDuration)) / (Math.pow(1 + r, loanDuration) - 1)
            : (loanDuration > 0 ? currentLoanAmount / loanDuration : 0);

        const sales = financialSettings.sales.map(s => {
            const originalDate = new Date((s.saleDate || formatMonth(startDate)) + '-01');
            const shiftedDate = addMonths(originalDate, stressDelayMonths);
            return { ...s, saleDate: formatMonth(shiftedDate) };
        });

        const expensesByMonth: Record<string, number> = {};
        const tasksByMonth: Record<string, string[]> = {};

        let projectStartMonthDate = new Date(formatMonth(startDate) + '-01');
        const taskActualCosts: Record<string, number> = {};

        const getTaskForCategory = (catId: string, itemName: string): string => {
            const nameLower = itemName.toLowerCase();
            if (nameLower.includes('yeşil etiket') || nameLower.includes('asansör ruhsat') || nameLower.includes('enerji kimlik')) return 'handover';
            switch (catId) {
                case 'arsa_finansman': return 'official';
                case 'resmi_idari': return nameLower.includes('iskan') ? 'handover' : 'official';
                case 'santiye_hafriyat': return (nameLower.includes('hafriyat') || nameLower.includes('iksa') || nameLower.includes('jcb')) ? 'excavation' : (nameLower.includes('güvenlik ağı') ? 'structure' : 'site_prep');
                case 'kaba_insaat': return nameLower.includes('çatı') ? 'roof' : 'structure';
                case 'duvar_tavan': return (nameLower.includes('kartonpiyer') || nameLower.includes('stropiyer') || nameLower.includes('boya')) ? 'paint' : (nameLower.includes('sıva') || nameLower.includes('alçı') ? 'plaster' : 'walls');
                case 'dis_cephe': return 'facade';
                case 'zemin_kaplama': return nameLower.includes('şap') ? 'screed' : 'flooring';
                case 'mobilya_ahsap': return 'joinery';
                case 'vitrifiye_ankastre': return 'mep_finish';
                case 'mekanik_tesisat': return (nameLower.includes('altyapı') || nameLower.includes('tesisat')) ? 'mep_rough' : 'mep_finish';
                case 'elektrik_tesisat': return (nameLower.includes('kablo') || nameLower.includes('sorti') || nameLower.includes('altyapı') || nameLower.includes('boru')) ? 'mep_rough' : 'mep_finish';
                case 'peyzaj_cevre': return 'landscape';
                case 'ozel_kalemler': return 'handover';
                default: return 'structure';
            }
        };

        projectCostDetails.forEach(cat => {
            cat.items.forEach(item => {
                if (item.totalPrice > 0) {
                    const taskId = getTaskForCategory(cat.id, item.name);
                    taskActualCosts[taskId] = (taskActualCosts[taskId] || 0) + item.totalPrice;
                }
            });
        });

        const stressMultiplier = 1 + (stressCostIncrease / 100);

        projectSchedule.forEach(task => {
            const baseTaskCost = (taskActualCosts[task.id] || 0) * stressMultiplier;
            const taskStartDate = new Date(task.startDate); // <-- İSİM DEĞİŞTİ
            const endDate = new Date(task.endDate);
            const totalDays = (endDate.getTime() - taskStartDate.getTime()) / (1000 * 3600 * 24) || 1; // <-- BURASI DA GÜNCELLENDİ

            let monthsDiff = (endDate.getFullYear() - projectStartMonthDate.getFullYear()) * 12 + (endDate.getMonth() - projectStartMonthDate.getMonth());
            monthsDiff = Math.max(0, monthsDiff);
            let finalTaskCost = fixedTasks.includes(task.id) ? baseTaskCost : baseTaskCost * Math.pow(1 + inflationRate, monthsDiff);

            let currentD = new Date(taskStartDate); // <-- BURASI DA GÜNCELLENDİ
            let accumulatedDays = 0;

            while (currentD <= endDate) {
                let eom = new Date(currentD.getFullYear(), currentD.getMonth() + 1, 0);
                if (eom > endDate) eom = endDate;

                let daysInThisMonth = (eom.getTime() - currentD.getTime()) / (1000 * 3600 * 24);
                if (daysInThisMonth === 0) daysInThisMonth = 1;

                const startProgressRatio = accumulatedDays / totalDays;
                accumulatedDays += daysInThisMonth;
                const endProgressRatio = accumulatedDays / totalDays;

                let costRatio = calculateSCurve(endProgressRatio) - calculateSCurve(startProgressRatio);
                let monthStr = formatMonth(currentD);

                expensesByMonth[monthStr] = (expensesByMonth[monthStr] || 0) + (finalTaskCost * costRatio);

                if (!tasksByMonth[monthStr]) tasksByMonth[monthStr] = [];
                if (!tasksByMonth[monthStr].includes(task.name)) tasksByMonth[monthStr].push(task.name);

                currentD = new Date(currentD.getFullYear(), currentD.getMonth() + 1, 1);
            }
        });

        const salesByMonth: Record<string, number> = {};
        const contractValue = projectTotalCost * (1 + targetProfitMargin / 100);

        if (financialSettings.revenueModel === 'taahhut') {
            const progressPayments = financialSettings.progressPayments || [];
            progressPayments.forEach(pp => {
                const task = projectSchedule.find(t => t.id === pp.taskId);
                if (task && pp.percentage > 0) {
                    const shiftedDate = addMonths(task.endDate, stressDelayMonths);
                    const monthStr = formatMonth(shiftedDate);
                    const paymentAmount = contractValue * (pp.percentage / 100);
                    salesByMonth[monthStr] = (salesByMonth[monthStr] || 0) + paymentAmount;
                }
            });
        } else {
            sales.forEach(sale => {
                if (sale.saleDate) {
                    let saleDateObj = new Date(sale.saleDate + '-01');
                    let saleMonthsDiff = (saleDateObj.getFullYear() - projectStartMonthDate.getFullYear()) * 12 + (saleDateObj.getMonth() - projectStartMonthDate.getMonth());
                    saleMonthsDiff = Math.max(0, saleMonthsDiff);
                    let inflatedSaleAmount = sale.amount * Math.pow(1 + inflationRate, saleMonthsDiff);
                    salesByMonth[sale.saleDate] = (salesByMonth[sale.saleDate] || 0) + inflatedSaleAmount;
                }
            });
        }

        const allMonthsSet = new Set([...Object.keys(expensesByMonth), ...Object.keys(salesByMonth)]);
        allMonthsSet.add(formatMonth(startDate));
        allMonthsSet.add(financialEndDateStr);
        if (useLoan && currentLoanAmount > 0) allMonthsSet.add(currentLoanDate);

        const sortedMonths = Array.from(allMonthsSet).sort();
        if (sortedMonths.length === 0) return null;

        let currentD = new Date(sortedMonths[0] + '-01');
        const endD = new Date(sortedMonths[sortedMonths.length - 1] + '-01');

        const continuousMonths = [];
        while (currentD <= endD) {
            continuousMonths.push(formatMonth(currentD));
            currentD.setMonth(currentD.getMonth() + 1);
        }

        const table: any[] = [];
        let currentCash = 0;
        let currentLoanPrincipal = 0;
        let repayCount = 0;

        let totalInterestEarned = 0;
        let totalInterestPaid = 0;
        let totalExpenses = 0;
        let totalSales = 0;
        let cumulativeExpense = 0;
        let cumulativeSales = 0;
        let peakEquityNeeded = 0;

        continuousMonths.forEach((mStr, index) => {
            const isFirstMonth = index === 0;

            const equityInject = isFirstMonth ? currentEquityAmount : 0;
            const exp = expensesByMonth[mStr] || 0;
            const sal = salesByMonth[mStr] || 0;
            const loanDraw = (useLoan && mStr === currentLoanDate) ? currentLoanAmount : 0;

            const startCash = currentCash;
            if (loanDraw > 0) currentLoanPrincipal += loanDraw;

            let loanInstallment = 0;
            let interestPaid = 0;
            let principalPaid = 0;

            if (useLoan && mStr >= currentLoanRepayDate && repayCount < loanDuration && currentLoanPrincipal > 0) {
                loanInstallment = EMI;
                interestPaid = currentLoanPrincipal * r;
                principalPaid = loanInstallment - interestPaid;

                if (repayCount === loanDuration - 1 || principalPaid > currentLoanPrincipal) {
                    principalPaid = currentLoanPrincipal;
                    loanInstallment = principalPaid + interestPaid;
                }
                currentLoanPrincipal -= principalPaid;
                repayCount++;
            }

            const interestEarned = startCash > 0 ? startCash * depositInterestRate : 0;

            currentCash = startCash + equityInject + loanDraw + sal + interestEarned - exp - loanInstallment;

            if (currentCash < peakEquityNeeded) peakEquityNeeded = currentCash;

            cumulativeExpense += exp + interestPaid;
            cumulativeSales += sal + interestEarned;

            const totalIncomeThisMonth = equityInject + loanDraw + sal + interestEarned;
            const totalExpenseThisMonth = exp + loanInstallment;

            let descItems = [];
            if (equityInject > 0) descItems.push('Sermaye');
            if (loanDraw > 0) descItems.push('Kredi');
            if (sal > 0) descItems.push(financialSettings.revenueModel === 'taahhut' ? 'Hakediş' : 'Satış');

            let tooltipDescription = '';
            if (exp > 0) {
                const monthTasks = tasksByMonth[mStr] || [];
                if (monthTasks.length > 0) {
                    const taskStr = monthTasks.length > 2 ? `${monthTasks.slice(0, 2).join(', ')}...` : monthTasks.join(', ');
                    descItems.push(`İnşaat (${taskStr})`);
                } else {
                    descItems.push('İnşaat');
                }
            }
            if (loanInstallment > 0) descItems.push('Taksit');
            if (interestEarned > 0 && descItems.length === 0) descItems.push('Faiz');

            const rowDescription = descItems.join(' + ') || '-';
            const fullTasksStr = tasksByMonth[mStr] ? tasksByMonth[mStr].join(', ') : '';
            tooltipDescription = fullTasksStr ? `${rowDescription}\n\nBu aydaki işler:\n• ${tasksByMonth[mStr].join('\n• ')}` : rowDescription;

            table.push({
                monthStr: mStr,
                displayMonth: formatMonthDisplay(mStr),
                startBalance: startCash,
                equityInject,
                totalIncome: totalIncomeThisMonth,
                totalExpense: totalExpenseThisMonth,
                endBalance: currentCash,
                cumulativeExpense,
                cumulativeSales,
                description: rowDescription,
                tooltip: tooltipDescription
            });

            totalInterestEarned += interestEarned;
            totalInterestPaid += interestPaid;
            totalExpenses += exp;
            totalSales += sal;
        });

        const actualTotalCostWithInflation = Object.values(expensesByMonth).reduce((a, b) => a + b, 0);

        const monthsCount = Math.max(0, continuousMonths.length - 1);
        const alternativeBalance = currentEquityAmount * Math.pow(1 + depositInterestRate, monthsCount);
        const alternativeProfit = alternativeBalance - currentEquityAmount;

        return {
            table,
            totals: {
                totalInterestEarned,
                totalInterestPaid,
                totalExpenses,
                totalSales,
                finalBalance: currentCash,
                actualTotalCostWithInflation,
                peakEquityNeeded: Math.abs(Math.min(0, peakEquityNeeded)),
                alternativeBalance,
                alternativeProfit,
                monthsCount
            }
        };
    }, [projectTotalCost, projectSchedule, financialSettings, startDate, loanInterestRate, stressCostIncrease, stressDelayMonths, currentEquityAmount, currentLoanAmount, currentLoanDate, currentLoanRepayDate, loanDuration, useLoan, financialEndDateStr, targetProfitMargin]);

    const tableData = cashflow?.table || [];
    const totals = cashflow?.totals || { totalInterestEarned: 0, totalInterestPaid: 0, totalExpenses: 0, totalSales: 0, finalBalance: 0, actualTotalCostWithInflation: projectTotalCost, peakEquityNeeded: 0, alternativeBalance: 0, alternativeProfit: 0, monthsCount: 0 };

    useEffect(() => {
        if (isExpanded && financialSettings.sales.length === 0 && units.length > 0 && projectTotalCost > 0) {
            handleAutoPopulate();
        }
    }, [isExpanded]);

    const handleAutoPopulate = () => {
        if (units.length === 0) return;
        const defaultSales: SalePlan[] = [];

        const isKatKarsiligi = buildingStats.constructionModel === 'kat_karsiligi';
        const shareRatio = isKatKarsiligi ? ((buildingStats.contractorShare || 50) / 100) : 1;

        const currentTotalCost = totals?.actualTotalCostWithInflation || projectTotalCost;
        const totalTargetRevenue = currentTotalCost * (1 + targetProfitMargin / 100);
        const targetDate = formatMonth(addMonths(constructionEndDate, 3));

        // Kat şerefiye katsayıları
        const FLOOR_MULTIPLIERS: Record<string, number> = {
            basement: 0.85,
            ground: 0.95,
            normal: 1.05,
            roof: 1.15
        };

        let totalEffectiveArea = 0;
        const salableUnitsData: { name: string, effectiveArea: number, netArea: number }[] = [];

        // Müsait birim adetlerini bulalım (Dubleksler ayrılacak):
        const availableUnitCounts: Record<string, number> = {};
        units.forEach(u => availableUnitCounts[u.id] = u.count);

        // 1. Dubleksleri İşle
        duplexPairs.forEach(pair => {
            const lowerUnit = units.find(u => u.id === pair.lowerUnitId);
            const upperUnit = units.find(u => u.id === pair.upperUnitId);

            if (lowerUnit && upperUnit) {
                const c = Math.min(pair.count, availableUnitCounts[pair.lowerUnitId] || 0, availableUnitCounts[pair.upperUnitId] || 0);
                if (c > 0) {
                    availableUnitCounts[pair.lowerUnitId] -= c;
                    availableUnitCounts[pair.upperUnitId] -= c;

                    // Alanları hesapla (Tanımlı değilse varsayılan 50m2 kabul et)
                    const lowerArea = lowerUnit.rooms.reduce((acc, r) => acc + (r.manualAreaM2 || (lowerUnit.scale > 0 ? r.area_px / (lowerUnit.scale ** 2) : 0)), 0) || 50;
                    const upperArea = upperUnit.rooms.reduce((acc, r) => acc + (r.manualAreaM2 || (upperUnit.scale > 0 ? r.area_px / (upperUnit.scale ** 2) : 0)), 0) || 50;

                    const lowerEffective = lowerArea * (FLOOR_MULTIPLIERS[lowerUnit.floorType] || 1.0);
                    const upperEffective = upperArea * (FLOOR_MULTIPLIERS[upperUnit.floorType] || 1.0);
                    const totalDuplexEffective = lowerEffective + upperEffective;

                    const salableDuplexCount = Math.round(c * shareRatio);
                    for (let i = 0; i < salableDuplexCount; i++) {
                        salableUnitsData.push({
                            name: `Dubleks (${lowerUnit.name} + ${upperUnit.name})`,
                            effectiveArea: totalDuplexEffective,
                            netArea: lowerArea + upperArea // YENİ EKLENDİ
                        });
                        totalEffectiveArea += totalDuplexEffective;
                    }
                }
            }
        });

        // 2. Kalan standart birimleri işle
        units.forEach(u => {
            const availableCount = availableUnitCounts[u.id] || 0;
            if (availableCount > 0) {
                const area = u.rooms.reduce((acc, r) => acc + (r.manualAreaM2 || (u.scale > 0 ? r.area_px / (u.scale ** 2) : 0)), 0);
                const safeArea = area > 0 ? area : 100; // Çizim/değer yoksa varsayılan 100m2
                const multiplier = FLOOR_MULTIPLIERS[u.floorType] || 1.0;
                const effectiveArea = safeArea * multiplier;

                const salableCount = Math.round(availableCount * shareRatio);
                const floorLabel = u.floorType === 'basement' ? 'Bodrum' : u.floorType === 'ground' ? 'Zemin' : u.floorType === 'roof' ? 'Çatı' : 'Normal Kat';

                for (let i = 0; i < salableCount; i++) {
                    salableUnitsData.push({
                        name: `${u.name} [${floorLabel}]`,
                        effectiveArea: effectiveArea,
                        netArea: safeArea // YENİ EKLENDİ
                    });
                    totalEffectiveArea += effectiveArea;
                }
            }
        });

        if (totalEffectiveArea === 0) totalEffectiveArea = 1;
        const basePricePerEffectiveM2 = totalTargetRevenue / totalEffectiveArea;

        // 3. Satışları fiyatlandırıp tabloya ekle
        salableUnitsData.forEach((item, index) => {
            const calculatedPrice = Math.round((item.effectiveArea * basePricePerEffectiveM2) / 1000) * 1000;

            // --- YENİ KDV MANTIĞI ---
            let calculatedVatRate = 0.20; // Varsayılan KDV %20
            // Kentsel dönüşümse ve net alan 150m2 altındaysa KDV %1'dir
            if (buildingStats.isUrbanTransformation && item.netArea < 150) {
                calculatedVatRate = 0.01;
            }

            defaultSales.push({
                id: Date.now().toString() + index + Math.random().toString().slice(2, 5),
                name: item.name,
                amount: calculatedPrice,
                month: 0,
                saleDate: targetDate,
                vatRate: calculatedVatRate // KDV oranını eklendi
            });
        });

        // Eğer hala boşsa (örn: oran çok düşükse)
        if (defaultSales.length === 0) {
            defaultSales.push({
                id: Date.now().toString(),
                name: `Toplu Satış`,
                amount: Math.round(totalTargetRevenue / 1000) * 1000,
                month: 0,
                saleDate: targetDate
            });
        }

        updateFinancialSettings({ sales: defaultSales });
    };

    const netProfit = totals.finalBalance - currentEquityAmount;
    const recommendedPricePerM2 = totalConstructionArea > 0 ? (totals.actualTotalCostWithInflation * (1 + targetProfitMargin / 100)) / totalConstructionArea : 0;

    const currentTotalBrut = totals.actualTotalCostWithInflation;
    
    // 1. Enflasyonsuz (Bugünkü) değerler üzerinden net ve KDV tutarlarını bulalım
    let baseNetTotal = 0;
    let baseVatAmount = 0;

    projectCostDetails.forEach(cat => {
        cat.items.forEach(item => {
            // Eğer vatRate tanımlanmamışsa standart %20 (0.20) kabul et
            const itemVatRate = item.vatRate !== undefined ? item.vatRate : 0.20;
            const itemBasePrice = item.totalPrice || 0;
            
            const itemNetPrice = itemBasePrice / (1 + itemVatRate);
            const itemVat = itemBasePrice - itemNetPrice;
            
            baseNetTotal += itemNetPrice;
            baseVatAmount += itemVat;
        });
    });

    // 2. Nakit Akışı tablosunda enflasyonlu toplam (currentTotalBrut) kullanıldığı için,
    // enflasyonun yarattığı artış katsayısını bulup Net ve KDV tutarlarına yansıtıyoruz.
    const inflationMultiplier = projectTotalCost > 0 ? (currentTotalBrut / projectTotalCost) : 1;

    const netTotalCost = baseNetTotal * inflationMultiplier;
    const includedVatAmount = baseVatAmount * inflationMultiplier;
    

let estimatedSalesVat = 0;
    let landownerVatBurden = 0; // YENİ: Arsa Sahibi KDV Yükü

    if (financialSettings.revenueModel === 'taahhut') {
        estimatedSalesVat = totals.totalSales * 0.20;
    } else {
        // 1. Müteahhidin kendi sattığı dairelerin KDV'si
        financialSettings.sales.forEach(sale => {
            const rate = sale.vatRate !== undefined ? sale.vatRate : 0.20;
            let saleDateObj = new Date((sale.saleDate || formatMonth(startDate)) + '-01');
            let projectStartObj = new Date(formatMonth(startDate) + '-01');
            let saleMonthsDiff = Math.max(0, (saleDateObj.getFullYear() - projectStartObj.getFullYear()) * 12 + (saleDateObj.getMonth() - projectStartObj.getMonth()));
            let inflatedSaleAmount = sale.amount * Math.pow(1 + (financialSettings.monthlyInflationRate || 0) / 100, saleMonthsDiff);

            estimatedSalesVat += inflatedSaleAmount - (inflatedSaleAmount / (1 + rate));
        });

        // 2. YENİ: Arsa Sahibine Verilen Dairelerin KDV Yükü (Kat Karşılığı ise)
        if (buildingStats.constructionModel === 'kat_karsiligi') {
            const contractorShare = buildingStats.contractorShare || 50;
            const landownerShare = 100 - contractorShare;
            
            if (landownerShare > 0) {
                // Arsa sahibine düşen dairelerin maliyet bedeli
                // Toplam maliyetin, arsa sahibinin yüzdesine denk gelen kısmı
                const landownerCost = totals.actualTotalCostWithInflation * (landownerShare / 100);
                
                // Maliyet bedeli üzerinden KDV hesaplanır (Kentsel dönüşümse %1, değilse alan büyüklüğüne göre genelde %20 veya %10)
                // Basitleştirilmiş güvenli yaklaşım: Kentsel dönüşümde %1, standartta %20 vergi yükü
                const vatRateForLandowner = buildingStats.isUrbanTransformation ? 0.01 : 0.20;
                
                landownerVatBurden = landownerCost * vatRateForLandowner;
            }
        }
    }

    // Toplam Vergi İadesi = Alınan Malzemelerdeki KDV - (Satış KDV'si + Arsa Sahibi KDV Yükü)
    const potentialVatRefund = includedVatAmount - (estimatedSalesVat + landownerVatBurden);

    const drawChart = () => {
        if (tableData.length === 0) return null;
        const maxVal = Math.max(...tableData.map(d => Math.max(d.cumulativeExpense, d.cumulativeSales)), totals.actualTotalCostWithInflation) * 1.1;

        const width = 800;
        const height = 340;
        const paddingX = 60;
        const paddingTop = 40;
        const paddingBottom = 80;

        const step = (width - paddingX * 2) / Math.max(1, tableData.length - 1);
        const getX = (index: number) => paddingX + (index * step);
        const getY = (value: number) => height - paddingBottom - ((value / maxVal) * (height - paddingTop - paddingBottom));

        let breakEvenPoint = null;
        for (let i = 0; i < tableData.length; i++) {
            if (tableData[i].cumulativeSales >= tableData[i].cumulativeExpense && tableData[i].cumulativeExpense > 0) {
                breakEvenPoint = { x: getX(i), y: getY(tableData[i].cumulativeSales), month: tableData[i].displayMonth };
                break;
            }
        }

        const expensePoints = tableData.map((d, i) => `${getX(i)},${getY(d.cumulativeExpense)}`).join(' ');
        const salesPoints = tableData.map((d, i) => `${getX(i)},${getY(d.cumulativeSales)}`).join(' ');

        const labelStep = Math.max(1, Math.ceil(tableData.length / 8));

        return (
            <div className="w-full overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-b-lg p-4 shadow-sm relative" onMouseLeave={() => setHoveredChartIndex(null)}>
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sticky left-0">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2 sm:mb-0">Nakit Akışı Eğrisi (S-Curve)</h4>
                    <div className="flex flex-wrap justify-center gap-3 md:gap-4 text-[10px] font-bold">
                        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400"><span className="w-3 h-3 bg-red-500 rounded-full shadow-sm"></span> Kümülatif Gider</div>
                        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400"><span className="w-3 h-3 bg-green-500 rounded-full shadow-sm"></span> Kümülatif Gelir</div>
                        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400"><span className="w-3 h-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-sm"></span> Nakit Açığı (Risk)</div>
                    </div>
                </div>

                <div className="min-w-[700px] relative">
                    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
                        {tableData.map((d, i) => {
                            if (d.endBalance < 0) {
                                const rectX = i === 0 ? getX(i) : getX(i) - step / 2;
                                const rectWidth = i === 0 || i === tableData.length - 1 ? step / 2 : step;
                                return (
                                    <rect key={`shortfall-${i}`} x={rectX} y={paddingTop} width={rectWidth} height={height - paddingTop - paddingBottom} fill="rgba(239, 68, 68, 0.1)" />
                                );
                            }
                            return null;
                        })}

                        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                            const y = paddingTop + (height - paddingTop - paddingBottom) * ratio;
                            return (
                                <g key={ratio}>
                                    <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="gray" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
                                    <text x={paddingX - 10} y={y + 3} fontSize="10" fill="gray" textAnchor="end">{((maxVal * (1 - ratio)) / 1000000).toFixed(1)}M</text>
                                </g>
                            )
                        })}

                        {tableData.map((d, i) => {
                            if (i % labelStep === 0 || i === tableData.length - 1) {
                                return (
                                    <g key={`x-label-${i}`} transform={`translate(${getX(i)}, ${height - paddingBottom + 20})`}>
                                        <line x1="0" y1="-20" x2="0" y2="-10" stroke="gray" strokeWidth="1" opacity="0.5" />
                                        <text x="0" y="0" fontSize="10" fill="gray" textAnchor="end" transform="rotate(-45)">
                                            {d.displayMonth}
                                        </text>
                                    </g>
                                );
                            }
                            return null;
                        })}

                        <polyline fill="none" stroke="#ef4444" strokeWidth="3" points={expensePoints} className="drop-shadow-sm" />
                        <polyline fill="none" stroke="#10b981" strokeWidth="3" points={salesPoints} className="drop-shadow-sm" />

                        {breakEvenPoint && (
                            <g>
                                <circle cx={breakEvenPoint.x} cy={breakEvenPoint.y} r="6" fill="#f59e0b" className="animate-pulse" />
                                <text x={breakEvenPoint.x - 10} y={breakEvenPoint.y - 15} fontSize="11" fill="#f59e0b" fontWeight="bold" textAnchor="end">Başa Baş Noktası</text>
                                <text x={breakEvenPoint.x - 10} y={breakEvenPoint.y - 3} fontSize="9" fill="gray" textAnchor="end">{breakEvenPoint.month}</text>
                            </g>
                        )}

                        {hoveredChartIndex !== null && (
                            <g>
                                <line x1={getX(hoveredChartIndex)} y1={paddingTop} x2={getX(hoveredChartIndex)} y2={height - paddingBottom} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
                                <circle cx={getX(hoveredChartIndex)} cy={getY(tableData[hoveredChartIndex].cumulativeExpense)} r="5" fill="#ef4444" stroke="white" strokeWidth="2" />
                                <circle cx={getX(hoveredChartIndex)} cy={getY(tableData[hoveredChartIndex].cumulativeSales)} r="5" fill="#10b981" stroke="white" strokeWidth="2" />
                            </g>
                        )}

                        {tableData.map((d, i) => {
                            const rectX = i === 0 ? getX(i) : getX(i) - step / 2;
                            const rectWidth = i === 0 || i === tableData.length - 1 ? step / 2 : step;
                            return (
                                <rect
                                    key={`hitbox-${i}`}
                                    x={rectX}
                                    y={paddingTop}
                                    width={rectWidth}
                                    height={height - paddingTop - paddingBottom}
                                    fill="transparent"
                                    onMouseEnter={() => setHoveredChartIndex(i)}
                                    className="cursor-crosshair"
                                />
                            );
                        })}
                    </svg>

                    {hoveredChartIndex !== null && (
                        <div
                            className="absolute pointer-events-none bg-slate-900/95 backdrop-blur-sm text-white p-3 rounded-xl shadow-2xl border border-slate-700 text-xs z-[100] transition-all duration-75"
                            style={{
                                left: `${getX(hoveredChartIndex)}px`,
                                transform: (hoveredChartIndex / tableData.length) > 0.6 ? 'translateX(calc(-100% - 15px))' : 'translateX(15px)',
                                top: '30px',
                                minWidth: '180px',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <div className="font-bold border-b border-slate-700 pb-1 mb-2 text-slate-300">
                                {tableData[hoveredChartIndex].displayMonth}
                            </div>
                            <div className="flex justify-between items-center gap-4 mb-1">
                                <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-red-500 shadow-sm"></span> K. Gider</span>
                                <span className="font-mono font-bold text-red-400 tracking-tight">
                                    {tableData[hoveredChartIndex].cumulativeExpense.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                </span>
                            </div>
                            <div className="flex justify-between items-center gap-4 mb-1">
                                <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-green-500 shadow-sm"></span> K. Gelir</span>
                                <span className="font-mono font-bold text-green-400 tracking-tight">
                                    {tableData[hoveredChartIndex].cumulativeSales.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                </span>
                            </div>
                            <div className="flex justify-between items-center gap-4 mt-2 pt-1 border-t border-slate-700">
                                <span className="text-slate-400">Dönem Kasası</span>
                                <span className={`font-mono font-bold tracking-tight ${tableData[hoveredChartIndex].endBalance < 0 ? 'text-red-500' : 'text-emerald-400'}`}>
                                    {tableData[hoveredChartIndex].endBalance.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg transition-colors duration-300 overflow-hidden mt-6">
            <button onClick={() => setIsExpanded(!isExpanded)} className="w-full p-4 md:p-6 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition">
                <div className="flex items-center gap-3">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-300 dark:border-slate-600 shadow-sm">
                        <i className="fas fa-chart-line text-emerald-600 dark:text-emerald-400 text-xl"></i>
                    </div>
                    <div className="text-left">
                        <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">Finansal & Nakit Akışı Analizi</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Öz sermaye, kredi, enflasyon hesaplaması ve fiyat sabitleme (Hedge)</p>
                    </div>
                </div>
                <div className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    <i className="fas fa-chevron-down text-slate-400"></i>
                </div>
            </button>

            {isExpanded && (
                <div className="p-4 md:p-6 border-t border-slate-200 dark:border-slate-700 animate-fadeIn bg-white dark:bg-slate-900 flex flex-col gap-6">

                    {/* --- ÖZET KARTLARI (ÜST BÖLÜM) --- */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-center relative group">
                            <div className="text-[10px] text-slate-500 uppercase font-bold">Enflasyonlu Maliyet</div>
                            <div className="text-lg font-bold text-slate-800 dark:text-white">{totals.actualTotalCostWithInflation.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div>
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition text-[9px] bg-slate-200 dark:bg-slate-700 p-1 rounded">Bugünkü: {projectTotalCost.toLocaleString()}₺</div>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50 flex flex-col justify-center">
                            <div className="text-[10px] text-emerald-600 uppercase font-bold">Toplam Gelir (Satış+Faiz)</div>
                            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{(totals.totalSales + totals.totalInterestEarned).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800/50 flex flex-col justify-center">
                            <div className="text-[10px] text-blue-600 uppercase font-bold">Öz Sermaye</div>
                            <div className="text-lg font-bold text-blue-700 dark:text-blue-400">{currentEquityAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800/50 flex flex-col justify-center">
                            <div className="text-[10px] text-orange-600 uppercase font-bold">Açık / Ek İhtiyaç</div>
                            <div className="text-lg font-bold text-orange-700 dark:text-orange-400">{totals.peakEquityNeeded.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div>
                        </div>
                        <div className={`p-3 rounded-lg border flex flex-col justify-center ${netProfit >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'}`}>
                            <div className={`text-[10px] uppercase font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Kâr</div>
                            <div className={`text-lg font-bold ${netProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                {netProfit > 0 ? '+' : ''}{netProfit.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                            </div>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800/50 flex flex-col justify-center shadow-inner relative overflow-hidden group">
                            <div className="absolute top-0 right-0 bg-yellow-400 text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg">HEDEF: %{targetProfitMargin}</div>
                            <div className="text-[10px] text-yellow-700 dark:text-yellow-500 uppercase font-bold">Hedef Satış (Min)</div>
                            <div className="text-lg font-extrabold text-yellow-600 dark:text-yellow-400 font-mono mt-1">
                                {recommendedPricePerM2.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} <span className="text-xs">₺/m²</span>
                            </div>
                        </div>
                    </div>

                    {/* --- VERGİ VE KDV BİLGİLERİ (İkincil Bilgiler) --- */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-sm">
                            <div>
                                <div className="text-[10px] text-slate-500 uppercase font-bold">Net İnşaat Maliyeti</div>
                                <div className="text-[9px] text-slate-400">Vergiler hariç saf (gerçek) maliyet</div>
                            </div>
                            <div className="text-lg font-bold text-slate-700 dark:text-slate-300 font-mono">
                                {netTotalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                            </div>
                        </div>

                        <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200 dark:border-red-900/30 flex justify-between items-center shadow-sm">
                            <div>
                                <div className="text-[10px] text-red-600 uppercase font-bold">İçindeki KDV Yükü (%20)</div>
                                <div className="text-[9px] text-red-500/80">İnşaat süresince devlete ödenen vergi</div>
                            </div>
                            <div className="text-lg font-bold text-red-600 dark:text-red-400 font-mono">
                                {includedVatAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                            </div>
                        </div>

                        {buildingStats.isUrbanTransformation ? (
                            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/30 flex justify-between items-center relative overflow-hidden shadow-sm">
                                <div className="absolute -right-2 -top-2 text-emerald-500/10 text-6xl"><i className="fas fa-hand-holding-usd"></i></div>
                                <div className="relative z-10">
                                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold">Potansiyel KDV İadesi</div>
                                    <div className="text-[9px] text-emerald-600/80">%1 Satış KDV'si mahsup edilmiştir</div>
                                </div>
                                <div className="relative z-10 text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                    {Math.max(0, potentialVatRefund).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 dark:bg-slate-800/30 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50 flex justify-between items-center opacity-70 border-dashed">
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">KDV İadesi Fırsatı</div>
                                    <div className="text-[9px] text-slate-400">Sadece Kentsel Dönüşüm projelerinde</div>
                                </div>
                                <div className="text-xs font-bold text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
                                    Aktif Değil
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6">

                        {/* ========================================= */}
                        {/* SOL PANEL: SEKMELİ (TAB) YAPI               */}
                        {/* ========================================= */}
                        <div className="w-full lg:w-1/3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">

                            {/* Sekme Başlıkları */}
                            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                                <button
                                    onClick={() => setLeftTab('sermaye')}
                                    className={`flex-1 py-3 text-[11px] uppercase font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${leftTab === 'sermaye' ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-transparent'}`}
                                >
                                    <i className="fas fa-coins"></i> Finansman
                                </button>
                                <button
                                    onClick={() => setLeftTab('gelir')}
                                    className={`flex-1 py-3 text-[11px] uppercase font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${leftTab === 'gelir' ? 'text-emerald-600 dark:text-emerald-400 border-emerald-600 dark:border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-transparent'}`}
                                >
                                    <i className="fas fa-hand-holding-usd"></i> Gelir
                                </button>
                                <button
                                    onClick={() => setLeftTab('risk')}
                                    className={`flex-1 py-3 text-[11px] uppercase font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${leftTab === 'risk' ? 'text-orange-600 dark:text-orange-400 border-orange-600 dark:border-orange-400 bg-orange-50/50 dark:bg-orange-900/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-transparent'}`}
                                >
                                    <i className="fas fa-shield-alt"></i> Risk / Hedge
                                </button>
                            </div>

                            {/* Sekme İçerikleri */}
                            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">

                                {/* SEKME 1: FİNANSMAN */}
                                {leftTab === 'sermaye' && (
                                    <div className="space-y-6 animate-fadeIn">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Mevcut Öz Sermaye (₺)</label>
                                                <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 focus-within:border-blue-500 transition-colors">
                                                    <NumericInput
                                                        value={Number((equityAmount !== null ? equityAmount : projectTotalCost).toFixed(2))}
                                                        onChange={setEquityAmount}
                                                        className="w-full min-w-0 bg-transparent text-sm outline-none font-bold text-slate-700 dark:text-slate-300 truncate"
                                                    />
                                                    <span className="text-slate-400 font-bold ml-1">₺</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <div className="flex justify-between items-end mb-1">
                                                        <label className="text-[10px] uppercase font-bold text-slate-500">Aylık Enf. (%)</label>
                                                        {financialSettings.systemMonthlyInflationRate !== undefined && financialSettings.monthlyInflationRate !== financialSettings.systemMonthlyInflationRate && (
                                                            <button onClick={() => updateFinancialSettings({ monthlyInflationRate: financialSettings.systemMonthlyInflationRate })} className="text-[9px] text-red-500 hover:text-red-700 font-bold transition flex items-center gap-1"><i className="fas fa-undo"></i></button>
                                                        )}
                                                    </div>
                                                    <div className={`flex items-center bg-white dark:bg-slate-900 border rounded px-2 py-1 border-l-2 border-l-red-500 transition-colors ${financialSettings.monthlyInflationRate !== financialSettings.systemMonthlyInflationRate ? 'border-red-300 dark:border-red-800' : 'border-slate-300 dark:border-slate-600'}`}>
                                                        <NumericInput value={financialSettings.monthlyInflationRate} onChange={(val) => updateFinancialSettings({ monthlyInflationRate: val })} className={`w-full bg-transparent text-sm outline-none font-bold ${financialSettings.monthlyInflationRate !== financialSettings.systemMonthlyInflationRate ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`} />
                                                        <span className="text-slate-400 font-bold ml-1">%</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between items-end mb-1">
                                                        <label className="text-[10px] uppercase font-bold text-slate-500">Aylık Faiz (%)</label>
                                                        {financialSettings.systemMonthlyInterestRate !== undefined && financialSettings.monthlyInterestRate !== financialSettings.systemMonthlyInterestRate && (
                                                            <button onClick={() => updateFinancialSettings({ monthlyInterestRate: financialSettings.systemMonthlyInterestRate })} className="text-[9px] text-green-600 hover:text-green-800 font-bold transition flex items-center gap-1"><i className="fas fa-undo"></i></button>
                                                        )}
                                                    </div>
                                                    <div className={`flex items-center bg-white dark:bg-slate-900 border rounded px-2 py-1 border-l-2 border-l-green-500 transition-colors ${financialSettings.monthlyInterestRate !== financialSettings.systemMonthlyInterestRate ? 'border-green-300 dark:border-green-800' : 'border-slate-300 dark:border-slate-600'}`}>
                                                        <NumericInput value={financialSettings.monthlyInterestRate} onChange={(val) => updateFinancialSettings({ monthlyInterestRate: val })} className={`w-full bg-transparent text-sm outline-none font-bold ${financialSettings.monthlyInterestRate !== financialSettings.systemMonthlyInterestRate ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'}`} />
                                                        <span className="text-slate-400 font-bold ml-1">%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={`p-4 rounded-lg border transition-colors ${useLoan ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input type="checkbox" checked={useLoan} onChange={(e) => setUseLoan(e.target.checked)} className="w-5 h-5 accent-blue-500 rounded cursor-pointer" />
                                                <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                                                    <i className="fas fa-university mr-2 text-blue-500"></i>Banka Kredisi / Kaldıraç
                                                </h3>
                                            </label>

                                            {useLoan && (
                                                <div className="grid grid-cols-2 gap-3 animate-fadeIn pt-3 mt-3 border-t border-blue-100 dark:border-blue-800/50">
                                                    <div className="col-span-2">
                                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Kredi Tutarı (₺)</label>
                                                        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 focus-within:border-blue-500">
                                                            <NumericInput value={loanAmount || 0} onChange={setLoanAmount} className="w-full bg-transparent text-sm outline-none font-bold text-blue-600 dark:text-blue-400 text-right pr-2" />
                                                            <span className="text-slate-400 font-bold text-xs">₺</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Aylık Faiz (%)</label>
                                                        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 focus-within:border-blue-500">
                                                            <NumericInput value={loanInterestRate} onChange={setLoanInterestRate} className="w-full bg-transparent text-sm outline-none font-bold text-slate-700 dark:text-slate-300 text-right pr-2" />
                                                            <span className="text-slate-400 font-bold text-xs">%</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Vade (Ay)</label>
                                                        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 focus-within:border-blue-500">
                                                            <NumericInput value={loanDuration} onChange={setLoanDuration} className="w-full bg-transparent text-sm outline-none font-bold text-slate-700 dark:text-slate-300 text-right pr-2" />
                                                            <span className="text-slate-400 font-bold text-xs">Ay</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Kullanım Ayı</label>
                                                        <input type="month" value={currentLoanDate} onChange={(e) => setLoanDate(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-xs outline-none font-bold text-slate-700 dark:text-slate-300" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Taksit Başlangıcı</label>
                                                        <input type="month" value={currentLoanRepayDate} onChange={(e) => setLoanRepayStartDate(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-xs outline-none font-bold text-slate-700 dark:text-slate-300" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* SEKME 2: GELİR PLANI */}
                                {leftTab === 'gelir' && (
                                    <div className="animate-fadeIn">
                                        <div className="flex bg-slate-200 dark:bg-slate-900 rounded-lg p-1 mb-4 border border-slate-300 dark:border-slate-700">
                                            <button onClick={() => updateFinancialSettings({ revenueModel: 'yap_sat' })} className={`flex-1 py-1.5 text-[11px] font-bold rounded transition ${revenueModel === 'yap_sat' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                                                Yap-Sat (Satış)
                                            </button>
                                            <button onClick={() => updateFinancialSettings({ revenueModel: 'taahhut' })} className={`flex-1 py-1.5 text-[11px] font-bold rounded transition ${revenueModel === 'taahhut' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                                                Taahhüt (Hakediş)
                                            </button>
                                        </div>

                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center bg-yellow-100 text-yellow-800 px-2 rounded text-[10px] font-bold border border-yellow-300" title="Hedef Kar Marjı">
                                                    Kâr % <input type="number" value={targetProfitMargin} onChange={e => setTargetProfitMargin(parseFloat(e.target.value) || 0)} className="w-8 bg-transparent outline-none ml-1 text-center" />
                                                </div>
                                            </div>
                                            <button onClick={revenueModel === 'yap_sat' ? handleAutoPopulate : autoPopulateHakedis} className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded shadow flex items-center gap-1">
                                                <i className="fas fa-magic"></i> Doldur
                                            </button>
                                        </div>

                                        {revenueModel === 'yap_sat' && (
                                            <>
                                                {financialSettings.sales.length === 0 ? (
                                                    <div className="text-center py-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                                                        <i className="fas fa-shopping-cart text-3xl text-slate-300 dark:text-slate-600 mb-2"></i>
                                                        <p className="text-xs text-slate-500 mb-3">Henüz bir satış planı oluşturmadınız.</p>
                                                        <button onClick={handleAutoPopulate} className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-emerald-500 transition">
                                                            Otomatik Satış Planı Oluştur
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="space-y-2 mb-4 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700">
                                                            <input type="text" placeholder="Satış Adı" value={newSale.name} onChange={e => setNewSale({ ...newSale, name: e.target.value })} className="w-full bg-transparent border-b border-slate-200 dark:border-slate-700 p-1 text-xs outline-none focus:border-emerald-500" />
                                                            <div className="flex gap-2">
                                                                <input type="month" value={newSale.saleDate} onChange={e => setNewSale({ ...newSale, saleDate: e.target.value })} className="w-1/3 bg-transparent border-b border-slate-200 dark:border-slate-700 p-1 text-xs outline-none focus:border-emerald-500" />
                                                                <NumericInput value={newSale.amount} onChange={val => setNewSale({ ...newSale, amount: val })} className="w-1/3 bg-transparent border-b border-slate-200 dark:border-slate-700 p-1 text-xs outline-none text-right focus:border-emerald-500" placeholder="Tutar ₺" />
                                                                <select value={newSale.vatRate} onChange={e => setNewSale({ ...newSale, vatRate: parseFloat(e.target.value) })} className="w-1/3 bg-transparent border-b border-slate-200 dark:border-slate-700 p-1 text-xs text-slate-500 outline-none focus:border-emerald-500">
                                                                    <option value={0.01}>%1 KDV</option>
                                                                    <option value={0.10}>%10 KDV</option>
                                                                    <option value={0.20}>%20 KDV</option>
                                                                </select>
                                                            </div>
                                                            <button onClick={handleAddSale} className="w-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-bold py-1.5 rounded mt-1 transition">Manuel Ekle</button>
                                                        </div>

                                                        <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                                                            {financialSettings.sales.sort((a, b) => (a.saleDate || '').localeCompare(b.saleDate || '')).map(s => (
                                                                <div key={s.id} className="flex justify-between items-center bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-700 text-[10px]">
                                                                    <span className="truncate max-w-[90px] font-bold dark:text-white" title={s.name}>{s.name}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-slate-400 ${stressDelayMonths !== 0 ? 'line-through text-[8px] opacity-70' : ''}`}>
                                                                            {formatMonthDisplay(s.saleDate || '')}
                                                                        </span>
                                                                        {stressDelayMonths !== 0 && (
                                                                            <span className="text-orange-500 font-bold">
                                                                                {formatMonthDisplay(formatMonth(addMonths(new Date((s.saleDate || '') + '-01'), stressDelayMonths)))}
                                                                            </span>
                                                                        )}

                                                                        {/* --- DEĞİŞEN KISIM BURASI --- */}
                                                                        <div className="flex flex-col text-right">
                                                                            <span className="text-emerald-600 font-mono font-bold">{s.amount.toLocaleString()} ₺</span>
                                                                            <span className="text-[9px] text-slate-400 font-bold">%{(s.vatRate !== undefined ? s.vatRate : 0.20) * 100} KDV</span>
                                                                        </div>
                                                                        <button onClick={() => removeSale(s.id)} className="text-red-400 hover:text-red-600 ml-1"><i className="fas fa-times"></i></button>
                                                                        {/* --------------------------- */}

                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </>
                                        )}

                                        {revenueModel === 'taahhut' && (
                                            <>
                                                {progressPayments.length === 0 ? (
                                                    <div className="text-center py-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                                                        <i className="fas fa-file-signature text-3xl text-slate-300 dark:text-slate-600 mb-2"></i>
                                                        <p className="text-xs text-slate-500 mb-3">Henüz bir hakediş planı oluşturmadınız.</p>
                                                        <button onClick={autoPopulateHakedis} className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-emerald-500 transition">
                                                            Otomatik Hakediş Planı Oluştur
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded mb-3 border border-emerald-100 dark:border-emerald-800">
                                                            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold uppercase">Sözleşme Bedeli:</span>
                                                            <span className="text-sm font-bold font-mono text-emerald-800 dark:text-emerald-400">
                                                                {(projectTotalCost * (1 + targetProfitMargin / 100)).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                                            </span>
                                                        </div>
                                                        <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                                                            {projectSchedule.map(task => {
                                                                const pp = progressPayments.find(p => p.taskId === task.id);
                                                                const val = pp ? pp.percentage : 0;
                                                                const contractVal = projectTotalCost * (1 + targetProfitMargin / 100);

                                                                return (
                                                                    <div key={task.id} className={`flex flex-col gap-1 text-xs bg-white dark:bg-slate-900 p-2 rounded border transition ${val > 0 ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30' : 'border-slate-200 dark:border-slate-700'}`}>
                                                                        <div className="flex justify-between items-center">
                                                                            <div className="flex flex-col">
                                                                                <span className="font-bold dark:text-white truncate w-32 md:w-40">{task.name}</span>
                                                                                <span className="text-[9px] text-slate-400">Bitiş: {formatMonthDisplay(formatMonth(task.endDate))}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-800 focus-within:border-emerald-500">
                                                                                    <NumericInput value={val} onChange={(newVal) => handleUpdateProgressPayment(task.id, newVal)} className="w-10 text-right bg-transparent outline-none p-1 font-mono text-emerald-700 dark:text-emerald-400 font-bold" />
                                                                                    <span className="px-1 text-slate-400">%</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        {val > 0 && (
                                                                            <div className="text-right text-[10px] font-mono text-emerald-600 font-bold border-t border-emerald-100 dark:border-emerald-800 pt-1 mt-1">
                                                                                + {((contractVal * val) / 100).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                        <div className="mt-3 flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-2">
                                                            <span className="text-[10px] uppercase font-bold text-slate-500">Toplam Dağıtılan:</span>
                                                            <span className={`font-bold ${progressPayments.reduce((a, b) => a + b.percentage, 0) !== 100 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                %{progressPayments.reduce((a, b) => a + b.percentage, 0)}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* SEKME 3: RİSK / HEDGE */}
                                {leftTab === 'risk' && (
                                    <div className="space-y-6 animate-fadeIn">

                                        {/* Stres Testi */}
                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-orange-200 dark:border-orange-800/50 shadow-sm relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rounded-bl-full -mr-4 -mt-4 pointer-events-none"></div>

                                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-1.5">
                                                <i className="fas fa-exclamation-triangle text-orange-500"></i>
                                                Beklenmeyen Maliyet Artışı
                                            </h4>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3 pr-4 leading-relaxed">
                                                Malzeme fiyatlarına gelebilecek öngörülemeyen şok dalgaları için nakit akışınızı test edin.
                                            </p>

                                            <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-lg p-2">
                                                <span className="text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider pl-1">
                                                    Şok Oranı
                                                </span>
                                                <div className="flex items-center bg-white dark:bg-slate-950 border border-orange-300 dark:border-orange-700 rounded-md px-2 py-1 focus-within:ring-2 focus-within:ring-orange-500/30 w-24 shadow-sm transition-all">
                                                    <span className="text-orange-400 font-bold mr-1">%</span>
                                                    <NumericInput
                                                        value={stressCostIncrease}
                                                        onChange={setStressCostIncrease}
                                                        className="w-full bg-transparent text-sm outline-none font-bold text-orange-600 dark:text-orange-400 text-center"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Öteleme */}
                                        {(financialSettings.sales.length > 0 || (financialSettings.progressPayments && financialSettings.progressPayments.length > 0)) && (
                                            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                                                    <i className="far fa-calendar-times mr-1 text-slate-500"></i> Toplu Ötele / Geç Teslim
                                                </label>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3 leading-tight">
                                                    İnşaat süresi uzadığında veya satışlar geciktiğinde nakit akışının nasıl etkileneceğini görün.
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setStressDelayMonths(prev => prev - 1)} className="w-10 h-10 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition shadow-sm">-1</button>
                                                    <div className="flex-1 text-center bg-slate-50 dark:bg-slate-800/50 rounded py-2 border border-slate-200 dark:border-slate-700">
                                                        <span className={`font-bold text-sm ${stressDelayMonths > 0 ? 'text-orange-600 dark:text-orange-400' : stressDelayMonths < 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                            {stressDelayMonths > 0 ? `+${stressDelayMonths} Ay Ötelendi` : stressDelayMonths < 0 ? `${Math.abs(stressDelayMonths)} Ay Erken` : `Değişiklik Yok`}
                                                        </span>
                                                    </div>
                                                    <button onClick={() => setStressDelayMonths(prev => prev + 1)} className="w-10 h-10 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition shadow-sm">+1</button>
                                                    {stressDelayMonths !== 0 && (
                                                        <button onClick={() => setStressDelayMonths(0)} className="w-10 h-10 flex items-center justify-center bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded font-bold transition shadow-sm" title="Orijinal tarihlere dön">
                                                            <i className="fas fa-undo"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Fiyat Sabitleme */}
                                        <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800/30 shadow-sm flex flex-col h-64">
                                            <div className="flex justify-between items-center mb-2 border-b border-indigo-200 dark:border-indigo-800/50 pb-2 shrink-0">
                                                <h3 className="font-bold text-indigo-700 dark:text-indigo-400 text-sm">
                                                    <i className="fas fa-lock mr-2"></i>Fiyatı Sabit İşler (Hedge)
                                                </h3>
                                                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded font-bold">
                                                    {(financialSettings.fixedPriceTaskIds || []).length} İş Sabit
                                                </span>
                                            </div>
                                            <p className="text-[9px] text-indigo-600/80 dark:text-indigo-300/80 mb-2 leading-tight shrink-0">
                                                Taşeron veya tedarikçiyle önceden anlaşılan kalemleri seçin. Seçili kalemler aylık enflasyondan etkilenmez.
                                            </p>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 bg-white dark:bg-slate-900 p-2 rounded border border-indigo-100 dark:border-slate-700">
                                                {projectSchedule.map(task => {
                                                    const isFixed = (financialSettings.fixedPriceTaskIds || []).includes(task.id);
                                                    return (
                                                        <label key={task.id} className={`flex items-center justify-between p-2 rounded cursor-pointer transition text-xs ${isFixed ? 'bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-300 dark:border-indigo-700' : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'}`}>
                                                            <div className="flex items-center gap-2 truncate">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isFixed}
                                                                    onChange={() => toggleFixedTask(task.id)}
                                                                    className="accent-indigo-600"
                                                                />
                                                                <span className={`truncate ${isFixed ? 'font-bold text-indigo-900 dark:text-indigo-100' : 'text-slate-600 dark:text-slate-300'}`}>{task.name}</span>
                                                            </div>
                                                            {isFixed && <i className="fas fa-shield-alt text-indigo-500 text-[10px]"></i>}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ========================================= */}
                        {/* SAĞ PANEL: GRAFİK VE TABLO GÖRÜNÜMÜ         */}
                        {/* ========================================= */}
                        <div className="w-full lg:w-2/3 flex flex-col">

                            {/* Toggle Header */}
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                                    {rightView === 'chart' ? 'Nakit Akışı Görselleştirme' : 'Dönemsel Nakit Akışı Tablosu'}
                                </h3>
                                <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-1 border border-slate-300 dark:border-slate-700">
                                    <button
                                        onClick={() => setRightView('chart')}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${rightView === 'chart' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                    >
                                        <i className="fas fa-chart-line mr-1"></i> Grafik
                                    </button>
                                    <button
                                        onClick={() => setRightView('table')}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${rightView === 'table' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                    >
                                        <i className="fas fa-table mr-1"></i> Tablo
                                    </button>
                                </div>
                            </div>

                            {/* İçerik */}
                            {rightView === 'chart' ? (
                                <div className="flex-1 min-h-[350px]">
                                    {drawChart()}
                                </div>
                            ) : (
                                <div className="flex-1 overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg max-h-[400px] custom-scrollbar relative shadow-sm bg-white dark:bg-slate-900 animate-fadeIn">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 uppercase sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="p-3 font-bold whitespace-nowrap border-b border-slate-200 dark:border-slate-700">Dönem</th>
                                                <th className="p-3 font-bold text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">Açıklama</th>
                                                <th className="p-3 font-bold text-right text-emerald-600 border-b border-slate-200 dark:border-slate-700" title="Öz Sermaye + Satış Geliri + Faiz + Kredi Kullanımı">Gelir (+)</th>
                                                <th className="p-3 font-bold text-right text-red-600 border-b border-slate-200 dark:border-slate-700" title="Maliyet + Kredi Taksiti">Gider (-)</th>
                                                <th className="p-3 font-bold text-right text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700">Kasa (Bakiye)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 font-mono bg-white dark:bg-slate-950">
                                            {tableData.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-help">
                                                    <td className="p-3 font-sans font-medium text-slate-800 dark:text-slate-300 whitespace-nowrap">{row.displayMonth}</td>
                                                    <td className="p-3 font-sans text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title={row.tooltip}>{row.description}</td>
                                                    <td className="p-3 text-right text-emerald-600">{row.totalIncome > 0 ? `+${row.totalIncome.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` : '-'}</td>
                                                    <td className="p-3 text-right text-red-600">{row.totalExpense > 0 ? `-${row.totalExpense.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` : '-'}</td>
                                                    <td className={`p-3 text-right font-bold text-sm ${row.endBalance < 0 ? 'text-red-600 bg-red-50 dark:bg-red-900/10' : 'text-slate-900 dark:text-white'}`}>{row.endBalance.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* SABİT BARLAR (Kasa & Mevduat Alternatifi) */}
                            <div className={`flex flex-col mt-4 ${rightView === 'chart' ? 'border-t border-slate-200 dark:border-slate-700 pt-4' : ''}`}>
                                <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700 flex justify-end items-center gap-4 shadow-sm z-10 rounded-t-lg">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        DÖNEM SONU KASA (NİHAİ BAKİYE):
                                    </span>
                                    <span className={`text-xl font-extrabold font-mono ${totals.finalBalance < 0 ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        {totals.finalBalance.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                    </span>
                                </div>

                                <div className="bg-slate-100 dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 border-t-0 flex flex-col sm:flex-row justify-between items-center rounded-b-lg">
                                    <div className="flex items-center gap-3 mb-2 sm:mb-0">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                                            <i className="fas fa-piggy-bank"></i>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-white text-sm">Alternatif Senaryo (Mevduat)</h4>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                Eğer inşaata başlanmasaydı, {currentEquityAmount.toLocaleString()} ₺ öz sermaye aylık %{financialSettings.monthlyInterestRate} faizle toplam <b>{totals.monthsCount} ay</b> sonunda ne kadar olurdu?
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right whitespace-nowrap pl-4">
                                        <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                                            {totals.alternativeBalance?.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                        </div>
                                        <div className="text-xs text-blue-600 dark:text-blue-400 font-bold">
                                            +{totals.alternativeProfit?.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ Net Getiri
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};