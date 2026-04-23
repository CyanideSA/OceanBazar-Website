import React, { useState } from 'react';
import { Building2, Shield, TrendingDown, Truck, CheckCircle, Package } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../hooks/use-toast';
import { wholesaleAPI } from '../api/service';

const WholesaleHub = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: 'retailer',
    taxId: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    businessDescription: '',
    expectedVolume: '100-500'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await wholesaleAPI.apply(formData);

      toast({
        title: 'Application Submitted!',
        description: 'We will review your application within 2-3 business days.'
      });

      // Reset form
      setFormData({
        businessName: '',
        businessType: 'retailer',
        taxId: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        businessDescription: '',
        expectedVolume: '100-500'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to submit application',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-12">
        <div className="max-w-6xl mx-auto mb-12">
          <div className="bg-[#5BA3D0] rounded-2xl p-8 md:p-12 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-12 h-12" />
              <h1 className="text-2xl font-bold tracking-tight">Wholesale Hub</h1>
            </div>
            <p className="text-lg md:text-xl mb-6">Unlock exclusive wholesale pricing for bulk orders (25+ units)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                <TrendingDown className="w-8 h-8 mb-2" />
                <h3 className="font-bold mb-1">Up to 70% Off</h3>
                <p className="text-sm">Volume discounts</p>
              </div>
              <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                <Shield className="w-8 h-8 mb-2" />
                <h3 className="font-bold mb-1">Money Protection</h3>
                <p className="text-sm">Secure transactions</p>
              </div>
              <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                <Truck className="w-8 h-8 mb-2" />
                <h3 className="font-bold mb-1">Flexible Shipping</h3>
                <p className="text-sm">Pay after preparation</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Why Choose Wholesale?</h2>
            
            <div className="space-y-4 mb-8">
              <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-soft">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <Package className="w-6 h-6 text-[#5BA3D0]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Tiered Pricing</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Example: 1-99 qty $2.00, 100-999 $1.00, 1000+ $0.50/item</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-soft">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-6 h-6 text-[#5BA3D0]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Flexible Shipping</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Pay 700-1000 BDT/kg after preparation with photo proof</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-soft">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-[#5BA3D0]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Money Protection</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">14-day return, secure payment, order tracking</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-soft p-6 md:p-8 border border-gray-100 dark:border-gray-800">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Apply for Wholesale</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Business Name *</Label>
                <Input value={formData.businessName} onChange={(e) => setFormData({...formData, businessName: e.target.value})} required className="mt-1" />
              </div>

              <div>
                <Label>Business Type *</Label>
                <select value={formData.businessType} onChange={(e) => setFormData({...formData, businessType: e.target.value})} className="w-full mt-1 px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors" required>
                  <option value="retailer">Retailer</option>
                  <option value="distributor">Distributor</option>
                  <option value="manufacturer">Manufacturer</option>
                  <option value="online_seller">Online Seller</option>
                </select>
              </div>

              <div>
                <Label>Tax ID / Registration Number</Label>
                <Input value={formData.taxId} onChange={(e) => setFormData({...formData, taxId: e.target.value})} className="mt-1" />
              </div>

              <div>
                <Label>Contact Person *</Label>
                <Input value={formData.contactPerson} onChange={(e) => setFormData({...formData, contactPerson: e.target.value})} required className="mt-1" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Email *</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required className="mt-1" />
                </div>
                <div>
                  <Label>Phone *</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required className="mt-1" />
                </div>
              </div>

              <div>
                <Label>Business Address *</Label>
                <Textarea value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} required className="mt-1" rows={2} />
              </div>

              <div>
                <Label>Business Description *</Label>
                <Textarea value={formData.businessDescription} onChange={(e) => setFormData({...formData, businessDescription: e.target.value})} required className="mt-1" rows={2} placeholder="Describe your business and product interests" />
              </div>

              <div>
                <Label>Expected Monthly Volume *</Label>
                <select value={formData.expectedVolume} onChange={(e) => setFormData({...formData, expectedVolume: e.target.value})} className="w-full mt-1 px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors" required>
                  <option value="100-500">100-500 units</option>
                  <option value="500-1000">500-1,000 units</option>
                  <option value="1000-5000">1,000-5,000 units</option>
                  <option value="5000+">5,000+ units</option>
                </select>
              </div>

              <div>
                <Label>Customer ID (if existing)</Label>
                <Input value={formData.customerId} onChange={(e) => setFormData({...formData, customerId: e.target.value})} placeholder="Optional" className="mt-1" />
              </div>

              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-sm">
                <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">After Submission:</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-gray-700 dark:text-gray-300">
                  <li>Review in 2-3 business days</li>
                  <li>Email notification on approval</li>
                  <li>Instant wholesale pricing access</li>
                </ul>
              </div>

              <Button type="submit" className="w-full bg-[#5BA3D0] hover:bg-[#4A90B8] text-white h-12">
                Submit Application
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WholesaleHub;
