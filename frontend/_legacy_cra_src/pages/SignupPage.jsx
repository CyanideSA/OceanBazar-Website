import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';
import { authAPI } from '../api/service';

const SignupPage = ({ onSignup }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') || '').trim();
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');

    if (password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive'
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.signup({
        name,
        email,
        password
      });
      
      const { user, token } = response.data;
      onSignup(user, token);
      
      toast({
        title: 'Account created!',
        description: 'Welcome to OceanBazar'
      });
      navigate('/');
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to create account',
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Create your account</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">Join OceanBazar.com.bd marketplace today</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
              <div className="relative mt-1.5">
                <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-10 h-11 rounded-xl border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:border-[#5BA3D0] focus:ring-[#5BA3D0]/20 text-sm"
                  required
                />
              </div>
            </div>

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
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 h-11 rounded-xl border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:border-[#5BA3D0] focus:ring-[#5BA3D0]/20 text-sm"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="pl-10 h-11 rounded-xl border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:border-[#5BA3D0] focus:ring-[#5BA3D0]/20 text-sm"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#5BA3D0] hover:bg-[#4A90B8] text-white h-11 rounded-xl font-semibold text-sm transition-colors duration-200"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-[#5BA3D0] hover:text-[#4A90B8] font-semibold transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
