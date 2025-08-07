import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useToast } from '@/shared/components/ui/use-toast';
import { User, Mail, Lock, GraduationCap, Loader2, Check, X, CheckCircle, ArrowRight } from 'lucide-react';
import { supabase } from '@/core/lib/supabaseClient';

const SignupForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [emailValidation, setEmailValidation] = useState<{
    isChecking: boolean;
    isAvailable: boolean | null;
    hasChecked: boolean;
  }>({
    isChecking: false,
    isAvailable: null,
    hasChecked: false
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Reset email validation when email changes
    if (name === 'email') {
      setEmailValidation({
        isChecking: false,
        isAvailable: null,
        hasChecked: false
      });
    }
  };

  const handleEmailBlur = async () => {
    const email = formData.email.trim();
    
    // Only check if email is valid format and not empty
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailValidation(prev => ({ ...prev, isChecking: true }));
      
      const isAvailable = await checkEmailAvailability(email);
      
      setEmailValidation({
        isChecking: false,
        isAvailable,
        hasChecked: true
      });
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter your full name.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.email.trim()) {
      toast({
        title: "Validation Error", 
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return false;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const checkEmailAvailability = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('check_email_availability', {
        target_email: email
      });

      if (error) {
        console.error('Error checking email availability:', error);
        // If we can't check, allow the signup to proceed (better UX than blocking)
        return true;
      }

      return data === true;
    } catch (error) {
      console.error('Exception checking email availability:', error);
      // If we can't check, allow the signup to proceed
      return true;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // First, check if email is already in use
      const emailAvailable = await checkEmailAvailability(formData.email);
      
      if (!emailAvailable) {
        toast({
          title: "Email already exists",
          description: "An account with this email address already exists. Please use a different email or try signing in instead.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Create user account
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name
          }
        }
      });

      if (error) {
        // Handle specific Supabase errors for duplicate emails
        if (error.message?.includes('User already registered') || 
            error.message?.includes('email address is already registered')) {
          toast({
            title: "Email already exists",
            description: "An account with this email address already exists. Please use a different email or try signing in instead.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      if (data.user) {
        // Show success state instead of navigating away
        setSignupSuccess(true);
      }
    } catch (error: unknown) {
      console.error('Signup error:', error);
      
      // Handle specific error messages for better UX
      let errorMessage = "Failed to create account. Please try again.";
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg?.includes('User already registered') || 
          errorMsg?.includes('email address is already registered')) {
        errorMessage = "An account with this email address already exists. Please use a different email or try signing in instead.";
      } else if (errorMsg?.includes('invalid email')) {
        errorMessage = "Please enter a valid email address.";
      } else if (errorMsg?.includes('password')) {
        errorMessage = "Password must be at least 6 characters long.";
      } else if (errorMsg) {
        errorMessage = errorMsg;
      }
      
      toast({
        title: "Signup failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show success message if signup was successful
  if (signupSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-center text-green-600">Account Created Successfully!</CardTitle>
            <CardDescription className="text-center">
              Your account has been created. Please verify your email before logging in.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 leading-relaxed">
                <strong>📧 Check your email inbox</strong><br/>
                We've sent a verification link to <strong>{formData.email}</strong>. 
                Click the link in the email to verify your account before signing in.
              </p>
            </div>
            <p className="text-sm text-gray-600">
              Don't see the email? Check your spam folder or try signing up again.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={() => navigate('/login')} 
              className="w-full"
              variant="default"
            >
              Go to Login Page
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="ml-2 text-2xl font-bold text-gray-900">School Scheduler</span>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Create Your Account</CardTitle>
          <CardDescription className="text-center">
            Sign up to start managing your school's scheduling
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="name"
                  name="name"
                  type="text" 
                  placeholder="Enter your full name" 
                  value={formData.name} 
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email"
                  name="email"
                  type="email" 
                  placeholder="Enter your email address" 
                  value={formData.email} 
                  onChange={handleInputChange}
                  onBlur={handleEmailBlur}
                  required
                  className={`w-full pl-10 pr-10 ${
                    emailValidation.hasChecked 
                      ? emailValidation.isAvailable 
                        ? 'border-green-500 focus:border-green-500' 
                        : 'border-red-500 focus:border-red-500'
                      : ''
                  }`}
                />
                {/* Validation feedback icon */}
                <div className="absolute right-3 top-3 h-4 w-4">
                  {emailValidation.isChecking && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {!emailValidation.isChecking && emailValidation.hasChecked && emailValidation.isAvailable && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                  {!emailValidation.isChecking && emailValidation.hasChecked && !emailValidation.isAvailable && (
                    <X className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
              {/* Validation message */}
              {emailValidation.hasChecked && !emailValidation.isAvailable && (
                <p className="text-sm text-red-500 mt-1">
                  This email is already registered. Please use a different email or <Link to="/login" className="underline hover:text-red-600">sign in instead</Link>.
                </p>
              )}
              {emailValidation.hasChecked && emailValidation.isAvailable && (
                <p className="text-sm text-green-600 mt-1">
                  Email is available ✓
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="password"
                  name="password"
                  type="password" 
                  placeholder="Create a password (min. 6 characters)" 
                  value={formData.password} 
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password" 
                  placeholder="Confirm your password" 
                  value={formData.confirmPassword} 
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10"
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={
                isLoading || 
                (emailValidation.hasChecked && !emailValidation.isAvailable) ||
                emailValidation.isChecking
              }
            >
              {isLoading 
                ? 'Creating Account...' 
                : emailValidation.isChecking 
                  ? 'Checking email...'
                  : 'Create Account'
              }
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Sign in here
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SignupForm; 