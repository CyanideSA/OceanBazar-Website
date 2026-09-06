'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ordersApi, storefrontApi } from '@/lib/api';
import { format } from 'date-fns';
import { getMediaUrl } from '@/lib/mediaUrl';

interface OrderItem {
  id: string;
  productId: string;
  productTitle: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  gst: number;
  shippingFee: number;
  serviceFee: number;
  paymentProcessingFee?: number;
  payment_processing_fee_amount?: number;
  total: number;
  items: OrderItem[];
  shippingAddress?: {
    name: string;
    phone: string;
    addressLine1: string;
    city: string;
    district: string;
    country: string;
  };
}

type BizSettings = {
  legalName?: string;
  registeredAddress?: string;
  contactAddress?: string;
  supportEmail?: string;
  supportPhone?: string;
  tradeLicenseNo?: string;
  tinNumber?: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
};

/** A4 printable box at 96dpi with 10mm margins. */
const PRINT_WIDTH_PX = Math.round(((210 - 20) / 25.4) * 96);
const PRINT_HEIGHT_PX = Math.round(((297 - 20) / 25.4) * 96);

export default function AccountOrderInvoicePageClient() {
  const params = useParams();
  const locale = useLocale();
  const orderId = params.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [biz, setBiz] = useState<BizSettings>({});
  const [loading, setLoading] = useState(true);
  const sheetRef = useRef<HTMLDivElement>(null);

  /**
   * Measure at the A4 printable width (not the current screen width) so the same
   * scale is picked on phone, tablet and desktop, then shrink to fit one page.
   */
  const fitToOnePage = useCallback(() => {
    const el = sheetRef.current;
    if (!el) return;
    const prevWidth = el.style.width;
    const prevScale = el.style.getPropertyValue('--print-scale');
    el.style.setProperty('--print-scale', '1');
    el.style.width = `${PRINT_WIDTH_PX}px`;
    const contentHeight = el.scrollHeight;
    el.style.width = prevWidth;
    const scale = contentHeight > PRINT_HEIGHT_PX ? PRINT_HEIGHT_PX / contentHeight : 1;
    el.style.setProperty('--print-scale', String(Math.max(0.45, Math.min(1, scale))));
    if (scale >= 1 && prevScale) el.style.setProperty('--print-scale', '1');
  }, []);

  useEffect(() => {
    Promise.all([
      ordersApi.get(orderId).then((r) => r.data?.order || null).catch(() => null),
      storefrontApi
        .settings()
        .then((r) => (r.data?.settings || r.data || {}) as BizSettings)
        .catch(() => ({}) as BizSettings),
    ])
      .then(([o, s]) => {
        setOrder(o);
        setBiz(s || {});
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (loading || !order) return;
    fitToOnePage();
    const onBeforePrint = () => fitToOnePage();
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('resize', fitToOnePage);
    const timer = setTimeout(() => {
      fitToOnePage();
      window.print();
    }, 800);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('resize', fitToOnePage);
    };
  }, [loading, order, fitToOnePage]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Order not found.</p>
      </div>
    );
  }

  const logo = biz.logoLightUrl || biz.logoDarkUrl || '/ob-brand-logo.png';
  const legalName = biz.legalName || 'Ocean Bazar';
  const address = biz.registeredAddress || biz.contactAddress || '';
  const email = biz.supportEmail || 'contact@oceanbazar.com.bd';
  const phone = biz.supportPhone || '+880 1349 358 825';
  const payFee = Number(order.paymentProcessingFee ?? order.payment_processing_fee_amount ?? 0);

  const gross = Number(order.subtotal) || 0;
  const discount = Number(order.discount) || 0;
  const vat = Number(order.gst) || 0;
  const shipping = Number(order.shippingFee) || 0;
  const legacyServiceFee = Number(order.serviceFee) || 0;
  const netOfFees = gross - discount + shipping + legacyServiceFee;
  // Orders placed before VAT-inclusive pricing added VAT on top; detect which model applies.
  const vatInclusive =
    Math.abs(netOfFees - Number(order.total)) <= Math.abs(netOfFees + vat - Number(order.total));
  const subtotalExclVat = vatInclusive ? gross - discount - vat : gross - discount;
  const vatRatePct = subtotalExclVat > 0 ? (vat / subtotalExclVat) * 100 : 0;
  const vatRateLabel = Number.isInteger(vatRatePct) ? String(vatRatePct) : vatRatePct.toFixed(1);

  return (
    <>
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .invoice-sheet {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            transform: scale(var(--print-scale, 1));
            transform-origin: top left;
          }
          .invoice-sheet, .invoice-sheet * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .avoid-break { page-break-inside: avoid; break-inside: avoid; }
          .invoice-sheet table { page-break-inside: auto; }
          .invoice-sheet tr, .invoice-sheet thead, .invoice-sheet tfoot {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="no-print flex justify-end gap-3 border-b border-gray-200 bg-gray-50 px-8 py-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          🖨️ Print / Save PDF
        </button>
        <Link
          href={`/${locale}/account/orders/${orderId}`}
          className="inline-flex items-center rounded-lg border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
        >
          ← Back to Order
        </Link>
      </div>

      <div ref={sheetRef} className="invoice-sheet mx-auto max-w-3xl bg-white p-10 font-sans text-gray-800">
        <div className="avoid-break flex items-start justify-between border-b border-gray-200 pb-6">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getMediaUrl(logo)}
              alt={legalName}
              className="mb-2 h-12 w-auto object-contain"
            />
            <h1 className="text-2xl font-extrabold text-blue-700">{legalName}</h1>
            {address ? <p className="mt-1 max-w-xs text-xs text-gray-500">{address}</p> : null}
            <p className="text-xs text-gray-500">
              {email} · {phone}
            </p>
            {(biz.tradeLicenseNo || biz.tinNumber) && (
              <p className="mt-1 text-[11px] text-gray-500">
                {biz.tradeLicenseNo ? `Trade license: ${biz.tradeLicenseNo}` : ''}
                {biz.tradeLicenseNo && biz.tinNumber ? ' · ' : ''}
                {biz.tinNumber ? `TIN: ${biz.tinNumber}` : ''}
              </p>
            )}
            <p className="text-xs text-gray-500">oceanbazar.com.bd</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-700">INVOICE</h2>
            <p className="mt-1 text-sm font-semibold text-gray-600">#{order.orderNumber}</p>
            <p className="text-xs text-gray-500">
              Date: {format(new Date(order.createdAt), 'MMMM dd, yyyy')}
            </p>
            <span
              className={`mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wide ${
                order.paymentStatus === 'paid'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {order.paymentStatus === 'paid' ? 'PAID' : 'PENDING'}
            </span>
          </div>
        </div>

        {order.shippingAddress && (
          <div className="avoid-break mt-6 grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Bill To</p>
              <p className="mt-1 font-semibold text-gray-800">{order.shippingAddress.name}</p>
              <p className="text-sm text-gray-600">{order.shippingAddress.addressLine1}</p>
              <p className="text-sm text-gray-600">
                {order.shippingAddress.city}, {order.shippingAddress.district}
              </p>
              <p className="text-sm text-gray-600">{order.shippingAddress.country}</p>
              <p className="text-sm text-gray-600">📞 {order.shippingAddress.phone}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Payment</p>
              <p className="mt-1 text-sm font-semibold capitalize text-gray-800">
                {order.paymentMethod?.replace(/_/g, ' ')}
              </p>
              <p className="mt-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                Order Status
              </p>
              <p className="mt-1 text-sm font-semibold capitalize text-gray-800">{order.status}</p>
            </div>
          </div>
        )}

        <div className="mt-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="px-4 py-2.5 text-left font-semibold">Product</th>
                <th className="px-4 py-2.5 text-center font-semibold">Qty</th>
                <th className="px-4 py-2.5 text-right font-semibold">Unit Price</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={item.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-4 py-2.5 text-gray-800">{item.productTitle}</td>
                  <td className="px-4 py-2.5 text-center text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">
                    ৳{Number(item.unitPrice).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                    ৳{Number(item.lineTotal).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="avoid-break mt-6 flex justify-end">
          <div className="w-72 space-y-1.5 text-sm">
            {discount > 0 && (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>Items (incl. VAT)</span>
                  <span>৳{gross.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-৳{discount.toLocaleString()}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Subtotal (excl. VAT)</span>
              <span>৳{subtotalExclVat.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>VAT ({vatRateLabel}%)</span>
              <span>৳{vat.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping</span>
              <span>
                {shipping === 0 ? (
                  <span className="font-semibold text-green-600">Free</span>
                ) : (
                  `৳${shipping.toLocaleString()}`
                )}
              </span>
            </div>
            {payFee > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Online payment fee</span>
                <span>৳{payFee.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-300 pt-2 text-base font-bold text-gray-800">
              <span>Total Due</span>
              <span className="text-blue-700">৳{Number(order.total).toLocaleString()}</span>
            </div>
            {vat > 0 && (
              <p className="pt-1 text-[10px] leading-tight text-gray-400">
                Item prices include {vatRateLabel}% VAT
                {biz.tinNumber ? ` · VAT registration TIN: ${biz.tinNumber}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="avoid-break mt-8 border-t border-gray-200 pt-5 text-center text-xs text-gray-400">
          <p>Thank you for shopping with {legalName}!</p>
          <p className="mt-1">
            Questions? {email} · {phone}
          </p>
          <p className="mt-1">This is a computer-generated invoice and does not require a signature.</p>
        </div>
      </div>
    </>
  );
}
