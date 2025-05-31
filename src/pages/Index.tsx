
import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Building2, Shield, Users, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect to admin dashboard if user is already authenticated and is an admin
  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      navigate('/admin/dashboard');
    }
  }, [user, isAdmin, authLoading, navigate]);

  const handleGetStarted = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-100">
      {/* Header */}
      <header className="px-4 lg:px-6 h-16 flex items-center border-b bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-center">
          <Building2 className="h-8 w-8 text-blue-600 mr-2" />
          <span className="text-xl font-bold">StockMap</span>
        </div>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Button variant="ghost" onClick={handleGetStarted}>
            Admin Login
          </Button>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl mb-6">
                  <Building2 className="h-10 w-10 text-white" />
                </div>
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Welcome to <span className="text-blue-600">StockMap</span>
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl">
                  Professional inventory management system designed for administrators. 
                  Streamline your stock operations with advanced analytics and real-time tracking.
                </p>
              </div>
              <div className="space-x-4">
                <Button onClick={handleGetStarted} size="lg" className="bg-blue-600 hover:bg-blue-700">
                  <Shield className="mr-2 h-4 w-4" />
                  Admin Access
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-white">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid gap-6 lg:grid-cols-3 lg:gap-12">
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold">Role-Based Access</h3>
                <p className="text-gray-500">
                  Secure admin-only access with comprehensive user management and role verification.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold">Real-time Analytics</h3>
                <p className="text-gray-500">
                  Advanced reporting and analytics to help you make informed inventory decisions.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold">Enterprise Security</h3>
                <p className="text-gray-500">
                  Bank-level security with encrypted data storage and secure authentication protocols.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-blue-600">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter text-white sm:text-4xl md:text-5xl">
                  Ready to Get Started?
                </h2>
                <p className="mx-auto max-w-[600px] text-blue-100 md:text-xl">
                  Access your admin dashboard and start managing your inventory with StockMap's 
                  powerful tools and insights.
                </p>
              </div>
              <Button 
                onClick={handleGetStarted} 
                size="lg" 
                variant="secondary"
                className="bg-white text-blue-600 hover:bg-blue-50"
              >
                <Shield className="mr-2 h-4 w-4" />
                Admin Login
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t bg-white">
        <p className="text-xs text-gray-500">
          © 2024 StockMap. All rights reserved. Admin access required.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <span className="text-xs text-gray-500">Secure • Professional • Reliable</span>
        </nav>
      </footer>
    </div>
  );
};

export default Index;
