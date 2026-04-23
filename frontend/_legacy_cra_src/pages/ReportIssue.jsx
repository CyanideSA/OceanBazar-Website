import React, { useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../hooks/use-toast';
import { chatAPI } from '../api/service';

const ReportIssue = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    issueType: 'technical',
    subject: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('oceanBazarToken');
    if (!token) {
      toast({
        title: 'Please sign in',
        description: 'Log in to contact support via live chat.',
        variant: 'destructive',
      });
      return;
    }

    const subject = String(formData.subject || '').trim();
    const description = String(formData.description || '').trim();
    if (!subject || !description) {
      toast({
        title: 'Missing info',
        description: 'Please provide a subject and description.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const message = `Issue type: ${formData.issueType}\nSubject: ${subject}\nDescription: ${description}`;
      await chatAPI.sendMessage(message, 'user');

      toast({
        title: 'Report submitted!',
        description: 'A support agent will review and respond via live chat.',
      });
    } catch (error) {
      toast({
        title: 'Could not submit report',
        description: error?.response?.data?.detail || 'Please try again later.',
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
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Report an Issue</h1>
              <p className="text-gray-600 dark:text-gray-400">Help us improve by reporting problems</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-soft p-6 md:p-8 border border-gray-100 dark:border-gray-800">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label>Issue Type *</Label>
                <select value={formData.issueType} onChange={(e) => setFormData({...formData, issueType: e.target.value})} className="w-full mt-1 px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors" required>
                  <option value="technical">Technical/Website Issue</option>
                  <option value="payment">Payment Problem</option>
                  <option value="product_listing">Product Listing Error</option>
                  <option value="account">Account Issue</option>
                  <option value="mobile_app">Mobile App Problem</option>
                  <option value="security">Security Concern</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label>Subject *</Label>
                <Input value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} placeholder="Brief summary of the issue" required className="mt-1" />
              </div>

              <div>
                <Label>Detailed Description *</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Please provide as much detail as possible..." rows={6} required className="mt-1" />
              </div>

              <div>
                <Label>Screenshots/Evidence (Optional)</Label>
                <div className="mt-1 border-2 border-dashed border-[#B8D4E8] dark:border-gray-700 rounded-lg p-8 text-center hover:border-[#5BA3D0] transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 text-[#5BA3D0] mx-auto mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Upload screenshots or videos</p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#5BA3D0] hover:bg-[#4A90B8] text-white h-12"
              >
                Submit Report
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportIssue;