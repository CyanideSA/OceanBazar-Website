import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Shield, Lock, CheckCircle, AlertCircle, Award, Globe, Clock, ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PaymentProtection = () => {
  const navigate = useNavigate();

  const paymentMethods = [
    { name: 'Credit/Debit Cards', icon: CreditCard, supported: ['Visa', 'Mastercard', 'American Express'] },
    { name: 'Digital Wallets', icon: Globe, supported: ['PayPal', 'Stripe', 'Local Payment'] },
    { name: 'Bank Transfer', icon: Lock, supported: ['Direct Transfer', 'Wire Transfer'] },
    { name: 'Trade Assurance', icon: Shield, supported: ['OceanBazar Protection'] }
  ];

  const securityFeatures = [
    {
      icon: Lock,
      title: 'SSL Encryption',
      description: 'All transactions are encrypted with 256-bit SSL technology, ensuring your payment information is secure.'
    },
    {
      icon: Shield,
      title: 'Fraud Detection',
      description: 'Advanced AI-powered fraud detection systems monitor every transaction 24/7 to prevent unauthorized activity.'
    },
    {
      icon: Award,
      title: 'PCI DSS Compliant',
      description: 'We maintain the highest level of payment card industry data security standards (PCI DSS Level 1).'
    },
    {
      icon: CheckCircle,
      title: 'Verified Sellers',
      description: 'All sellers undergo strict verification processes to ensure legitimacy and business authenticity.'
    }
  ];

  const protectionSteps = [
    {
      step: 1,
      title: 'Place Your Order',
      description: 'Complete your purchase using any of our secure payment methods. Your payment is held securely.'
    },
    {
      step: 2,
      title: 'Seller Ships Product',
      description: 'The seller prepares and ships your order. Payment is still held by OceanBazar for your protection.'
    },
    {
      step: 3,
      title: 'Inspect Your Order',
      description: 'Receive and inspect your products. You have a protection period to report any issues.'
    },
    {
      step: 4,
      title: 'Payment Released',
      description: 'Once you confirm satisfaction, or the protection period ends, payment is released to the seller.'
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
                <CreditCard className="w-8 h-8" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold">Safe & Easy Payments</h1>
            </div>
            <p className="text-xl text-white/90">Your financial security is our top priority. Shop with confidence knowing every transaction is protected.</p>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-12">
        {/* Payment Methods */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8 text-center">Accepted Payment Methods</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {paymentMethods.map((method, index) => {
              const Icon = method.icon;
              return (
                <div key={index} className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 hover:shadow-lg transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-[#5BA3D0] rounded-lg">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">{method.name}</h3>
                  </div>
                  <div className="space-y-1">
                    {method.supported.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-3 text-center">How Payment Protection Works</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto">Our escrow-based payment system ensures your money is safe until you receive and approve your order.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {protectionSteps.map((item) => (
              <div key={item.step} className="relative">
                <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 h-full">
                  <div className="w-12 h-12 rounded-full bg-[#5BA3D0] text-white flex items-center justify-center text-xl font-bold mb-4">
                    {item.step}
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                </div>
                {item.step < 4 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                    <div className="w-6 h-6 rounded-full bg-[#5BA3D0] flex items-center justify-center">
                      <ChevronRight className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Security Features */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-10 text-center">Advanced Security Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {securityFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-[#5BA3D0] rounded-lg flex-shrink-0">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{feature.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{feature.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Guarantee Banner */}
        <section className="bg-[#5BA3D0] rounded-2xl p-8 md:p-12 text-white text-center max-w-4xl mx-auto">
          <Shield className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-4">100% Payment Protection Guarantee</h2>
          <p className="text-lg mb-6 text-white/90">If your order doesn't arrive, arrives damaged, or doesn't match the description, we'll refund your payment in full. No questions asked.</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>Money-back guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span>24/7 support</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span>Dispute resolution</span>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <details className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 group">
              <summary className="font-semibold text-gray-800 dark:text-gray-100 cursor-pointer list-none flex items-center justify-between">
                When is payment released to the seller?
                <ChevronRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="text-gray-600 dark:text-gray-400 mt-4 text-sm">Payment is released to the seller after you confirm receipt and satisfaction with your order, or automatically after the buyer protection period expires without disputes.</p>
            </details>
            
            <details className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 group">
              <summary className="font-semibold text-gray-800 dark:text-gray-100 cursor-pointer list-none flex items-center justify-between">
                What if I don't receive my order?
                <ChevronRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="text-gray-600 dark:text-gray-400 mt-4 text-sm">If your order doesn't arrive by the estimated delivery date, you can open a dispute and receive a full refund. We'll hold the seller accountable and investigate the issue.</p>
            </details>
            
            <details className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 group">
              <summary className="font-semibold text-gray-800 dark:text-gray-100 cursor-pointer list-none flex items-center justify-between">
                Are international payments protected?
                <ChevronRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="text-gray-600 dark:text-gray-400 mt-4 text-sm">Yes! All international transactions are protected under the same guarantee as domestic orders, with support for multiple currencies and international payment methods.</p>
            </details>
            
            <details className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 group">
              <summary className="font-semibold text-gray-800 dark:text-gray-100 cursor-pointer list-none flex items-center justify-between">
                How do I dispute a payment?
                <ChevronRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="text-gray-600 dark:text-gray-400 mt-4 text-sm">Navigate to your Orders page, select the order in question, and click "Open Dispute". Our resolution team will review your case within 24 hours and guide you through the process.</p>
            </details>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PaymentProtection;