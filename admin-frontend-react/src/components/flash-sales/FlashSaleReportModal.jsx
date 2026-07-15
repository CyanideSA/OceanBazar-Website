import React, { useEffect, useState } from "react";
import { FiX, FiPackage, FiShoppingBag, FiBarChart2 } from "react-icons/fi";
import { api } from "../../lib/api";
import { format } from "date-fns";

const BASE = "/api";

export default function FlashSaleReportModal({ saleId, saleName, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("products");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`${BASE}/flash-sales/${saleId}/report`);
        setData(res.data);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [saleId]);

  const summary = data?.summary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-crm-surface border border-crm-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-crm-border shrink-0">
          <div>
            <h2 className="text-lg font-bold text-crm-text-bright flex items-center gap-2">
              <FiBarChart2 className="text-crm-warning" /> Sales Report
            </h2>
            <p className="text-sm text-crm-text-dim">{saleName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-crm-border/30 text-crm-text-muted">
            <FiX size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-10 w-10 border-b-2 border-crm-warning rounded-full" />
          </div>
        ) : !data ? (
          <p className="p-8 text-center text-crm-text-dim">Could not load report.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 border-b border-crm-border shrink-0">
              {[
                { label: "Units sold", value: summary?.totalUnitsSold ?? 0 },
                { label: "Revenue (৳)", value: Number(summary?.totalRevenue ?? 0).toLocaleString() },
                { label: "Orders", value: summary?.orderCount ?? 0 },
                { label: "Products", value: summary?.productCount ?? 0 },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-crm-bg border border-crm-border p-3 text-center">
                  <p className="text-xl font-black text-crm-text-bright">{s.value}</p>
                  <p className="text-xs text-crm-text-dim mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 px-5 pt-3 shrink-0">
              <button
                type="button"
                onClick={() => setTab("products")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === "products" ? "bg-crm-warning-dim text-crm-warning" : "text-crm-text-dim"}`}
              >
                <FiPackage className="inline mr-1" size={14} /> By product
              </button>
              <button
                type="button"
                onClick={() => setTab("orders")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === "orders" ? "bg-crm-warning-dim text-crm-warning" : "text-crm-text-dim"}`}
              >
                <FiShoppingBag className="inline mr-1" size={14} /> By order
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              {tab === "products" ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-crm-text-dim border-b border-crm-border">
                      <th className="pb-2 pr-2">Product</th>
                      <th className="pb-2 pr-2">Flash ৳</th>
                      <th className="pb-2 pr-2">Sold</th>
                      <th className="pb-2 pr-2">Left</th>
                      <th className="pb-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.products || []).map((row) => (
                      <tr key={row.id} className="border-b border-crm-border/40">
                        <td className="py-2 pr-2">
                          <p className="font-medium text-crm-text-bright">{row.title_en}</p>
                          <p className="text-xs text-crm-text-muted">{row.sku || row.product_id}</p>
                        </td>
                        <td className="py-2 pr-2">৳{Number(row.flash_price).toLocaleString()}</td>
                        <td className="py-2 pr-2">{row.sold}</td>
                        <td className="py-2 pr-2">{row.remaining}</td>
                        <td className="py-2">৳{Number(row.revenue || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-crm-text-dim border-b border-crm-border">
                      <th className="pb-2 pr-2">Order</th>
                      <th className="pb-2 pr-2">Date</th>
                      <th className="pb-2 pr-2">Product</th>
                      <th className="pb-2 pr-2">Qty</th>
                      <th className="pb-2 pr-2">Unit ৳</th>
                      <th className="pb-2">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.orders || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-crm-text-dim">
                          No orders matched this campaign window yet.
                        </td>
                      </tr>
                    ) : (
                      data.orders.map((row) => (
                        <tr key={`${row.order_id}-${row.line_id}`} className="border-b border-crm-border/40">
                          <td className="py-2 pr-2 font-mono text-xs">{row.order_id}</td>
                          <td className="py-2 pr-2 text-xs">
                            {row.created_at ? format(new Date(row.created_at), "MMM d, HH:mm") : "—"}
                          </td>
                          <td className="py-2 pr-2">{row.product_title}</td>
                          <td className="py-2 pr-2">{row.quantity}</td>
                          <td className="py-2 pr-2">৳{Number(row.unit_price).toLocaleString()}</td>
                          <td className="py-2">৳{Number(row.line_total).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
