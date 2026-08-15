'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ordersApi } from '@/lib/api';
import { format } from 'date-fns';
import { LOGO_SRC_BRAND } from '@/components/shared/Logo';

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
  total: number;
  items: OrderItem[];
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  shippingAddress?: {
    name: string;
    phone: string;
    addressLine1: string;
    city: string;
    district: string;
    country: string;
  };
}

function prettyStatus(value?: string) {
  const v = String(value || '').trim().toLowerCase().replace(/_/g, ' ');
  if (!v) return '—';
  return v.replace(/\b\w/g, (c) => c.toUpperCase());
}

function isPaid(paymentStatus?: string) {
  const v = String(paymentStatus || '').toLowerCase();
  return v === 'paid' || v === 'completed' || v === 'success';
}

export default function AccountOrderInvoicePageClient() {
  const params = useParams();
  const locale = useLocale();
  const orderId = params.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const logoSrc = LOGO_SRC_BRAND;

  useEffect(() => {
    ordersApi
      .get(orderId)
      .then((r) => setOrder(r.data?.order || null))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (!loading && order) {
      const t = window.setTimeout(() => {
        // #region agent log
        try {
          const el = document.getElementById('ob-invoice');
          const rect = el ? el.getBoundingClientRect() : null;
          const h = el ? el.scrollHeight : 0;
          const pageCssMm = 297;
          const marginMm = 10;
          const usablePxApprox = ((pageCssMm - marginMm * 2) / 25.4) * 96;
          const contactText = el?.textContent || '';
          fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1eb282'},body:JSON.stringify({sessionId:'1eb282',runId:'pre-fix',hypothesisId:'H1',location:'AccountOrderInvoicePageClient.tsx:print',message:'invoice print metrics before window.print',data:{orderId,itemCount:order.items?.length||0,scrollHeight:h,clientHeight:el?.clientHeight||0,offsetHeight:el?.offsetHeight||0,rectHeight:rect?.height||0,bodyScrollHeight:document.body.scrollHeight,docScrollHeight:document.documentElement.scrollHeight,usablePxApprox:Math.round(usablePxApprox),overflowPagesEstimate:usablePxApprox>0?Number((h/usablePxApprox).toFixed(2)):null,hasNoPrint:!!document.querySelector('.no-print'),hasContactEmail:/contact@oceanbazar\.com\.bd/i.test(contactText),hasWrongSupport:/support@oceanbazar/i.test(contactText),printCssStatic:true},timestamp:Date.now()})}).catch(()=>{});
        } catch { /* ignore */ }
        // #endregion
        window.print();
      }, 600);
      return () => window.clearTimeout(t);
    }
  }, [loading, order]);

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

  const billName = order.customer?.name || order.shippingAddress?.name || 'Customer';
  const billEmail = order.customer?.email || '';
  const billPhone = order.customer?.phone || order.shippingAddress?.phone || '';
  const paid = isPaid(order.paymentStatus);

  return (
    <>
      <style>{`
        @media print {
          /* Hide chrome without leaving phantom page height from ShopShell */
          header, footer, nav, aside, .no-print,
          [data-bottom-nav], [data-chat-widget], [data-login-dialog] { display: none !important; }
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          body * { visibility: hidden !important; }
          #ob-invoice, #ob-invoice * { visibility: visible !important; }
          #ob-invoice {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            font-size: 10.5px !important;
            line-height: 1.35 !important;
            page-break-after: avoid !important;
            break-after: avoid-page !important;
          }
          #ob-invoice table { font-size: 10px !important; }
          #ob-invoice img { height: 36px !important; width: auto !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @page { size: A4; margin: 8mm; }
      `}</style>

      <div className="no-print flex justify-end gap-3 border-b border-gray-200 bg-gray-50 px-8 py-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-[#2E7CF6] px-5 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110"
        >
          Print / Save PDF
        </button>
        <Link
          href={`/${locale}/account/orders/${orderId}`}
          className="inline-flex items-center rounded-lg border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
        >
          ← Back to Order
        </Link>
      </div>

      <div id="ob-invoice" className="mx-auto max-w-3xl bg-white p-8 font-sans text-gray-800">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="OceanBazar" width={168} height={56} className="h-12 w-auto object-contain" />
            <p className="mt-2 text-xs text-gray-500">oceanbazar.com.bd</p>
            <p className="text-xs text-gray-500">contact@oceanbazar.com.bd</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold tracking-wide text-gray-800">INVOICE</h2>
            <p className="mt-1 text-sm font-semibold text-gray-700">#{order.orderNumber}</p>
            <p className="text-xs text-gray-500">Date: {format(new Date(order.createdAt), 'MMMM dd, yyyy')}</p>
            <div className="mt-2 flex flex-wrap justify-end gap-1.5">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {paid ? 'PAID' : prettyStatus(order.paymentStatus) || 'PENDING'}
              </span>
              <span className="inline-block rounded-full bg-[#2E7CF6]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2E7CF6]">
                {prettyStatus(order.status)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Bill To</p>
            <p className="mt-1 font-semibold text-gray-800">{billName}</p>
            {billEmail ? <p className="text-sm text-gray-600">{billEmail}</p> : null}
            {billPhone ? <p className="text-sm text-gray-600">{billPhone}</p> : null}
            {order.shippingAddress && (
              <>
                <p className="mt-2 text-sm text-gray-600">{order.shippingAddress.addressLine1}</p>
                <p className="text-sm text-gray-600">
                  {[order.shippingAddress.city, order.shippingAddress.district].filter(Boolean).join(', ')}
                </p>
                <p className="text-sm text-gray-600">{order.shippingAddress.country}</p>
              </>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Payment</p>
            <p className="mt-1 text-sm font-semibold capitalize text-gray-800">
              {String(order.paymentMethod || '').replace(/_/g, ' ') || '—'}
            </p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Order Status</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">{prettyStatus(order.status)}</p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Payment Status</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">{prettyStatus(order.paymentStatus)}</p>
          </div>
        </div>

        <div className="mt-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#2E7CF6] text-white">
                <th className="px-3 py-2 text-left font-semibold">Product</th>
                <th className="px-3 py-2 text-center font-semibold">Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Unit</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={item.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-3 py-1.5 text-gray-800">{item.productTitle}</td>
                  <td className="px-3 py-1.5 text-center text-gray-600">{item.quantity}</td>
                  <td className="px-3 py-1.5 text-right text-gray-600">৳{Number(item.unitPrice).toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-gray-800">
                    ৳{Number(item.lineTotal).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-60 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>৳{Number(order.subtotal).toLocaleString()}</span>
            </div>
            {Number(order.discount) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-৳{Number(order.discount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Shipping</span>
              <span>
                {Number(order.shippingFee) === 0 ? (
                  <span className="font-semibold text-green-600">Free</span>
                ) : (
                  `৳${Number(order.shippingFee).toLocaleString()}`
                )}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>VAT (5%)</span>
              <span>৳{Number(order.gst).toLocaleString()}</span>
            </div>
            {Number(order.serviceFee) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Service Fee</span>
                <span>৳{Number(order.serviceFee).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-300 pt-1.5 text-base font-bold text-gray-800">
              <span>Total Due</span>
              <span className="text-[#2E7CF6]">৳{Number(order.total).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-4 text-center text-[11px] text-gray-400">
          <p>Thank you for shopping with OceanBazar.</p>
          <p className="mt-0.5">Questions? contact@oceanbazar.com.bd · Computer-generated invoice</p>
        </div>
      </div>
    </>
  );
}
