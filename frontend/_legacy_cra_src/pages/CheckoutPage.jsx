import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { useToast } from "../hooks/use-toast";
import { orderAPI, paymentAPI, couponAPI } from "../api/service";
import { computeCheckoutTotals, GST_RATE } from "../utils/checkoutTotals";

const CheckoutPage = ({ cartItems }) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const subtotal = useMemo(
    () => (cartItems || []).reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  );

  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  const merchandiseAfterCoupon = Math.max(0, subtotal - couponDiscount);
  const { gst, serviceFee, shipping, total } = computeCheckoutTotals(merchandiseAfterCoupon);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const res = await couponAPI.validate(couponCode.trim(), subtotal);
      const data = res.data;
      if (data.valid) {
        setCouponDiscount(data.discount || 0);
        setCouponApplied(data.coupon);
        toast({ title: "Coupon applied!", description: `You saved $${data.discount}` });
      } else {
        setCouponError(data.message || "Invalid coupon");
        setCouponDiscount(0);
        setCouponApplied(null);
      }
    } catch (e) {
      setCouponError(e?.response?.data?.detail || e?.response?.data?.message || "Could not validate coupon");
      setCouponDiscount(0);
      setCouponApplied(null);
    }
    setCouponLoading(false);
  };

  const [shippingForm, setShippingForm] = useState({
    fullName: "",
    address: "",
    phone: "",
  });

  const [paymentMethod, setPaymentMethod] = useState("bkash");

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const [idempotencyKey] = useState(() => {
    const LS_KEY = "oceanBazar_checkout_idempotencyKey";
    const existing = sessionStorage.getItem(LS_KEY);
    if (existing) return existing;

    const newKey =
      window.crypto?.randomUUID?.() ||
      `ck_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(LS_KEY, newKey);
    return newKey;
  });

  const handlePlaceOrder = async () => {
    if (isPlacingOrder) return;
    setCheckoutError("");

    const token = localStorage.getItem("oceanBazarToken");
    if (!token) {
      toast({
        title: "Please sign in",
        description: "You need to be logged in to place an order.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    const fullName = String(shippingForm.fullName || "").trim();
    const address = String(shippingForm.address || "").trim();
    const phone = String(shippingForm.phone || "").trim();

    if (!fullName || !address || !phone) {
      toast({
        title: "Missing shipping info",
        description: "Please fill full name, address, and phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsPlacingOrder(true);
    try {
      const placeRes = await orderAPI.place({
        shippingAddress: { fullName, address, phone },
        paymentMethod,
        idempotencyKey,
        couponCode: couponDiscount > 0 ? couponCode.trim() : undefined,
      });

      const orderId = placeRes?.data?.orderId;
      const orderNumber = placeRes?.data?.orderNumber;
      if (!orderId) throw new Error("No orderId returned");

      if (paymentMethod === "nagad") {
        await paymentAPI.nagadPlaceholder({ orderId });
      } else if (paymentMethod === "sslcommerz") {
        await paymentAPI.sslcommerzPlaceholder({ orderId });
      } else {
        await paymentAPI.bkashPlaceholder({ orderId });
      }

      toast({
        title: "Order placed!",
        description: orderNumber
          ? `Order: ${orderNumber}. Payment simulated — view it in My Orders.`
          : "Payment simulated successfully. You can track it in Orders.",
      });

      // Force App remount to refresh cart (cart gets cleared on backend).
      window.location.href = "/account/orders";
    } catch (error) {
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Please check your shipping info and try again.";
      setCheckoutError(msg);
      toast({
        title: "Checkout failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="text-center">
          <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" />
          <p className="text-lg text-gray-700 dark:text-gray-200">Your cart is empty.</p>
          <Button
            onClick={() => navigate("/products")}
            className="mt-4 bg-[#5BA3D0] hover:bg-[#4A90B8] text-white"
          >
            Browse Products
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="mx-auto max-w-screen-2xl px-3 py-8 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate("/cart")}
          className="mb-6 flex items-center gap-2 text-gray-700 transition-colors hover:text-[#5BA3D0] dark:text-gray-300 dark:hover:text-[#7BB8DC]"
        >
          Back to cart
        </button>

        <h1 className="mb-6 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">Checkout</h1>
        {checkoutError ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-950/50">
            <p className="text-sm text-red-800 dark:text-red-200">{checkoutError}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-soft dark:border-gray-800 dark:bg-gray-800/80">
              <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-50">Shipping & Contact</h2>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="fullName" className="text-gray-900 dark:text-gray-100">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    placeholder="Enter your full name"
                    className="mt-1"
                    value={shippingForm.fullName}
                    disabled={isPlacingOrder}
                    onChange={(e) => setShippingForm((p) => ({ ...p, fullName: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="address" className="text-gray-900 dark:text-gray-100">
                    Address
                  </Label>
                  <Textarea
                    id="address"
                    placeholder="House, Road, Area, City"
                    rows={4}
                    className="mt-1"
                    value={shippingForm.address}
                    disabled={isPlacingOrder}
                    onChange={(e) => setShippingForm((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-gray-900 dark:text-gray-100">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    placeholder="Enter phone number"
                    className="mt-1"
                    value={shippingForm.phone}
                    disabled={isPlacingOrder}
                    onChange={(e) => setShippingForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-soft dark:border-gray-800 dark:bg-gray-800/80">
              <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-50">Payment</h2>
              <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
                Choose your payment method. bKash, Nagad, and SSLCOMMERZ use test/placeholder flows today; backend routes are ready for live API keys.
              </p>
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/60">
                <p className="text-xs leading-relaxed text-gray-800 dark:text-gray-200">
                  Secure checkout: Order details are protected and payment status is tracked in your account orders.
                </p>
              </div>

              <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                Payment method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={isPlacingOrder}
                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground transition-colors focus:border-transparent focus:ring-2 focus:ring-ring disabled:opacity-60 dark:border-gray-600"
              >
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="sslcommerz">SSLCOMMERZ</option>
              </select>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl border border-gray-100 bg-white p-6 shadow-soft dark:border-gray-800 dark:bg-gray-800/80">
              <h2 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-50">Order Summary</h2>

              <div className="mb-6 space-y-4">
                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>Subtotal</span>
                  <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">${subtotal.toFixed(2)}</span>
                </div>
                {couponDiscount > 0 ? (
                  <div className="flex justify-between text-gray-700 dark:text-gray-300">
                    <span>Coupon</span>
                    <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                      -${couponDiscount.toFixed(2)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>GST ({Math.round(GST_RATE * 100)}%)</span>
                  <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">${gst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>Service fee</span>
                  <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">${serviceFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>Shipping</span>
                  <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">${shipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-4 text-lg font-bold text-gray-900 dark:border-gray-700 dark:text-gray-50">
                  <span>Total</span>
                  <span className="text-[#5BA3D0] dark:text-[#7BB8DC]">${total.toFixed(2)}</span>
                </div>
              </div>

              <Button
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder}
                className="w-full bg-[#5BA3D0] hover:bg-[#4A90B8] text-white h-12 text-lg"
              >
                {isPlacingOrder ? "Processing order..." : "Place order"}
              </Button>

              <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  <strong className="font-semibold text-gray-900 dark:text-gray-50">Trade Assurance:</strong> Your order
                  is protected by OceanBazar&apos;s buyer protection
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                    Verified flow
                  </span>
                  <span className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                    Order tracking
                  </span>
                  <span className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                    Support ready
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;

