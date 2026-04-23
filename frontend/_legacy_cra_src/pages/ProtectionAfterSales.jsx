import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Award, MessageCircle, Clock, RefreshCw, CheckCircle, ArrowLeft, Phone, Mail, HeadphonesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AfterSalesProtection = () => {
  const navigate = useNavigate();

  const protectionPillars = [
    {
      icon: Award,
      title: 'Quality Guarantee',
      description: 'All products must meet our strict quality standards. Products not matching descriptions are eligible for full refunds.',
      coverage: '90 Days'
    },
    {
      icon: RefreshCw,
      title: 'Free Replacements',
      description: 'Defective products can be replaced at no additional cost within the warranty period.',
      coverage: '60 Days'
    },
    {
      icon: MessageCircle,
      title: 'Direct Support',
      description: 'Connect directly with sellers and our support team to resolve any product issues quickly.',
      coverage: '24/7 Access'
    },
    {
      icon: Shield,
      title: 'Warranty Protection',
      description: 'Extended warranty options available for electronics and machinery. Manufacturer warranties honored.',
      coverage: 'Up to 2 Years'
    }
  ];

  const warrantyTypes = [
    {
      name: 'Standard Warranty',
      period: '30 Days',
      coverage: [
        'Manufacturing defects',
        'Product malfunctions',
        'Quality issues',
        'Description mismatches'
      ],
      icon: Shield
    },
    {
      name: 'Extended Warranty',
      period: '1-2 Years',
      coverage: [
        'All standard coverage',
        'Electrical failures',
        'Component replacements',
        'Technical support',
        'Priority service'
      ],
      icon: Award
    }
  ];

  const supportChannels = [
    {
      icon: MessageCircle,
      title: 'Live Chat',
      description: 'Instant messaging with our support team',
      availability: '24/7 Available',
      response: 'Avg. 2 min response'
    },
    {
      icon: Mail,
      title: 'Email Support',
      description: 'Detailed assistance via email',
      availability: 'support@oceanbazar.com.bd',
      response: 'Within 24 hours'
    },
    {
      icon: Phone,
      title: 'Phone Support',
      description: 'Speak directly with a specialist',
      availability: 'Mon-Sat: 9 AM - 9 PM',
      response: 'Immediate'
    },
    {
      icon: HeadphonesIcon,
      title: 'Seller Direct Line',
      description: 'Connect with your seller directly',
      availability: 'Seller hours vary',
      response: 'Usually within hours'
    }
  ];

  const claimProcess = [
    {
      step: 1,
      title: 'Report Issue',
      description: 'Go to your Orders page and select "Report Issue" within the protection period.'
    },
    {
      step: 2,
      title: 'Provide Evidence',
      description: 'Upload photos, videos, or documentation showing the product defect or issue.'
    },
    {
      step: 3,
      title: 'Review Process',
      description: 'Our team reviews your claim within 24-48 hours and may contact you or the seller for more information.'
    },
    {
      step: 4,
      title: 'Resolution',
      description: 'Receive a full refund, partial refund, replacement, or repair based on the claim evaluation.'
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
                <Shield className="w-8 h-8" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold">After-Sales Protection</h1>
            </div>
            <p className="text-xl text-white/90">Comprehensive warranty coverage and support that continues long after your purchase. Your satisfaction is guaranteed.</p>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-12">
        {/* Protection Pillars */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8 text-center">Our Commitment to You</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {protectionPillars.map((pillar, index) => {
              const Icon = pillar.icon;
              return (
                <div key={index} className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 hover:shadow-lg transition-all text-center">
                  <div className="inline-flex p-3 bg-[#5BA3D0] rounded-lg mb-4">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{pillar.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{pillar.description}</p>
                  <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 text-[#5BA3D0] dark:text-[#7BB8DC] rounded-full text-xs font-semibold">
                    {pillar.coverage}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Warranty Types */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8 text-center">Warranty Coverage Options</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {warrantyTypes.map((warranty, index) => {
              const Icon = warranty.icon;
              return (
                <div key={index} className="bg-white dark:bg-gray-800/80 rounded-2xl p-8 border-2 border-gray-100 dark:border-gray-800 hover:border-[#5BA3D0] dark:hover:border-[#5BA3D0] transition-all">
                  <div className="flex items-center gap-3 mb-6">
                    <Icon className="w-8 h-8 text-[#5BA3D0]" />
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 text-xl">{warranty.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Coverage: {warranty.period}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {warranty.coverage.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Support Channels */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-3 text-center">We're Here to Help</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto">Multiple ways to get support whenever you need it. Our dedicated team is ready to assist you.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {supportChannels.map((channel, index) => {
              const Icon = channel.icon;
              return (
                <div key={index} className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 hover:shadow-lg transition-all">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-3 bg-[#5BA3D0] rounded-full mb-4">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{channel.title}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{channel.description}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">{channel.availability}</p>
                    <div className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                      {channel.response}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Claim Process */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8 text-center">How to File a Warranty Claim</h2>
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {claimProcess.map((item) => (
                <div key={item.step} className="relative">
                  <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 h-full">
                    <div className="w-12 h-12 rounded-full bg-[#5BA3D0] text-white flex items-center justify-center text-xl font-bold mb-4 mx-auto">
                      {item.step}
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">{item.title}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 text-center">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Statistics */}
        <section className="bg-white dark:bg-gray-800/80 rounded-2xl p-8 md:p-12 border border-gray-100 dark:border-gray-800 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">Our Track Record</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-[#5BA3D0] mb-2">98.5%</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Customer Satisfaction</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#5BA3D0] mb-2">&lt;24h</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg. Response Time</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#5BA3D0] mb-2">99.2%</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Claims Resolved</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#5BA3D0] mb-2">2M+</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Protected Orders</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 text-center">
          <Button onClick={() => navigate('/help/customer-support')} size="lg" className="bg-[#5BA3D0] hover:bg-[#4A90B8] text-white">
            <MessageCircle className="w-5 h-5 mr-2" />
            Contact Support Team
          </Button>
        </section>
      </div>
    </div>
  );
};

export default AfterSalesProtection;