'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ordersApi } from '@/lib/api';
import { format } from 'date-fns';

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
  shippingAddress?: {
    name: string;
    phone: string;
    addressLine1: string;
    city: string;
    district: string;
    country: string;
  };
}

export default function AccountOrderInvoicePageClient() {
  const params = useParams();
  const locale = useLocale();
  const orderId = params.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersApi
      .get(orderId)
      .then((r) => setOrder(r.data?.order || null))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (!loading && order) {
      setTimeout(() => window.print(), 800);
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

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        @page { size: A4; margin: 20mm; }
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

      <div className="mx-auto max-w-3xl bg-white p-10 font-sans text-gray-800">
        <div className="flex items-start justify-between border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-700">OceanBazar</h1>
            <p className="mt-1 text-xs text-gray-500">oceanbazar.com</p>
            <p className="text-xs text-gray-500">support@oceanbazar.com</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-700">INVOICE</h2>
            <p className="mt-1 text-sm font-semibold text-gray-600">#{order.orderNumber}</p>
            <p className="text-xs text-gray-500">Date: {format(new Date(order.createdAt), 'MMMM dd, yyyy')}</p>
            <span
              className={`mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wide ${
                order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {order.paymentStatus === 'paid' ? 'PAID' : 'PENDING'}
            </span>
          </div>
        </div>

        {order.shippingAddress && (
          <div className="mt-6 grid grid-cols-2 gap-8">
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
              <p className="mt-2 text-xs font-bold uppercase tracking-wider text-gray-400">Order Status</p>
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
                  <td className="px-4 py-2.5 text-right text-gray-600">৳{Number(item.unitPrice).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                    ৳{Number(item.lineTotal).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-1.5 text-sm">
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
            <div className="flex justify-between border-t border-gray-300 pt-2 text-base font-bold text-gray-800">
              <span>Total Due</span>
              <span className="text-blue-700">৳{Number(order.total).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
          <p>Thank you for shopping with OceanBazar!</p>
          <p className="mt-1">Questions? Email us at support@oceanbazar.com</p>
          <p className="mt-1">This is a computer-generated invoice and does not require a signature.</p>
        </div>
      </div>
    </>
  );
}
