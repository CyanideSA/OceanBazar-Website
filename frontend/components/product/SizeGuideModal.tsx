'use client';

import { X } from 'lucide-react';

const SIZE_CHART = [
  { size: 'XS', chest: '32–34', waist: '24–26', hips: '34–36' },
  { size: 'S',  chest: '35–37', waist: '27–29', hips: '37–39' },
  { size: 'M',  chest: '38–40', waist: '30–32', hips: '40–42' },
  { size: 'L',  chest: '41–43', waist: '33–35', hips: '43–45' },
  { size: 'XL', chest: '44–46', waist: '36–38', hips: '46–48' },
  { size: '2XL',chest: '47–49', waist: '39–41', hips: '49–51' },
  { size: '3XL',chest: '50–52', waist: '42–44', hips: '52–54' },
];

export default function SizeGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-2xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-bold text-foreground">Size Guide</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">All measurements are in inches. For the best fit, measure yourself and compare to the chart.</p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Size</th>
                  <th className="px-4 py-3 text-center font-semibold text-foreground">Chest (in)</th>
                  <th className="px-4 py-3 text-center font-semibold text-foreground">Waist (in)</th>
                  <th className="px-4 py-3 text-center font-semibold text-foreground">Hips (in)</th>
                </tr>
              </thead>
              <tbody>
                {SIZE_CHART.map((row) => (
                  <tr key={row.size} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-primary">{row.size}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{row.chest}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{row.waist}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{row.hips}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
            <p className="text-xs font-semibold text-primary mb-1">How to measure</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• <strong>Chest:</strong> Measure around the fullest part of your chest</li>
              <li>• <strong>Waist:</strong> Measure around your natural waistline</li>
              <li>• <strong>Hips:</strong> Measure around the fullest part of your hips</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
