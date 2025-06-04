import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSchools } from '../../contexts/SchoolsContext';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface RequireSchoolAccessProps {
  children: React.ReactNode;
}

const RequireSchoolAccess: React.FC<RequireSchoolAccessProps> = ({ children }) => {
  const { schoolId } = useParams<{ schoolId: string }>();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { schools, fetchUserSchools, loading: schoolsLoading } = useSchools();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [schoolsFetched, setSchoolsFetched] = useState(false);
  const [isFetchingSchools, setIsFetchingSchools] = useState(false);

  useEffect(() => {
    const checkSchoolAccess = async () => {
      console.log('[RequireSchoolAccess] checkSchoolAccess called. State:', {
        authLoading,
        isAuthenticated,
        userId: user?.id,
        schoolId,
        schoolsLength: schools.length,
        schoolsLoading,
        schoolsFetched,
        isFetchingSchools
      });

      // Wait for auth to finish loading before making any decisions
      if (authLoading) {
        console.log('[RequireSchoolAccess] Auth still loading, waiting...');
        return;
      }

      if (!isAuthenticated || !user) {
        console.log('[RequireSchoolAccess] Not authenticated, redirecting to login');
        navigate('/login');
        return;
      }

      if (!schoolId) {
        console.log('[RequireSchoolAccess] No schoolId, redirecting to school-select');
        navigate('/school-select');
        return;
      }

      // Check if schools are already loaded (from previous navigation/login)
      if (!schoolsFetched && schools.length > 0 && !schoolsLoading && !isFetchingSchools) {
        console.log('[RequireSchoolAccess] Schools already loaded, marking as fetched');
        setSchoolsFetched(true);
      }
      // Fetch user's schools if not already loaded and not currently loading
      else if (!schoolsFetched && schools.length === 0 && !schoolsLoading && !isFetchingSchools) {
        console.log('[RequireSchoolAccess] Starting school fetch...');
        setSchoolsFetched(true);
        setIsFetchingSchools(true);
        try {
          await fetchUserSchools();
          console.log('[RequireSchoolAccess] School fetch completed successfully');
        } catch (error) {
          console.error('[RequireSchoolAccess] School fetch failed:', error);
          // Reset states so we can try again
          setSchoolsFetched(false);
        } finally {
          setIsFetchingSchools(false);
        }
      }

      // Only set isChecking to false after schools have been fetched at least once and are not loading
      if (schoolsFetched && !schoolsLoading && !isFetchingSchools) {
        console.log('[RequireSchoolAccess] Schools fetched and not loading, ready for access check');
        setIsChecking(false);
      }
    };

    checkSchoolAccess();
  }, [authLoading, isAuthenticated, user, schoolId, schools, schoolsLoading, schoolsFetched, isFetchingSchools, navigate, fetchUserSchools]);

  useEffect(() => {
    // Only proceed with access checks after auth is loaded, schools are fetched, and not currently loading
    if (!authLoading && !schoolsLoading && !isFetchingSchools && !isChecking && schoolId && schoolsFetched) {
      console.log('[RequireSchoolAccess] Checking school access. Schools count:', schools.length, 'Target school:', schoolId);
      console.log('[RequireSchoolAccess] Available schools:', schools.map(s => ({ id: s.id, name: s.name })));
      
      // Check if user has access to the requested school
      const hasAccess = schools.some(school => school.id === schoolId);
      
      if (!hasAccess) {
        console.log('[RequireSchoolAccess] No access to school', schoolId);
        // User doesn't have access to this school
        if (schools.length === 0) {
          // User has no schools at all
          console.log('[RequireSchoolAccess] User has no schools, redirecting to school-setup');
          navigate('/school-setup');
        } else if (schools.length === 1) {
          // User has one school, redirect them there
          console.log('[RequireSchoolAccess] User has one school, redirecting to', schools[0].id);
          navigate(`/school/${schools[0].id}/schedule`);
        } else {
          // User has multiple schools, let them choose
          console.log('[RequireSchoolAccess] User has multiple schools, redirecting to school-select');
          navigate('/school-select');
        }
      } else {
        console.log('[RequireSchoolAccess] User has access to school', schoolId, '- allowing access');
      }
    } else {
      console.log('[RequireSchoolAccess] Not ready for access check yet. State:', {
        authLoading,
        schoolsLoading,
        isFetchingSchools,
        isChecking,
        schoolId: !!schoolId,
        schoolsFetched
      });
    }
  }, [authLoading, schoolsLoading, isFetchingSchools, isChecking, schoolId, schools, schoolsFetched, navigate]);

  // Show loading while auth is loading
  if (authLoading) {
    console.log('[RequireSchoolAccess] Rendering: Auth loading');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // After auth is loaded, check authentication
  if (!isAuthenticated || !user) {
    console.log('[RequireSchoolAccess] Rendering: Not authenticated');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show loading while checking school access or schools are loading
  if (isChecking || schoolsLoading || isFetchingSchools || !schoolsFetched) {
    console.log('[RequireSchoolAccess] Rendering: Checking access. State:', { 
      isChecking, 
      schoolsLoading, 
      isFetchingSchools, 
      schoolsFetched 
    });
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Verifying school access...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user has access to the requested school
  const hasAccess = schoolId && schools.some(school => school.id === schoolId);

  if (!hasAccess) {
    console.log('[RequireSchoolAccess] Rendering: No access, will redirect');
    // This will trigger the useEffect redirect above
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  console.log('[RequireSchoolAccess] Rendering: Access granted, showing children');
  return <>{children}</>;
};

export default RequireSchoolAccess; 