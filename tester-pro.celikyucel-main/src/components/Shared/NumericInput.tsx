import React, { useState, useEffect } from 'react';

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: number | undefined;
    onChange: (value: number) => void;
    className?: string;
}

export const NumericInput: React.FC<NumericInputProps> = ({ value, onChange, className, ...props }) => {
    // Input içindeki değeri string olarak tutuyoruz, böylece "0." veya "" gibi değerlere izin veriyoruz
    const [displayValue, setDisplayValue] = useState(value?.toString() ?? '');

    // Dışarıdan (Store'dan) veri değişirse inputu güncelle (Ancak kullanıcı yazarken değil)
    useEffect(() => {
        const parsedDisplay = parseFloat(displayValue);
        // Eğer dışarıdan gelen değer, ekrandaki değerden farklıysa güncelle
        // (Örn: Otomatik hesaplama sonucu değiştiyse)
        if (value !== undefined && value !== parsedDisplay) {
            // Özel durum: Kullanıcı "5." yazarken dışarıdan "5" gelirse noktayı silme
            if (displayValue.endsWith('.') || displayValue === '' || displayValue === '-') return;
            setDisplayValue(value === 0 ? '' : value.toString()); // 0 ise boş göster (tercihe bağlı)
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setDisplayValue(val);

        if (val === '') {
            onChange(0); // Kutucuk boşalırsa değeri 0 yap
        } else {
            const parsed = parseFloat(val);
            if (!isNaN(parsed)) {
                onChange(parsed);
            }
        }
    };

    const handleBlur = () => {
        // Odaklanma bitince formatı düzelt (Örn: "005" -> "5")
        if (displayValue !== '' && !isNaN(parseFloat(displayValue))) {
            setDisplayValue(parseFloat(displayValue).toString());
        } else if (displayValue === '') {
            setDisplayValue(''); // Veya '0'
        }
    };

    return (
        <input
            type="number"
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            className={className}
            {...props}
        />
    );
};