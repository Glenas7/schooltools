import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/core/lib/supabaseClient';
import { useAuth } from '@/core/contexts';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useToast } from '@/shared/components/ui/use-toast';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Lock } from 'lucide-react';

const ResetPasswordForm = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, loading: authLoading } = useAuth();
  
  useEffect(() => {
    if (authLoading) {
      console.log("ResetPasswordForm: Auth is loading, waiting...");
      return;
    }

    console.log("ResetPasswordForm: Auth loading complete. Current session:", session, "Is Success:", isSuccess);

    if (isSuccess) {
      return;
    }

    if (!session) {
      setError('Invalid or missing reset token, or the link has expired. Please request a new password reset link.');
    } else {
      setError(null);
      console.log("ResetPasswordForm: Valid session detected, ready for password update.");
    }
  }, [session, authLoading, isSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { error: updateError } = await supabase.auth.updateUser({ 
        password
      });
      
      if (updateError) throw updateError;
      
      setIsSuccess(true);
      toast({
        title: 'Password reset successfully',
        description: 'Your password has been updated. You can now login with your new password.',
      });
      
      await supabase.auth.signOut();
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      
    } catch (err: unknown) {
      console.error('Error resetting password:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to reset password. Please try again.';
      setError(errorMsg);
      toast({
        title: 'Password reset failed',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading && !error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-4">
        <p>Verifying reset link...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-xl animate-fade-in">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center">Reset Password</CardTitle>
          <CardDescription className="text-center">
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4 bg-red-50 border-red-200 text-red-700">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {isSuccess ? (
            <Alert className="mb-4 bg-green-50 border-green-200">
              <AlertDescription className="text-center py-2">
                Your password has been reset successfully.
                <br />
                Redirecting to login page...
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password"
                    type="password" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10"
                    minLength={6}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="confirmPassword"
                    type="password" 
                    placeholder="••••••••" 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-10"
                    minLength={6}
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90" 
                disabled={isLoading || !!error}
              >
                {isLoading ? 'Processing...' : 'Reset Password'}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button 
            variant="link" 
            className="text-sm text-primary hover:underline"
            onClick={() => navigate('/login')}
          >
            Return to Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ResetPasswordForm; 
 
 
 