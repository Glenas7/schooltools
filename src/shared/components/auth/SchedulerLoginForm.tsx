import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth, useSchools } from '@/core/contexts';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useToast } from '@/shared/components/ui/use-toast';
import { User, Lock, Calendar, GraduationCap } from 'lucide-react';

const SchedulerLoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, user } = useAuth();
  const { schools, fetchUserSchools, loading: schoolsLoading } = useSchools();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();





  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (error: unknown) {
      console.error('Login error:', error);
      
      // Provide more specific error messages
      let errorMessage = "Invalid email or password.";
      let errorTitle = "Login failed";
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg?.includes('Invalid login credentials') || 
          errorMsg?.includes('invalid credentials')) {
        errorMessage = "The email or password you entered is incorrect. Please check your credentials and try again.";
      } else if (errorMsg?.includes('Email not confirmed')) {
        errorTitle = "Email not verified";
        errorMessage = "Please check your email and click the verification link before signing in.";
      } else if (errorMsg?.includes('Too many requests')) {
        errorTitle = "Too many attempts";
        errorMessage = "Too many login attempts. Please wait a moment before trying again.";
      } else if (errorMsg?.includes('User not found') || 
                 errorMsg?.includes('email address is not registered')) {
        errorTitle = "Account not found";
        errorMessage = "No account found with this email address. Please check your email or create a new account.";
      } else if (errorMsg?.includes('signup')) {
        errorTitle = "Account setup incomplete";
        errorMessage = "It looks like your account setup wasn't completed. Please try signing up again or contact support.";
      } else if (errorMsg) {
        errorMessage = errorMsg;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      toast({
        title: "Login successful",
        description: "Welcome to School Scheduler!",
      });
      
      // Fetch user's schools to determine where to redirect
      fetchUserSchools().catch((error) => {
        console.error('[SchedulerLoginForm] Failed to fetch schools:', error);
      });
    }
  }, [isAuthenticated, user?.id, user?.email, user?.last_accessed_school_id, toast, fetchUserSchools]);

  // Handle redirect logic based on schools - Smart scheduler redirect logic with timeout
  useEffect(() => {
    // Only handle redirects if we're actually on the scheduler login page
    if (location.pathname !== '/scheduler/login') {
      return;
    }

    // If user is authenticated and schools are already loaded, redirect immediately
    if (isAuthenticated && user && schools.length > 0) {
      performSmartRedirect();
      return;
    }

    // If user is authenticated but schools not loaded yet, wait with timeout
    if (isAuthenticated && user && schools.length === 0) {
      const timeoutId = setTimeout(() => {
        if (schools.length > 0) {
          performSmartRedirect();
        } else {
          navigate('/', { replace: true });
          setIsLoading(false);
        }
      }, 1000); // Wait 1 second for schools to load
      
      return () => {
        clearTimeout(timeoutId);
      };
    }

    // Helper function to perform smart redirect
    function performSmartRedirect() {
      if (schools.length === 0) {
        navigate('/', { replace: true });
        setIsLoading(false);
      } else if (user.last_accessed_school_id && schools.find(s => s.id === user.last_accessed_school_id)) {
        const lastSchool = schools.find(s => s.id === user.last_accessed_school_id);
        const schoolIdentifier = lastSchool?.slug || user.last_accessed_school_id;
        navigate(`/school/${schoolIdentifier}/schedule`, { replace: true });
        setIsLoading(false);
      } else if (schools.length === 1) {
        const schoolIdentifier = schools[0].slug || schools[0].id;
        navigate(`/school/${schoolIdentifier}/schedule`, { replace: true });
        setIsLoading(false);
      } else {
        navigate('/', { replace: true });
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, user?.id, user?.last_accessed_school_id, schools.length, navigate, location.pathname]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Calendar className="h-8 w-8 text-primary" />
            <span className="ml-2 text-2xl font-bold text-gray-900">Scheduler</span>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Welcome Back</CardTitle>
          <CardDescription className="text-center">
            Sign in to access your school's scheduling system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email"
                  type="email" 
                  placeholder="Enter your email address" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="password"
                  type="password" 
                  placeholder="Enter your password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In to Scheduler'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary hover:underline">
              Sign up here
            </Link>
          </div>
          <div className="text-xs text-center text-muted-foreground">
            Looking for the{' '}
            <Link to="/login" className="text-primary hover:underline">
              central hub?
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SchedulerLoginForm;