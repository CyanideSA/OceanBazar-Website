import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, Database, Shield, Share2, Cookie, Bell, Trash2, ArrowLeft, CheckCircle, AlertCircle, Globe, Server, UserCheck, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: Database,
      title: 'Information We Collect',
      color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300',
      items: [
        { label: 'Personal Information', desc: 'Name, email address, phone number, shipping/billing address when you create an account or place an order.' },
        { label: 'Payment Information', desc: 'Payment method details are processed securely through our payment partners. We do not store full card numbers.' },
        { label: 'Usage Data', desc: 'Browsing history, search queries, product views, and interaction patterns to improve our services.' },
        { label: 'Device Information', desc: 'Browser type, operating system, IP address, and device identifiers for security and optimization.' },
        { label: 'Communications', desc: 'Messages sent through our support chat, dispute center, and email correspondence.' }
      ]
    },
    {
      icon: Eye,
      title: 'How We Use Your Data',
      color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300',
      items: [
        { label: 'Order Fulfillment', desc: 'Process and deliver your orders, send tracking updates, and handle returns.' },
        { label: 'Account Management', desc: 'Maintain your account, verify identity, and provide customer support.' },
        { label: 'Personalization', desc: 'Recommend products, tailor search results, and customize your shopping experience.' },
        { label: 'Security', desc: 'Detect fraud, prevent unauthorized access, and protect platform integrity.' },
        { label: 'Communication', desc: 'Send order updates, promotional offers (with consent), and important service notifications.' }
      ]
    },
    {
      icon: Share2,
      title: 'Data Sharing & Third Parties',
      color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300',
      items: [
        { label: 'Payment Processors', desc: 'bKash, Nagad, and other gateways to process your transactions securely.' },
        { label: 'Shipping Partners', desc: 'Delivery services receive necessary order and address details for shipment.' },
        { label: 'Analytics Providers', desc: 'Anonymized usage data helps us understand and improve the platform.' },
        { label: 'Legal Requirements', desc: 'We may disclose data when required by law, court order, or government request.' },
        { label: 'We Never Sell Your Data', desc: 'Your personal information is never sold, rented, or traded to third parties for marketing.' }
      ]
    },
    {
      icon: Cookie,
      title: 'Cookies & Tracking',
      color: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-300',
      items: [
        { label: 'Essential Cookies', desc: 'Required for login, cart persistence, and core platform functionality. Cannot be disabled.' },
        { label: 'Preference Cookies', desc: 'Remember your language, theme, and display preferences across sessions.' },
        { label: 'Analytics Cookies', desc: 'Help us understand how users interact with the platform to improve features.' },
        { label: 'Marketing Cookies', desc: 'Used for relevant advertising. You can opt out through your browser settings.' },
        { label: 'Managing Cookies', desc: 'You can clear or block cookies through your browser settings at any time.' }
      ]
    },
    {
      icon: Shield,
      title: 'Data Protection & Security',
      color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300',
      items: [
        { label: 'Encryption', desc: 'All data transmissions are encrypted using TLS/SSL. Stored data is encrypted at rest.' },
        { label: 'Access Controls', desc: 'Strict role-based access ensures only authorized personnel can view sensitive data.' },
        { label: 'Regular Audits', desc: 'Security practices are reviewed and audited regularly to maintain compliance.' },
        { label: 'Breach Notification', desc: 'In the event of a data breach, affected users will be notified within 72 hours.' },
        { label: 'Data Retention', desc: 'Personal data is retained only as long as necessary for service delivery and legal compliance.' }
      ]
    },
    {
      icon: UserCheck,
      title: 'Your Rights',
      color: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300',
      items: [
        { label: 'Right to Access', desc: 'Request a copy of all personal data we hold about you at any time.' },
        { label: 'Right to Correction', desc: 'Update or correct any inaccurate personal information in your account.' },
        { label: 'Right to Deletion', desc: 'Request deletion of your account and associated personal data.' },
        { label: 'Right to Portability', desc: 'Receive your data in a structured, machine-readable format upon request.' },
        { label: 'Right to Object', desc: 'Opt out of marketing communications and certain data processing activities.' }
      ]
    }
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
                <Lock className="w-8 h-8" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold">Privacy Policy</h1>
            </div>
            <p className="text-xl text-white/90">How we collect, use, protect, and respect your personal data at OceanBazar.</p>
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
                <div className="space-y-4">
                  {section.items.map((item, iIdx) => (
                    <div key={iIdx} className="flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-[#5BA3D0] mt-1 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{item.label}: </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}

        <section className="max-w-5xl mx-auto mb-10">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Children's Privacy</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  OceanBazar does not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such data, please contact us immediately and we will promptly delete it.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 bg-[#5BA3D0] rounded-2xl p-8 text-white text-center max-w-4xl mx-auto">
          <Mail className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">Privacy Concerns?</h2>
          <p className="text-white/90 mb-6">For data access requests, deletion, or any privacy questions, reach out to our Data Protection Officer.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button onClick={() => navigate('/help/customer-support')} className="bg-white text-[#5BA3D0] hover:bg-gray-100">Contact DPO</Button>
            <Button onClick={() => navigate('/terms-of-service')} variant="ghost" className="text-white border border-white/30 hover:bg-white/20">Terms of Service</Button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
