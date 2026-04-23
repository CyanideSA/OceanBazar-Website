import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Globe, Target, Heart, Zap, Award, TrendingUp, Shield, Package, Truck, Star, ArrowLeft, CheckCircle, MapPin, Building2, Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WhoWeArePage = () => {
  const navigate = useNavigate();

  const values = [
    { icon: Heart, title: 'Customer First', description: 'Every decision we make starts with the customer. Your satisfaction drives our innovation.', color: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300' },
    { icon: Shield, title: 'Trust & Transparency', description: 'Honest pricing, verified sellers, and clear policies. No hidden fees, ever.', color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300' },
    { icon: Zap, title: 'Innovation', description: 'Constantly improving our platform with cutting-edge technology and features.', color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300' },
    { icon: Globe, title: 'Global Reach', description: 'Connecting local businesses with international markets and opportunities.', color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300' },
    { icon: Handshake, title: 'Fair Partnership', description: 'We grow when our sellers and buyers grow. Success is a shared journey.', color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300' },
    { icon: Award, title: 'Quality Assurance', description: 'Rigorous seller verification and product quality standards you can depend on.', color: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-300' }
  ];

  const stats = [
    { label: 'Products Listed', value: '50,000+', icon: Package },
    { label: 'Verified Sellers', value: '2,500+', icon: CheckCircle },
    { label: 'Orders Delivered', value: '100,000+', icon: Truck },
    { label: 'Customer Rating', value: '4.8/5', icon: Star }
  ];

  const milestones = [
    { year: '2023', title: 'OceanBazar Founded', description: 'Launched as a B2B marketplace connecting Bangladeshi manufacturers to global buyers.' },
    { year: '2024', title: 'Retail Expansion', description: 'Opened the platform to retail customers, introducing wholesale-quality products at competitive prices.' },
    { year: '2025', title: 'Marketplace Growth', description: 'Crossed 2,500 verified sellers and 50,000 product listings across 40+ categories.' },
    { year: '2026', title: 'Global Trade Platform', description: 'Expanding international shipping, multi-currency support, and enterprise-grade seller tools.' }
  ];

  const teamHighlights = [
    { icon: Building2, title: 'Headquarters', description: 'Dhaka, Bangladesh with remote team members across South Asia.' },
    { icon: Users, title: 'Team Size', description: 'Growing team of engineers, designers, operations, and customer success specialists.' },
    { icon: MapPin, title: 'Serving', description: 'Customers in Bangladesh and expanding to international markets worldwide.' },
    { icon: Target, title: 'Mission', description: 'Democratize commerce by making wholesale trade accessible to everyone.' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="bg-gradient-to-r from-[#5BA3D0] to-[#3a7fb5] text-white py-20">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8">
          <Button onClick={() => navigate('/')} variant="ghost" className="text-white hover:bg-white/20 mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <Globe className="w-8 h-8" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold">Who We Are</h1>
            </div>
            <p className="text-xl text-white/90">Building Bangladesh's most trusted ecommerce marketplace — where quality meets opportunity.</p>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-12">
        <section className="mb-16">
          <div className="max-w-4xl mx-auto text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Our Story</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              OceanBazar was born from a simple idea: why should small businesses pay retail prices for products they buy in bulk?
              We started as a B2B platform connecting Bangladeshi manufacturers directly with buyers, eliminating middlemen and unfair markups.
              Today, we serve both wholesale and retail customers with a curated marketplace of verified sellers,
              transparent pricing, and world-class buyer protection. Our mission is to democratize commerce and empower
              every entrepreneur, shop owner, and consumer to access quality products at fair prices.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 border border-gray-100/80 dark:border-gray-700/50 text-center hover:shadow-md transition-shadow">
                  <Icon className="w-8 h-8 text-[#5BA3D0] mx-auto mb-3" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {values.map((value, i) => {
              const Icon = value.icon;
              return (
                <div key={i} className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 border border-gray-100/80 dark:border-gray-700/50 hover:shadow-lg transition-all">
                  <div className={`inline-flex p-3 ${value.color} rounded-xl mb-4`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{value.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{value.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">Our Journey</h2>
          <div className="max-w-4xl mx-auto">
            <div className="space-y-6">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-20 h-20 rounded-xl bg-[#5BA3D0] flex items-center justify-center">
                    <span className="text-white font-bold text-lg">{m.year}</span>
                  </div>
                  <div className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl p-5 border border-gray-100/80 dark:border-gray-700/50 flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">{m.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{m.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">Our Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {teamHighlights.map((t, i) => {
              const Icon = t.icon;
              return (
                <div key={i} className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 border border-gray-100/80 dark:border-gray-700/50 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#5BA3D0] flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1 text-sm">{t.title}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-[#5BA3D0] rounded-2xl p-8 text-white text-center max-w-4xl mx-auto">
          <TrendingUp className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">Join the OceanBazar Community</h2>
          <p className="text-white/90 mb-6">Whether you're a buyer seeking quality products or a seller looking to grow — we're here for you.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button onClick={() => navigate('/products')} className="bg-white text-[#5BA3D0] hover:bg-gray-100">Browse Products</Button>
            <Button onClick={() => navigate('/wholesale-hub')} variant="ghost" className="text-white border border-white/30 hover:bg-white/20">Wholesale Hub</Button>
            <Button onClick={() => navigate('/business-inquiry')} variant="ghost" className="text-white border border-white/30 hover:bg-white/20">Become a Seller</Button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default WhoWeArePage;
