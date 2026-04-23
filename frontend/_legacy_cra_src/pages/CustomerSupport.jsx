import React, { useState } from 'react';
import { Search, ChevronDown, MessageCircle, Phone, Mail } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useSiteSettings } from '@/context/SiteSettingsContext';

const CustomerSupport = () => {
  const [openFaq, setOpenFaq] = useState(null);
  const { supportEmail, supportPhone } = useSiteSettings();
  const telHref = supportPhone ? `tel:${String(supportPhone).replace(/\s/g, '')}` : '#';
  const mailHref = supportEmail ? `mailto:${supportEmail}` : '#';

  const faqs = [
    {
      category: 'Orders & Shipping',
      questions: [
        { q: 'How do I track my order?', a: 'Go to "My Account" > "Orders" and click on your order. You\'ll see real-time updates and tracking number once shipped.' },
        { q: 'What are the shipping costs?', a: 'Retail: Calculated at checkout. Wholesale: 700-1000 BDT per kg, paid after order preparation.' },
        { q: 'How long does delivery take?', a: '3-7 business days within Bangladesh. International: 10-21 days. Express shipping available.' }
      ]
    },
    {
      category: 'Payments',
      questions: [
        { q: 'What payment methods do you accept?', a: 'bKash, Nagad, Rocket, Visa, MasterCard, and bank transfers. All secured with SSL encryption.' },
        { q: 'Is my payment secure?', a: 'Yes! We use industry-standard SSL encryption and PCI DSS compliant processors.' },
        { q: 'Cash on delivery available?', a: 'Yes, for retail orders within Dhaka (50 BDT fee). Not available for wholesale.' }
      ]
    },
    {
      category: 'Returns & Refunds',
      questions: [
        { q: 'What is your return policy?', a: '7-day return for retail, 14-day for wholesale. Items must be unused in original packaging.' },
        { q: 'How to request refund?', a: 'Go to "My Account" > "Orders" > "Return/Refund". Reviewed within 24-48 hours, processed in 7-10 days.' },
        { q: 'Can I exchange products?', a: 'Yes! Contact support within 7 days for defective/wrong items. Free pickup and delivery for exchanges.' }
      ]
    },
    {
      category: 'Wholesale',
      questions: [
        { q: 'How to become wholesale customer?', a: 'Visit "Wholesale Hub" and fill application form. Review takes 2-3 business days.' },
        { q: 'Minimum order quantities?', a: 'Generally 100+ units per product with tiered pricing. Specific MOQs on product pages.' },
        { q: 'Wholesale pricing benefits?', a: 'Volume discounts up to 70% off retail prices. More you order, better the price!' }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-4">Customer Support</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Find answers or contact our support team</p>

          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input placeholder="Search for answers..." className="pl-12 h-12 md:h-14 border-[#B8D4E8] dark:border-gray-700 focus:border-[#5BA3D0]" />
          </div>

          <div className="space-y-6 mb-12">
            {faqs.map((category, catIndex) => (
              <div key={catIndex} className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-soft p-4 md:p-6 border border-gray-100 dark:border-gray-800">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">{category.category}</h2>
                <div className="space-y-3">
                  {category.questions.map((faq, qIndex) => {
                    const isOpen = openFaq === `${catIndex}-${qIndex}`;
                    return (
                      <div key={qIndex} className="border border-gray-100 dark:border-gray-800 rounded-lg">
                        <button onClick={() => setOpenFaq(isOpen ? null : `${catIndex}-${qIndex}`)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <span className="font-semibold text-gray-900 dark:text-gray-100 text-left text-sm md:text-base">{faq.q}</span>
                          <ChevronDown className={`w-5 h-5 text-[#5BA3D0] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && <div className="p-4 pt-0 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 text-sm md:text-base">{faq.a}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#5BA3D0] rounded-2xl p-6 md:p-8 text-white">
            <h2 className="text-xl md:text-2xl font-bold mb-4 text-white">Still need help?</h2>
            <p className="mb-6">Our support team is here to assist you</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button className="bg-white text-[#5BA3D0] hover:bg-gray-100 h-12">
                <MessageCircle className="w-4 h-4 mr-2" />Live Chat
              </Button>
              <a href={telHref} aria-disabled={!supportPhone} onClick={(e) => !supportPhone && e.preventDefault()}>
                <Button className="bg-white text-[#5BA3D0] hover:bg-gray-100 h-12 w-full"><Phone className="w-4 h-4 mr-2" />Call Us</Button>
              </a>
              <a href={mailHref} aria-disabled={!supportEmail} onClick={(e) => !supportEmail && e.preventDefault()}>
                <Button className="bg-white text-[#5BA3D0] hover:bg-gray-100 h-12 w-full"><Mail className="w-4 h-4 mr-2" />Email</Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-20 right-6 z-40 hidden md:block">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-300 shadow">
          Use the floating chat icon to start a live support conversation.
        </div>
      </div>
    </div>
  );
};

export default CustomerSupport;