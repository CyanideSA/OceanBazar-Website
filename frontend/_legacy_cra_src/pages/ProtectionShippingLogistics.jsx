import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Package, MapPin, Clock, Shield, CheckCircle, AlertTriangle, Globe, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ShippingProtection = () => {
  const navigate = useNavigate();

  const shippingFeatures = [
    {
      icon: Globe,
      title: 'Worldwide Shipping',
      description: 'We ship to over 200 countries and regions with reliable logistics partners.',
      stats: '200+ Countries'
    },
    {
      icon: Clock,
      title: 'Fast Delivery',
      description: 'Express shipping options available with delivery times as fast as 3-7 business days.',
      stats: '3-7 Days Express'
    },
    {
      icon: Search,
      title: 'Real-time Tracking',
      description: 'Track your shipment every step of the way with real-time GPS tracking updates.',
      stats: '24/7 Tracking'
    },
    {
      icon: Shield,
      title: 'Shipping Insurance',
      description: 'All shipments are insured against loss, damage, or delays at no extra cost to you.',
      stats: '100% Insured'
    }
  ];

  const shippingOptions = [
    {
      name: 'Standard Shipping',
      time: '15-30 business days',
      cost: 'Free on orders over $100',
      icon: Package,
      features: ['Tracking included', 'Insurance included', 'Signature not required']
    },
    {
      name: 'Express Shipping',
      time: '7-15 business days',
      cost: 'Starting at $15',
      icon: Truck,
      features: ['Priority handling', 'Enhanced tracking', 'Insurance up to $500']
    },
    {
      name: 'Premium Express',
      time: '3-7 business days',
      cost: 'Starting at $35',
      icon: Truck,
      features: ['Fastest delivery', 'Full insurance', 'Signature required', 'Priority support']
    }
  ];

  const trackingSteps = [
    { status: 'Order Confirmed', description: 'Your order has been received and is being prepared' },
    { status: 'Processing', description: 'Seller is preparing your items for shipment' },
    { status: 'Shipped', description: 'Your order is on its way to you' },
    { status: 'In Transit', description: 'Package is moving through our logistics network' },
    { status: 'Out for Delivery', description: 'Package is with local courier for final delivery' },
    { status: 'Delivered', description: 'Package has been successfully delivered' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      {/* Hero Section */}
      <div className="bg-[#5BA3D0] text-white py-16">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8">
          <Button 
            onClick={() => navigate('/protections')}
            variant="ghost"
            className="text-white hover:bg-white/20 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Protections
          </Button>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <Truck className="w-8 h-8" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold">Shipping & Logistics Protection</h1>
            </div>
            <p className="text-xl text-white/90">Reliable, trackable, and insured shipping to your doorstep. We ensure your products arrive safely and on time.</p>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-12">
        {/* Key Features */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8 text-center">Shipping Protection Benefits</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {shippingFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 text-center hover:shadow-lg transition-all">
                  <div className="inline-flex p-3 bg-[#5BA3D0] rounded-lg mb-4">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{feature.description}</p>
                  <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 text-[#5BA3D0] dark:text-[#7BB8DC] rounded-full text-xs font-semibold">
                    {feature.stats}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Shipping Options */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8 text-center">Choose Your Shipping Speed</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {shippingOptions.map((option, index) => {
              const Icon = option.icon;
              return (
                <div key={index} className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border-2 border-gray-100 dark:border-gray-800 hover:border-[#5BA3D0] dark:hover:border-[#5BA3D0] transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <Icon className="w-8 h-8 text-[#5BA3D0]" />
                    <h3 className="font-bold text-gray-900 dark:text-gray-100">{option.name}</h3>
                  </div>
                  <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="text-2xl font-bold text-[#5BA3D0] mb-1">{option.time}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{option.cost}</div>
                  </div>
                  <div className="space-y-2">
                    {option.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Tracking Timeline */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8 text-center">Track Your Order Every Step</h2>
          <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800/80 rounded-2xl p-8 border border-gray-100 dark:border-gray-800">
            <div className="relative">
              {trackingSteps.map((step, index) => (
                <div key={index} className="flex gap-4 mb-6 last:mb-0">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-[#5BA3D0] flex items-center justify-center flex-shrink-0">
                      {index === trackingSteps.length - 1 ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    {index < trackingSteps.length - 1 && (
                      <div className="w-0.5 h-12 bg-[#5BA3D0]" />
                    )}
                  </div>
                  <div className="flex-1 pb-6">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{step.status}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Protection Coverage */}
        <section className="bg-white dark:bg-gray-800/80 rounded-2xl p-8 md:p-12 border border-gray-100 dark:border-gray-800 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">What's Covered by Shipping Protection?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-green-600 dark:text-green-400 mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Covered Issues
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Lost or missing packages
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Damaged items during transit
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Significant shipping delays (over 10 days past estimate)
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Incorrect shipping address (if corrected within 24 hours)
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Customs clearance issues (we assist with documentation)
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Exclusions
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  Incorrect address provided by buyer
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  Refused delivery by recipient
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  Acts of nature or force majeure events
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  Prohibited or restricted items
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Logistics Partners */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8 text-center">Trusted Logistics Partners</h2>
          <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-8 border border-gray-100 dark:border-gray-800 max-w-4xl mx-auto">
            <p className="text-center text-gray-600 dark:text-gray-400 mb-6">We partner with leading global logistics providers to ensure reliable delivery:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {['DHL Express', 'FedEx', 'UPS', 'China Post', 'EMS', 'Aramex', 'SF Express', 'Local Couriers'].map((carrier, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <p className="font-medium text-gray-700 dark:text-gray-300 text-sm">{carrier}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8 text-center">Shipping FAQs</h2>
          <div className="space-y-4">
            <details className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 group">
              <summary className="font-semibold text-gray-900 dark:text-gray-100 cursor-pointer list-none flex items-center justify-between">
                How do I track my order?
                <Search className="w-5 h-5 text-gray-400" />
              </summary>
              <p className="text-gray-600 dark:text-gray-400 mt-4 text-sm">Once your order ships, you'll receive a tracking number via email. Visit your Orders page and click on the order to see real-time tracking updates. You can also track directly on the carrier's website.</p>
            </details>
            
            <details className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 group">
              <summary className="font-semibold text-gray-900 dark:text-gray-100 cursor-pointer list-none flex items-center justify-between">
                What if my package is delayed?
                <Clock className="w-5 h-5 text-gray-400" />
              </summary>
              <p className="text-gray-600 dark:text-gray-400 mt-4 text-sm">If your package is delayed beyond the estimated delivery date by more than 5 business days, contact our support team. We'll investigate with the carrier and, if necessary, arrange a full refund or replacement shipment.</p>
            </details>
            
            <details className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 group">
              <summary className="font-semibold text-gray-900 dark:text-gray-100 cursor-pointer list-none flex items-center justify-between">
                What if my package arrives damaged?
                <Package className="w-5 h-5 text-gray-400" />
              </summary>
              <p className="text-gray-600 dark:text-gray-400 mt-4 text-sm">Take photos of the damaged packaging and items immediately. Report the damage within 48 hours through your Orders page. We'll process a full refund or send a replacement at no additional cost.</p>
            </details>
            
            <details className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 group">
              <summary className="font-semibold text-gray-900 dark:text-gray-100 cursor-pointer list-none flex items-center justify-between">
                Do you ship to my country?
                <MapPin className="w-5 h-5 text-gray-400" />
              </summary>
              <p className="text-gray-600 dark:text-gray-400 mt-4 text-sm">We ship to over 200 countries worldwide. Enter your address at checkout to see available shipping options and delivery estimates for your location. Customs duties may apply based on your country's regulations.</p>
            </details>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="mt-16 bg-[#5BA3D0] rounded-2xl p-8 text-white text-center max-w-4xl mx-auto">
          <Shield className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">Protected Shipping on Every Order</h2>
          <p className="text-white/90 mb-6">Start shopping with confidence knowing your shipment is fully insured and trackable from warehouse to your doorstep.</p>
          <Button onClick={() => navigate('/products')} className="bg-white text-[#5BA3D0] hover:bg-gray-100">
            Start Shopping
          </Button>
        </section>
      </div>
    </div>
  );
};

export default ShippingProtection;