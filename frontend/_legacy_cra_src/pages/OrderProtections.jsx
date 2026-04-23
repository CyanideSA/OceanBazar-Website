import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, CreditCard, Truck, CheckCircle, RotateCcw, ChevronRight } from 'lucide-react';

const OrderProtections = () => {
  const navigate = useNavigate();
  
  const protections = [
    {
      id: 1,
      title: 'Safe & Easy Payments',
      description: 'Secure payment processing with buyer protection',
      icon: CreditCard,
      path: '/protections/payments',
      color: 'from-[#5BA3D0] to-[#7BB8DC]'
    },
    {
      id: 2,
      title: 'Shipping & Logistics',
      description: 'Reliable shipping with tracking and insurance',
      icon: Truck,
      path: '/protections/shipping',
      color: 'from-[#7BB8DC] to-[#5BA3D0]'
    },
    {
      id: 3,
      title: 'After Sales Protection',
      description: 'Warranty and quality assurance for your orders',
      icon: Shield,
      path: '/protections/after-sales',
      color: 'from-[#5BA3D0] to-[#7BB8DC]'
    },
    {
      id: 4,
      title: 'Refund & Return Policy',
      description: 'Easy returns and fast refund processing',
      icon: RotateCcw,
      path: '/protections/refunds',
      color: 'from-[#7BB8DC] to-[#5BA3D0]'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-4">Order Protections</h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Your security is our priority</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-12">
          {protections.map((protection) => {
            const Icon = protection.icon;
            return (
              <div
                key={protection.id}
                onClick={() => navigate(protection.path)}
                className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-soft hover:shadow-xl transition-all duration-300 p-8 cursor-pointer group border border-gray-100 dark:border-gray-800"
              >
                <div className={`w-16 h-16 rounded-lg bg-gradient-to-r ${protection.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-[#5BA3D0]">{protection.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{protection.description}</p>
                <div className="flex items-center text-[#5BA3D0] font-medium">
                  Learn More
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="max-w-4xl mx-auto bg-[#5BA3D0] rounded-2xl p-8 text-white text-center">
          <Shield className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">100% Buyer Protection</h2>
          <p className="mb-4">Every order on OceanBazar.com.bd is protected by our comprehensive buyer protection program</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
              <CheckCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-semibold">Secure Payments</p>
            </div>
            <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
              <CheckCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-semibold">Quality Guarantee</p>
            </div>
            <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
              <CheckCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-semibold">Easy Returns</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderProtections;