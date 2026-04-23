const translations = {
  en: {
    common: {
      loading: "Loading...",
      error: "Something went wrong",
      retry: "Try Again",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      view: "View",
      search: "Search",
      noResults: "No results found",
      confirm: "Confirm",
      back: "Back",
      next: "Next",
    },
    nav: {
      home: "Home",
      products: "Products",
      cart: "Cart",
      wishlist: "Wishlist",
      account: "Account",
      orders: "Orders",
      help: "Help",
      login: "Login",
      signup: "Sign Up",
      logout: "Logout",
    },
    product: {
      addToCart: "Add to Cart",
      buyNow: "Buy Now",
      outOfStock: "Out of Stock",
      inStock: "In Stock",
      lowStock: "Low Stock",
      reviews: "Reviews",
      writeReview: "Write a Review",
      specifications: "Specifications",
      description: "Description",
      relatedProducts: "Related Products",
      compareAtPrice: "Was",
      freeShipping: "Free Shipping",
      verified: "Verified Seller",
    },
    cart: {
      title: "Shopping Cart",
      empty: "Your cart is empty",
      subtotal: "Subtotal",
      shipping: "Shipping",
      discount: "Discount",
      total: "Total",
      checkout: "Proceed to Checkout",
      continueShopping: "Continue Shopping",
      applyCoupon: "Apply Coupon",
      removeCoupon: "Remove",
    },
    checkout: {
      title: "Checkout",
      shippingAddress: "Shipping Address",
      paymentMethod: "Payment Method",
      placeOrder: "Place Order",
      processing: "Processing...",
      orderConfirmed: "Order Confirmed!",
    },
    order: {
      title: "My Orders",
      status: "Status",
      trackOrder: "Track Order",
      returnRequest: "Request Return",
      orderDetails: "Order Details",
      timeline: "Timeline",
    },
    account: {
      dashboard: "Dashboard",
      settings: "Account Settings",
      addresses: "Addresses",
      returns: "Returns",
      notifications: "Notifications",
    },
  },
  bn: {
    common: {
      loading: "লোড হচ্ছে...",
      error: "কিছু ভুল হয়েছে",
      retry: "আবার চেষ্টা করুন",
      save: "সংরক্ষণ",
      cancel: "বাতিল",
      delete: "মুছুন",
      edit: "সম্পাদনা",
      view: "দেখুন",
      search: "অনুসন্ধান",
      noResults: "কোনো ফলাফল পাওয়া যায়নি",
      confirm: "নিশ্চিত",
      back: "পিছনে",
      next: "পরবর্তী",
    },
    nav: {
      home: "হোম",
      products: "পণ্যসমূহ",
      cart: "কার্ট",
      wishlist: "ইচ্ছা তালিকা",
      account: "অ্যাকাউন্ট",
      orders: "অর্ডার",
      help: "সাহায্য",
      login: "লগ ইন",
      signup: "সাইন আপ",
      logout: "লগ আউট",
    },
    product: {
      addToCart: "কার্টে যোগ করুন",
      buyNow: "এখনই কিনুন",
      outOfStock: "স্টকে নেই",
      inStock: "স্টকে আছে",
      lowStock: "কম স্টক",
      reviews: "পর্যালোচনা",
      writeReview: "পর্যালোচনা লিখুন",
    },
  },
};

let currentLocale = localStorage.getItem("oceanBazar_locale") || "en";

export function setLocale(locale) {
  currentLocale = locale;
  localStorage.setItem("oceanBazar_locale", locale);
}

export function getLocale() {
  return currentLocale;
}

export function t(path) {
  const keys = path.split(".");
  let result = translations[currentLocale];
  for (const key of keys) {
    if (!result || typeof result !== "object") return path;
    result = result[key];
  }
  if (result === undefined) {
    let fallback = translations.en;
    for (const key of keys) {
      if (!fallback || typeof fallback !== "object") return path;
      fallback = fallback[key];
    }
    return fallback || path;
  }
  return result;
}

export function getSupportedLocales() {
  return [
    { code: "en", label: "English" },
    { code: "bn", label: "বাংলা" },
  ];
}

export default t;
