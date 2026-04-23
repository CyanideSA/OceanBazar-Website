import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, AlertCircle, FileText, ChevronRight, Phone, Mail, Clock } from 'lucide-react';

const HelpCenter = () => {
  const navigate = useNavigate();
  
  const helpOptions = [
    {
      id: 1,
      title: 'Customer Support',
      description: 'Get help with FAQs, contact our support team',
      icon: MessageCircle,
      path: '/help/customer-support',
      color: 'from-[#5BA3D0] to-[#7BB8DC]'
    },
    {
      id: 2,
      title: 'Open a Dispute',
      description: 'Resolve issues with your orders',
      icon: AlertCircle,
      path: '/help/dispute',
      color: 'from-[#7BB8DC] to-[#5BA3D0]'
    },
    {
      id: 3,
      title: 'Report an Issue',
      description: 'Report technical or product issues',
      icon: FileText,
      path: '/help/report-issue',
      color: 'from-[#5BA3D0] to-[#7BB8DC]'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-4">How can we help you?</h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Choose a category to get started</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
          {helpOptions.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.id}
                onClick={() => navigate(option.path)}
                className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-soft hover:shadow-xl transition-all duration-300 p-8 cursor-pointer group border border-gray-100 dark:border-gray-800"
              >
                <div className={`w-16 h-16 rounded-lg bg-gradient-to-r ${option.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-[#5BA3D0]">{option.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{option.description}</p>
                <div className="flex items-center text-[#5BA3D0] font-medium">
                  Get Started
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800/80 rounded-2xl shadow-soft p-8 border border-gray-100 dark:border-gray-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Quick Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <Phone className="w-6 h-6 text-[#5BA3D0]" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Phone</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">+880 1XXX-XXXXXX</p>
                <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">Mon-Fri, 9AM-6PM</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-[#5BA3D0]" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Email</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">support@oceanbazar.com.bd</p>
                <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">24/7 Support</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-[#5BA3D0]" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Response Time</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Usually within 2 hours</p>
                <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">During business hours</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;