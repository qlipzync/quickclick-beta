import React, { useState, useEffect, useMemo, useRef } from 'react';

export interface PricingDetails {
  clips: number;
  unitPriceEur: number;
  totalPriceEur: number;
  discountPercent: number;
  isValid: boolean;
}

export interface ClipQuotaInputProps {
  mode: 'register' | 'topup';
  initialValue?: number;
  onPriceChange: (details: PricingDetails) => void;
}

const MIN_CLIPS = 1;
const MAX_CLIPS = 20000;
const BASE_PRICE = 0.50; // 0,50 € bei 1 Clip
const MIN_PRICE = 0.05;  // 0,05 € bei 20.000 Clips

export function ClipQuotaInput({ mode, initialValue = 100, onPriceChange }: ClipQuotaInputProps) {
  const [inputValue, setInputValue] = useState<string>(initialValue.toString());

  const parsedClips = useMemo(() => {
    const val = parseInt(inputValue, 10);
    return isNaN(val) ? 0 : val;
  }, [inputValue]);

  const isValid = parsedClips >= MIN_CLIPS && parsedClips <= MAX_CLIPS;

  const pricing = useMemo(() => {
    if (!isValid) {
      return { unitPriceEur: 0, totalPriceEur: 0, discountPercent: 0 };
    }
    const logFactor = 1 - Math.log(parsedClips) / Math.log(MAX_CLIPS);
    const unitPrice = Math.max(MIN_PRICE, MIN_PRICE + (BASE_PRICE - MIN_PRICE) * logFactor);
    const totalPrice = parsedClips * unitPrice;
    const discount = Math.round((1 - unitPrice / BASE_PRICE) * 100);

    return {
      unitPriceEur: Number(unitPrice.toFixed(4)),
      totalPriceEur: Number(totalPrice.toFixed(2)),
      discountPercent: discount
    };
  }, [parsedClips, isValid]);

  // Stabilize onPriceChange reference and prevent infinite update loops
  const onPriceChangeRef = useRef(onPriceChange);
  useEffect(() => {
    onPriceChangeRef.current = onPriceChange;
  });

  const lastDispatchedRef = useRef<string>('');

  useEffect(() => {
    const signature = `${parsedClips}_${pricing.unitPriceEur}_${pricing.totalPriceEur}_${pricing.discountPercent}_${isValid}`;
    if (lastDispatchedRef.current !== signature) {
      lastDispatchedRef.current = signature;
      onPriceChangeRef.current?.({
        clips: parsedClips,
        unitPriceEur: pricing.unitPriceEur,
        totalPriceEur: pricing.totalPriceEur,
        discountPercent: pricing.discountPercent,
        isValid
      });
    }
  }, [parsedClips, pricing.unitPriceEur, pricing.totalPriceEur, pricing.discountPercent, isValid]);

  const handleQuickSelect = (amount: number) => {
    setInputValue(amount.toString());
  };

  return (
    <fieldset className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 text-white max-w-4xl w-full shadow-2xl flex flex-col gap-4">
      <label htmlFor="clip-input" className="block text-sm font-medium text-slate-300">
        <span>{mode === 'register' ? 'Monatliches Clip-Abonnement wählen' : 'Zusätzliche Clips nachbuchen'}</span>
        <span className="block text-xs text-slate-400 font-normal mt-0.5">Erlaubter Bereich: 1 bis 20.000 Clips</span>
      </label>

      <div className="relative">
        <input
          id="clip-input"
          type="number"
          min={MIN_CLIPS}
          max={MAX_CLIPS}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="z. B. 500"
          className={`w-full bg-slate-800 text-2xl font-bold px-4 py-3 rounded-lg border focus:outline-none transition-colors ${
            !isValid && inputValue !== ''
              ? 'border-red-500 focus:border-red-500'
              : 'border-slate-700 focus:border-emerald-500'
          }`}
        />
        <span className="absolute right-4 top-4 text-slate-400 text-sm font-semibold uppercase">Clips</span>
      </div>

      {/* Preset-Buttons für schnellen Direktzugriff */}
      <menu className="flex gap-2 flex-wrap list-none p-0 m-0" aria-label="Preset-Schnellwahl">
        {[50, 100, 250, 1000, 5000, 20000].map((preset) => (
          <li key={preset}>
            <button
              type="button"
              onClick={() => handleQuickSelect(preset)}
              className={`text-xs py-1.5 px-3 rounded border transition cursor-pointer ${
                parsedClips === preset
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {preset.toLocaleString()}
            </button>
          </li>
        ))}
      </menu>

      {!isValid && inputValue !== '' && (
        <p className="text-xs text-red-400">Bitte eine Zahl zwischen 1 und 20.000 eingeben.</p>
      )}

      {/* Live-Preisanzeige (Nur Monatsbetrag) */}
      <output htmlFor="clip-input" className="block bg-slate-950 p-4 rounded-lg border border-slate-800 text-center">
        <span className="block text-xs text-slate-400 mb-1">
          {mode === 'register' ? 'Monatsbetrag' : 'Rechnungsbetrag'}
        </span>
        <strong className="text-2xl font-bold text-white block">
          {isValid ? `${pricing.totalPriceEur.toFixed(2)} €` : '—'}
        </strong>
      </output>
    </fieldset>
  );
}
