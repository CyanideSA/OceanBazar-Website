import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';
import { authAPI } from '../api/service';

const LoginPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');

    try {
      const response = await authAPI.login({ email, password });
      const { user, token } = response.data;
      
      onLogin(user, token);
      toast({
        title: 'Welcome back!',
        description: 'You have successfully logged in'
      });
      navigate('/');
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Invalid email or password',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full animate-slide-up">
        <div className="bg-white dark:bg-gray-800/90 rounded-2xl shadow-soft p-7 sm:p-8 border border-gray-100 dark:border-gray-800">
          <div className="text-center mb-8">
            <img 
              src="https://customer-assets.emergentagent.com/job_ocean-commerce-4/artifacts/nudvg1tt_OceanBazar%20Logo.png" 
              alt="OceanBazar" 
              className="w-[84px] h-auto object-contain mx-auto mb-5"
            />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Welcome back</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">Sign in to your OceanBazar.com.bd account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 h-11 rounded-xl border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:border-[#5BA3D0] focus:ring-[#5BA3D0]/20 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 h-11 rounded-xl border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:border-[#5BA3D0] focus:ring-[#5BA3D0]/20 text-sm"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  id="remember"
                  type="checkbox"
                  className="h-4 w-4 text-[#5BA3D0] focus:ring-[#5BA3D0]/30 border-gray-300 dark:border-gray-600 rounded"
                />
                <label htmlFor="remember" className="text-sm text-gray-600 dark:text-gray-400">
                  Remember me
                </label>
              </div>
              <Link to="/forgot-password" className="text-sm text-[#5BA3D0] hover:text-[#4A90B8] font-medium transition-colors">
                Forgot password?
              </Link>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#5BA3D0] hover:bg-[#4A90B8] text-white h-11 rounded-xl font-semibold text-sm transition-colors duration-200"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Don't have an account?{' '}
              <Link to="/signup" className="text-[#5BA3D0] hover:text-[#4A90B8] font-semibold transition-colors">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
