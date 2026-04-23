import React, { useState } from 'react';
import { AlertCircle, Upload, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../hooks/use-toast';
import { profileAPI } from '../api/service';

const OpenDispute = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    orderId: '',
    disputeType: 'product_quality',
    description: '',
    resolution: 'refund'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const orderId = String(formData.orderId || '').trim();
    if (!orderId) {
      toast({
        title: 'Order ID required',
        description: 'Please enter a valid order ID.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Backend currently supports "return request" per order.
      // We encode dispute type + preferred resolution into the "reason" field.
      const reason = JSON.stringify({
        disputeType: formData.disputeType,
        resolution: formData.resolution,
        description: formData.description,
      });

      await profileAPI.requestReturn(orderId, reason);

      toast({
        title: 'Dispute submitted!',
        description: 'Your return request was submitted for review (24-48 hours).',
      });
    } catch (error) {
      toast({
        title: 'Could not submit',
        description:
          error?.response?.data?.detail ||
          'Please check your order ID and try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-[#5BA3D0] flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Open a Dispute</h1>
              <p className="text-gray-600 dark:text-gray-400">Resolve issues with your orders</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-soft p-6 md:p-8 border border-gray-100 dark:border-gray-800 mb-6">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Before opening a dispute:</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                <li>Try contacting the seller first through order page</li>
                <li>Gather evidence (photos, videos, screenshots)</li>
                <li>Review our return and refund policy</li>
                <li>Disputes must be opened within 30 days of delivery</li>
              </ul>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label>Order ID *</Label>
                <Input value={formData.orderId} onChange={(e) => setFormData({...formData, orderId: e.target.value})} placeholder="Enter your order ID" required className="mt-1" />
              </div>

              <div>
                <Label>Dispute Type *</Label>
                <select value={formData.disputeType} onChange={(e) => setFormData({...formData, disputeType: e.target.value})} className="w-full mt-1 px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors" required>
                  <option value="product_quality">Product Quality Issue</option>
                  <option value="wrong_item">Wrong Item Received</option>
                  <option value="missing_items">Missing Items</option>
                  <option value="damaged">Damaged During Shipping</option>
                  <option value="not_delivered">Order Not Delivered</option>
                  <option value="description_mismatch">Doesn't Match Description</option>
                  <option value="other">Other Issue</option>
                </select>
              </div>

              <div>
                <Label>Description *</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Please describe the issue in detail..." rows={5} required className="mt-1" />
              </div>

              <div>
                <Label>Upload Evidence (Photos/Videos)</Label>
                <div className="mt-1 border-2 border-dashed border-[#B8D4E8] dark:border-gray-700 rounded-lg p-8 text-center hover:border-[#5BA3D0] transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 text-[#5BA3D0] mx-auto mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Max 5 files, 10MB each</p>
                </div>
              </div>

              <div>
                <Label>Preferred Resolution *</Label>
                <select value={formData.resolution} onChange={(e) => setFormData({...formData, resolution: e.target.value})} className="w-full mt-1 px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors" required>
                  <option value="refund">Full Refund</option>
                  <option value="replacement">Replacement</option>
                  <option value="partial_refund">Partial Refund</option>
                  <option value="exchange">Exchange for Different Product</option>
                </select>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#5BA3D0] hover:bg-[#4A90B8] text-white h-12"
              >
                Submit Dispute
              </Button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 text-center">
              <CheckCircle className="w-8 h-8 text-[#5BA3D0] mx-auto mb-2" />
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Quick Response</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">24-48 hour review</p>
            </div>
            <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 text-center">
              <CheckCircle className="w-8 h-8 text-[#5BA3D0] mx-auto mb-2" />
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Fair Resolution</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Buyer protection</p>
            </div>
            <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 text-center">
              <CheckCircle className="w-8 h-8 text-[#5BA3D0] mx-auto mb-2" />
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Track Progress</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Real-time updates</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpenDispute;