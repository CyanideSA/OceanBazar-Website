import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, DollarSign, Clock, CheckCircle, XCircle, AlertCircle, ArrowLeft, FileText, Camera, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

const RefundProtection = () => {
  const navigate = useNavigate();

  const refundReasons = [
    {
      icon: XCircle,
      title: 'Product Not Received',
      description: 'Full refund if your order never arrives',
      eligibility: '100% refund',
      color: 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300'
    },
    {
      icon: AlertCircle,
      title: 'Wrong Product Received',
      description: 'Item doesn\'t match order description',
      eligibility: '100% refund + return shipping',
      color: 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300'
    },
    {
      icon: AlertCircle,
      title: 'Damaged Product',
      description: 'Product arrived damaged or defective',
      eligibility: '100% refund or replacement',
      color: 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300'
    },
    {
      icon: CheckCircle,
      title: 'Quality Not as Described',
      description: 'Product quality below expectations',
      eligibility: 'Full or partial refund',
      color: 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
    },
    {
      icon: RotateCcw,
      title: 'Changed Mind',
      description: 'Return unused items within 7 days',
      eligibility: 'Refund minus return shipping',
      color: 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300'
    },
    {
      icon: Clock,
      title: 'Late Delivery',
      description: 'Order arrives significantly late',
      eligibility: 'Partial refund or full refund',
      color: 'bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-300'
    }
  ];

  const refundTimeline = [
    { time: '0-7 Days', action: 'Return Window', description: 'Request return for most products (unused, original packaging)' },
    { time: '7-30 Days', action: 'Quality Issues', description: 'Report defects or quality issues with evidence' },
    { time: '30-90 Days', action: 'Warranty Claims', description: 'Manufacturing defects covered under warranty' },
    { time: 'After 90 Days', action: 'Extended Warranty', description: 'Products with extended warranty coverage eligible' }
  ];

  const howToReturn = [
    {
      step: 1,
      icon: FileText,
      title: 'Initiate Return Request',
      description: 'Log in to your account, go to Orders, and click "Request Return" on the eligible order. Select your reason for return.'
    },
    {
      step: 2,
      icon: Camera,
      title: 'Upload Evidence',
      description: 'For damaged or wrong items, upload clear photos or videos. This helps expedite your refund approval process.'
    },
    {
      step: 3,
      icon: RotateCcw,
      title: 'Ship Product Back',
      description: 'Pack the item securely in original packaging if possible. Use the provided return label or ship to the given address.'
    },
    {
      step: 4,
      icon: DollarSign,
      title: 'Receive Refund',
      description: 'Once the seller receives and inspects the return, your refund will be processed within 5-7 business days to your original payment method.'
    }
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
                <RotateCcw className="w-8 h-8" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold">Refund & Return Policy</h1>
            </div>
            <p className="text-xl text-white/90">Hassle-free returns and fast refunds. Not satisfied? We'll make it right with our flexible return policy.</p>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-12">
        {/* Refund Reasons */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8 text-center">What's Covered for Refunds?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {refundReasons.map((reason, index) => {
              const Icon = reason.icon;
              return (
                <div key={index} className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 hover:shadow-lg transition-all">
                  <div className={`inline-flex p-3 ${reason.color} rounded-lg mb-4`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{reason.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{reason.description}</p>
                  <div className="inline-block px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-xs font-semibold">
                    {reason.eligibility}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Timeline */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8 text-center">Refund Eligibility Timeline</h2>
          <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800/80 rounded-2xl p-8 border border-gray-100 dark:border-gray-800">
            <div className="space-y-4">
              {refundTimeline.map((item, index) => (
                <div key={index} className="flex items-start gap-4 pb-4 last:pb-0 border-b last:border-b-0 border-gray-200 dark:border-gray-700">
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 rounded-lg bg-[#5BA3D0] flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-xs text-white/80 font-medium">{item.time}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 pt-2">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">{item.action}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Return Process */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8 text-center">Step-by-Step Return Process</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {howToReturn.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#5BA3D0] flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-sm font-semibold text-[#5BA3D0] mb-2">Step {item.step}</div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{item.title}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{item.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Important Notes */}
        <section className="max-w-4xl mx-auto">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Important Return Guidelines</h3>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>• Products must be returned in original condition with tags/packaging intact (except for damaged items)</li>
                  <li>• Customized or personalized products are non-returnable unless defective</li>
                  <li>• Perishable goods, intimate items, and digital products cannot be returned</li>
                  <li>• Return shipping costs are covered by OceanBazar for wrong, damaged, or defective items</li>
                  <li>• Refunds are processed to the original payment method within 5-7 business days after receipt</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="mt-16 bg-[#5BA3D0] rounded-2xl p-8 text-white text-center max-w-4xl mx-auto">
          <DollarSign className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">Quick & Easy Refunds</h2>
          <p className="text-white/90 mb-6">Most refund requests are processed within 24 hours. Money back in your account within a week.</p>
          <Button onClick={() => navigate('/account/orders')} className="bg-white text-[#5BA3D0] hover:bg-gray-100">
            View My Orders
          </Button>
        </section>
      </div>
    </div>
  );
};

export default RefundProtection;