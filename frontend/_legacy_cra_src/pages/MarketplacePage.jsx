import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Shield, TrendingUp, Package, Users, Globe, CreditCard, Truck, Award, ChevronRight, ArrowLeft, CheckCircle, Star, Zap, BarChart3, Headphones, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MarketplacePage = () => {
  const navigate = useNavigate();

  const forBuyers = [
    { icon: Package, title: 'Curated Catalog', description: '50,000+ products across 40+ categories from verified manufacturers and suppliers.', color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300' },
    { icon: Shield, title: 'Buyer Protection', description: 'Every order protected with our money-back guarantee, secure payments, and dispute resolution.', color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300' },
    { icon: CreditCard, title: 'Flexible Pricing', description: 'Retail and wholesale pricing with automatic quantity discounts applied at checkout.', color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300' },
    { icon: Truck, title: 'Reliable Shipping', description: 'Tracked domestic and international shipping with express options for urgent orders.', color: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-300' },
    { icon: Star, title: 'Verified Reviews', description: 'Real reviews from verified buyers to help you make confident purchase decisions.', color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300' },
    { icon: Headphones, title: '24/7 Support', description: 'Live chat, email, and phone support whenever you need assistance with your order.', color: 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300' }
  ];

  const forSellers = [
    { icon: Globe, title: 'Reach Millions', description: 'Access a growing customer base of retail shoppers and wholesale buyers across Bangladesh and beyond.' },
    { icon: BarChart3, title: 'Seller Dashboard', description: 'Real-time analytics, inventory management, and order tracking in one powerful dashboard.' },
    { icon: CreditCard, title: 'Fast Payouts', description: 'Transparent commission structure with weekly, biweekly, or monthly payout schedules.' },
    { icon: Zap, title: 'Easy Onboarding', description: 'Get started in minutes. Upload products, set pricing, and start selling the same day.' },
    { icon: Shield, title: 'Fraud Protection', description: 'Advanced fraud detection protects sellers from chargebacks and fraudulent orders.' },
    { icon: TrendingUp, title: 'Growth Tools', description: 'Promotions, featured listings, coupons, and analytics to help grow your business.' }
  ];

  const categories = [
    'Electronics', 'Fashion & Apparel', 'Beauty & Personal Care', 'Home & Garden',
    'Industrial Supplies', 'Automotive Parts', 'Food & Beverages', 'Health & Medical',
    'Sports & Outdoors', 'Toys & Games', 'Office Supplies', 'Jewelry & Accessories'
  ];

  const howItWorks = [
    { step: 1, title: 'Browse or Search', description: 'Explore our catalog of 50,000+ products or search for exactly what you need.' },
    { step: 2, title: 'Compare & Choose', description: 'Compare prices, read reviews, and check seller ratings to find the best deal.' },
    { step: 3, title: 'Secure Checkout', description: 'Pay with bKash, Nagad, bank transfer, or card. Every transaction is protected.' },
    { step: 4, title: 'Track & Receive', description: 'Real-time tracking from warehouse to your door. Rate your experience after delivery.' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="bg-gradient-to-r from-[#5BA3D0] via-[#4A90B8] to-[#3a7fb5] text-white py-20">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8">
          <Button onClick={() => navigate('/')} variant="ghost" className="text-white hover:bg-white/20 mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <Store className="w-8 h-8" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold">OceanBazar Marketplace</h1>
            </div>
            <p className="text-xl text-white/90">A trusted B2B and B2C platform connecting verified sellers with millions of buyers. Wholesale quality, retail convenience.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10 max-w-3xl">
            <div className="bg-white/15 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              <div className="text-3xl font-bold">50K+</div>
              <div className="text-sm text-white/70">Products</div>
            </div>
            <div className="bg-white/15 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              <div className="text-3xl font-bold">2,500+</div>
              <div className="text-sm text-white/70">Verified Sellers</div>
            </div>
            <div className="bg-white/15 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              <div className="text-3xl font-bold">100K+</div>
              <div className="text-sm text-white/70">Orders Delivered</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-12">
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 text-center">How It Works</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-8">Shop with confidence in 4 simple steps</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {howItWorks.map((item) => (
              <div key={item.step} className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 border border-gray-100/80 dark:border-gray-700/50 text-center hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-full bg-[#5BA3D0] flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">{item.step}</div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{item.title}</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 text-center">For Buyers</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-8">Everything you need for a world-class shopping experience</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {forBuyers.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 border border-gray-100/80 dark:border-gray-700/50 hover:shadow-lg transition-all">
                  <div className={`inline-flex p-3 ${item.color} rounded-xl mb-4`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 text-center">For Sellers</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-8">Powerful tools to grow your business</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {forSellers.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 border border-gray-100/80 dark:border-gray-700/50 hover:shadow-lg transition-all group cursor-pointer">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#5BA3D0] to-[#7BB8DC] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-[#5BA3D0] transition-colors">{item.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-16">
          <div className="max-w-5xl mx-auto bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-gray-100/80 dark:border-gray-700/50">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">Popular Categories</h2>
            <div className="flex flex-wrap gap-3 justify-center">
              {categories.map((cat, i) => (
                <button key={i} onClick={() => navigate(`/products?category=${encodeURIComponent(cat)}`)}
                  className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-[#5BA3D0] hover:text-white hover:border-[#5BA3D0] transition-all duration-200">
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#5BA3D0] rounded-2xl p-8 text-white text-center max-w-4xl mx-auto">
          <ShoppingBag className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">Start Shopping or Selling Today</h2>
          <p className="text-white/90 mb-6">Join thousands of happy buyers and growing sellers on Bangladesh's fastest-growing marketplace.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button onClick={() => navigate('/products')} className="bg-white text-[#5BA3D0] hover:bg-gray-100">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Shop Now
            </Button>
            <Button onClick={() => navigate('/business-inquiry')} variant="ghost" className="text-white border border-white/30 hover:bg-white/20">
              <Store className="w-4 h-4 mr-2" />
              Become a Seller
            </Button>
            <Button onClick={() => navigate('/wholesale-hub')} variant="ghost" className="text-white border border-white/30 hover:bg-white/20">
              <Package className="w-4 h-4 mr-2" />
              Wholesale Hub
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MarketplacePage;
