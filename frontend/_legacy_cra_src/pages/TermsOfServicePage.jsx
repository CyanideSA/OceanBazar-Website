import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Shield, CreditCard, Truck, RotateCcw, AlertCircle, Ban, Scale, Clock, CheckCircle, ArrowLeft, Users, DollarSign, Package, XCircle, Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TermsOfServicePage = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: Users,
      title: 'Account & Registration',
      color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300',
      items: [
        'Users must be at least 18 years of age or have parental consent to register.',
        'You are responsible for maintaining the confidentiality of your account credentials.',
        'One account per individual or business entity. Duplicate accounts may be suspended.',
        'Account information must be accurate and up to date at all times.',
        'OceanBazar reserves the right to suspend or terminate accounts that violate these terms.'
      ]
    },
    {
      icon: Shield,
      title: 'Customer Rights & Protections',
      color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300',
      items: [
        'Every order is backed by OceanBazar Buyer Protection from checkout to delivery.',
        'You have the right to receive products that match their listed descriptions.',
        'Full refund if an order is not received within the guaranteed delivery window.',
        'Right to dispute and escalate issues through our resolution center at any time.',
        'Personal data is protected under our Privacy Policy and never sold to third parties.'
      ]
    },
    {
      icon: CreditCard,
      title: 'Payment Terms',
      color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300',
      items: [
        'All prices are displayed in BDT (Bangladeshi Taka) unless otherwise stated.',
        'Payment is processed at the time of order placement through verified payment gateways.',
        'OceanBazar does not store full credit/debit card details on our servers.',
        'Transactions may be subject to verification for fraud prevention purposes.',
        'Currency conversion fees, if applicable, are the responsibility of the buyer.'
      ]
    },
    {
      icon: Truck,
      title: 'Shipping & Delivery',
      color: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-300',
      items: [
        'Standard domestic delivery: 3-7 business days within Bangladesh.',
        'Express delivery: 1-3 business days where available.',
        'International shipping: 7-21 business days depending on destination.',
        'Shipping costs are calculated at checkout based on weight, dimensions, and destination.',
        'Tracking information is provided for all shipments via email and account dashboard.'
      ]
    },
    {
      icon: RotateCcw,
      title: 'Refund & Cancellation Policy',
      color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300',
      items: [
        'Orders can be cancelled within 2 hours of placement for a full refund.',
        'After dispatch, cancellation is subject to return shipping costs.',
        'Refunds for returned items are processed within 5-7 business days.',
        'Refunds are issued to the original payment method used during checkout.',
        'Non-returnable items include perishables, custom orders, and digital products.'
      ]
    },
    {
      icon: DollarSign,
      title: 'Pricing & Wholesale Rules',
      color: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300',
      items: [
        'Retail prices are visible to all users. Wholesale prices require approved wholesale status.',
        'Quantity-based discounts are applied automatically at checkout based on tier brackets.',
        'OceanBazar reserves the right to correct pricing errors before order confirmation.',
        'Wholesale buyers must meet minimum order quantities (MOQ) as listed per product.',
        'Promotional pricing is time-limited and may not be combined with other discounts unless stated.'
      ]
    },
    {
      icon: Ban,
      title: 'Prohibited Activities',
      color: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300',
      items: [
        'Using the platform for fraudulent transactions, money laundering, or illegal activities.',
        'Posting fake reviews, manipulating ratings, or misleading product information.',
        'Reselling products purchased through exploited pricing errors or system bugs.',
        'Scraping, data mining, or automated collection of platform content without authorization.',
        'Harassment, abuse, or threatening behavior towards other users, sellers, or support staff.'
      ]
    },
    {
      icon: Scale,
      title: 'Dispute Resolution',
      color: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-300',
      items: [
        'Disputes should first be raised through the OceanBazar Resolution Center.',
        'Our mediation team will review evidence from both buyer and seller within 48 hours.',
        'If mediation fails, disputes may be escalated to binding arbitration under Bangladeshi law.',
        'OceanBazar\'s decision in platform-level disputes is final and binding.',
        'Users retain the right to seek legal remedies in courts of competent jurisdiction.'
      ]
    }
  ];

  const deliveryTimeframes = [
    { region: 'Dhaka Metro', standard: '2-4 days', express: 'Same / Next day' },
    { region: 'Major Cities', standard: '3-5 days', express: '1-2 days' },
    { region: 'Rest of Bangladesh', standard: '5-7 days', express: '2-3 days' },
    { region: 'International', standard: '10-21 days', express: '5-10 days' }
  ];

  const fees = [
    { item: 'Standard Shipping', description: 'Based on weight and destination', amount: 'From ৳25' },
    { item: 'Express Shipping', description: 'Priority handling and delivery', amount: 'From ৳80' },
    { item: 'Platform Fee', description: 'Included in listed prices', amount: '0%' },
    { item: 'Payment Processing', description: 'Handled by payment gateway', amount: 'Included' },
    { item: 'Return Shipping (Seller Fault)', description: 'Wrong/damaged/defective items', amount: 'Free' },
    { item: 'Return Shipping (Buyer Change)', description: 'Change of mind returns', amount: 'Buyer pays' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="bg-[#5BA3D0] text-white py-16">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8">
          <Button onClick={() => navigate('/')} variant="ghost" className="text-white hover:bg-white/20 mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <FileText className="w-8 h-8" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold">Terms of Service</h1>
            </div>
            <p className="text-xl text-white/90">The rules, rights, and responsibilities that govern your experience on OceanBazar.</p>
            <p className="text-sm text-white/60 mt-3">Last updated: March 2026</p>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-12">
        {sections.map((section, sIdx) => {
          const Icon = section.icon;
          return (
            <section key={sIdx} className="mb-10">
              <div className="max-w-5xl mx-auto bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-gray-100/80 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-5">
                  <div className={`inline-flex p-3 ${section.color} rounded-xl`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{section.title}</h2>
                </div>
                <ul className="space-y-3">
                  {section.items.map((item, iIdx) => (
                    <li key={iIdx} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircle className="w-4 h-4 text-[#5BA3D0] mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
        })}

        <section className="mb-10">
          <div className="max-w-5xl mx-auto bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-gray-100/80 dark:border-gray-700/50 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="inline-flex p-3 bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Delivery Timeframes</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-3 font-semibold text-gray-700 dark:text-gray-300">Region</th>
                    <th className="text-left py-3 font-semibold text-gray-700 dark:text-gray-300">Standard</th>
                    <th className="text-left py-3 font-semibold text-gray-700 dark:text-gray-300">Express</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryTimeframes.map((row, i) => (
                    <tr key={i} className="border-b dark:border-gray-700/50 last:border-b-0">
                      <td className="py-3 font-medium text-gray-800 dark:text-gray-200">{row.region}</td>
                      <td className="py-3 text-gray-600 dark:text-gray-400">{row.standard}</td>
                      <td className="py-3 text-emerald-600 dark:text-emerald-400 font-medium">{row.express}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <div className="max-w-5xl mx-auto bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-gray-100/80 dark:border-gray-700/50 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="inline-flex p-3 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Fees & Charges</h2>
            </div>
            <div className="space-y-3">
              {fees.map((fee, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b dark:border-gray-700/50 last:border-b-0">
                  <div>
                    <div className="font-medium text-gray-800 dark:text-gray-200 text-sm">{fee.item}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{fee.description}</div>
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{fee.amount}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Acceptance of Terms</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  By creating an account, browsing, or purchasing on OceanBazar, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service and our Privacy Policy. OceanBazar reserves the right to update these terms at any time. Continued use of the platform after changes constitutes acceptance of the revised terms.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 bg-[#5BA3D0] rounded-2xl p-8 text-white text-center max-w-4xl mx-auto">
          <Gavel className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">Questions About Our Terms?</h2>
          <p className="text-white/90 mb-6">Our support team is happy to help clarify any questions about our policies.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button onClick={() => navigate('/help/customer-support')} className="bg-white text-[#5BA3D0] hover:bg-gray-100">Contact Support</Button>
            <Button onClick={() => navigate('/protections')} variant="ghost" className="text-white border border-white/30 hover:bg-white/20">View Protections</Button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
