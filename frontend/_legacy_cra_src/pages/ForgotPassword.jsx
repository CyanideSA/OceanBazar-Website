import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../hooks/use-toast";
import { authAPI } from "../api/service";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = String(email || "").trim();
    if (!trimmed) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await authAPI.forgotPassword({ email: trimmed });

      toast({
        title: "Check your email",
        description: "If your account exists, you will receive a reset link shortly.",
      });
      navigate("/login");
    } catch (err) {
      toast({
        title: "Request failed",
        description:
          err?.response?.data?.detail || "Could not send reset request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-lg p-8 border border-transparent dark:border-gray-700">
          <div className="text-center mb-8">
            <img
              src="https://customer-assets.emergentagent.com/job_ocean-commerce-4/artifacts/nudvg1tt_OceanBazar%20Logo.png"
              alt="OceanBazar"
              className="w-[96px] h-auto object-contain mx-auto mb-4"
            />
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Reset password</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Enter your email and we will send you a reset link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#5BA3D0] hover:bg-[#4A90B8] text-white h-11"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send reset link"}
            </Button>

            <div className="text-center text-sm">
              <button
                type="button"
                className="text-[#5BA3D0] hover:text-[#4A8FB8] font-medium"
                onClick={() => navigate("/login")}
              >
                Back to sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

