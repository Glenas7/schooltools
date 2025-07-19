import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextWrapper';
import { useSchools } from '../../contexts/SchoolsContextWrapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { User, Lock, GraduationCap } from 'lucide-react';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, user } = useAuth();
  const { schools, fetchUserSchools } = useSchools();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Provide more specific error messages
      let errorMessage = "Invalid email or password.";
      let errorTitle = "Login failed";
      
      if (error.message?.includes('Invalid login credentials') || 
          error.message?.includes('invalid credentials')) {
        errorMessage = "The email or password you entered is incorrect. Please check your credentials and try again.";
      } else if (error.message?.includes('Email not confirmed')) {
        errorTitle = "Email not verified";
        errorMessage = "Please check your email and click the verification link before signing in.";
      } else if (error.message?.includes('Too many requests')) {
        errorTitle = "Too many attempts";
        errorMessage = "Too many login attempts. Please wait a moment before trying again.";
      } else if (error.message?.includes('User not found') || 
                 error.message?.includes('email address is not registered')) {
        errorTitle = "Account not found";
        errorMessage = "No account found with this email address. Please check your email or create a new account.";
      } else if (error.message?.includes('signup')) {
        errorTitle = "Account setup incomplete";
        errorMessage = "It looks like your account setup wasn't completed. Please try signing up again or contact support.";
      } else if (error.message) {
        errorMessage = error.message;
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
      fetchUserSchools();
    }
  }, [isAuthenticated, user, toast, fetchUserSchools]);

  // Handle redirect logic based on schools - ONLY when on login page
  useEffect(() => {
    console.log('[LoginForm] Redirect effect. Location:', location.pathname, 'isAuthenticated:', isAuthenticated, 'user:', !!user, 'schools.length:', schools.length);
    
    // Only handle redirects if we're actually on the login page
    if (location.pathname !== '/login') {
      console.log('[LoginForm] Not on login page, skipping redirect logic');
      return;
    }

    if (isAuthenticated && user && schools !== undefined) {
      console.log('[LoginForm] User authenticated on login page, determining redirect...');
      if (schools.length === 0) {
        // User has no schools, redirect to school select (which will handle the no-schools case)
        console.log('[LoginForm] User has no schools, redirecting to school-select');
        navigate('/school-select', { replace: true });
      } else if (user.last_accessed_school_id && schools.find(s => s.id === user.last_accessed_school_id)) {
        // User has a last accessed school and it's still available, redirect there
        console.log('[LoginForm] Redirecting to last accessed school:', user.last_accessed_school_id);
        const lastSchool = schools.find(s => s.id === user.last_accessed_school_id);
        const schoolIdentifier = lastSchool?.slug || user.last_accessed_school_id;
        navigate(`/school/${schoolIdentifier}/schedule`, { replace: true });
      } else if (schools.length === 1) {
        // User has one school, go directly to that school
        console.log('[LoginForm] User has one school, redirecting to:', schools[0].id);
        const schoolIdentifier = schools[0].slug || schools[0].id;
        navigate(`/school/${schoolIdentifier}/schedule`, { replace: true });
      } else {
        // User has multiple schools and no valid last accessed school, let them choose
        console.log('[LoginForm] User has multiple schools, redirecting to school-select');
        navigate('/school-select', { replace: true });
      }
      setIsLoading(false);
    }
  }, [isAuthenticated, user, schools, navigate, location.pathname]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="ml-2 text-2xl font-bold text-gray-900">School Scheduler</span>
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
              {isLoading ? 'Signing in...' : 'Sign In'}
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
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginForm;
