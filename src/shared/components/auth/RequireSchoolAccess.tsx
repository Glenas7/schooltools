import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/contexts';
import { useSchools } from '@/core/contexts';
import { supabase } from '@/core/lib/supabaseClient';

interface RequireSchoolAccessProps {
  children: React.ReactNode;
}

const RequireSchoolAccess: React.FC<RequireSchoolAccessProps> = ({ children }) => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { user, isAuthenticated, loading: authLoading, updateLastAccessedSchool } = useAuth();
  const { schools, fetchUserSchools, loading: schoolsLoading } = useSchools();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [schoolsFetched, setSchoolsFetched] = useState(false);
  const [isFetchingSchools, setIsFetchingSchools] = useState(false);
  const [resolvedSchoolId, setResolvedSchoolId] = useState<string | null>(null);

  // Function to resolve school slug to ID
  const resolveSchoolSlug = async (slug: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .rpc('get_school_by_slug', { school_slug: slug });

      if (error) {
        console.error('Error resolving school slug:', error);
        return null;
      }

      if (!data || data.length === 0) {
        console.warn('School not found for slug:', slug);
        return null;
      }

      return data[0].id;
    } catch (error) {
      console.error('Exception resolving school slug:', error);
      return null;
    }
  };

  useEffect(() => {
    const checkSchoolAccess = async () => {
      console.log('[RequireSchoolAccess] checkSchoolAccess called. State:', {
        authLoading,
        isAuthenticated,
        userId: user?.id,
        schoolSlug,
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

      if (!schoolSlug) {
        console.log('[RequireSchoolAccess] No schoolSlug, redirecting to /');
        navigate('//');
        return;
      }

      // Resolve school slug to ID if not already resolved
      if (!resolvedSchoolId) {
        console.log('[RequireSchoolAccess] Resolving school slug to ID:', schoolSlug);
        const schoolId = await resolveSchoolSlug(schoolSlug);
        if (!schoolId) {
          console.log('[RequireSchoolAccess] Failed to resolve school slug, redirecting to /');
          setIsChecking(false);
          navigate('//');
          return;
        }
        setResolvedSchoolId(schoolId);
        setIsChecking(false); // Reset checking state before useEffect re-runs
        return; // Exit here, useEffect will run again with resolved ID
      }

      // Continue with existing auth logic, but don't try to fetch schools multiple times
      if (!schoolsFetched && !isFetchingSchools && schools.length === 0) {
        console.log('[RequireSchoolAccess] Schools not fetched yet, fetching...');
        setIsFetchingSchools(true);
        try {
          await fetchUserSchools();
          setSchoolsFetched(true);
        } catch (error) {
          console.error('[RequireSchoolAccess] Error fetching schools:', error);
        } finally {
          setIsFetchingSchools(false);
          setIsChecking(false);
        }
        return;
      }

      // Mark as fetched if we have schools
      if (schools.length > 0 && !schoolsFetched) {
        setSchoolsFetched(true);
      }

      // Always set checking to false at the end of the function
      setIsChecking(false);
    };

    checkSchoolAccess();
  }, [authLoading, isAuthenticated, user, schoolSlug, resolvedSchoolId, schools.length, schoolsLoading, fetchUserSchools, navigate, schoolsFetched, isFetchingSchools]);

  useEffect(() => {
    // Only proceed with access checks after auth is loaded, schools are fetched, and not currently loading
    if (!authLoading && !schoolsLoading && !isFetchingSchools && !isChecking && resolvedSchoolId && schoolsFetched) {
      console.log('[RequireSchoolAccess] Checking school access. Schools count:', schools.length, 'Target school ID:', resolvedSchoolId);
      console.log('[RequireSchoolAccess] Available schools:', schools.map(s => ({ id: s.id, name: s.name })));
      
      // Check if user has access to the requested school using resolved ID
      const hasAccess = schools.some(school => school.id === resolvedSchoolId);
      
      if (!hasAccess) {
        console.log('[RequireSchoolAccess] No access to school', resolvedSchoolId);
        // User doesn't have access to this school
        if (schools.length === 0) {
          // User has no schools at all, redirect to school select (which will handle the no-schools case)
          console.log('[RequireSchoolAccess] User has no schools, redirecting to /');
          navigate('//');
        } else if (schools.length === 1) {
          // User has one school, redirect them there using the school's slug
          const school = schools[0];
          const schoolIdentifier = school.slug || school.id;
          console.log('[RequireSchoolAccess] User has one school, redirecting to', schoolIdentifier);
          navigate(`/school/${schoolIdentifier}/schedule`);
        } else {
          // User has multiple schools, let them choose
          console.log('[RequireSchoolAccess] User has multiple schools, redirecting to /');
          navigate('//');
        }
      } else {
        console.log('[RequireSchoolAccess] User has access to school', resolvedSchoolId, '- allowing access');
        
        // Update the user's last accessed school in the database only if it's different
        if (resolvedSchoolId && updateLastAccessedSchool && user?.last_accessed_school_id !== resolvedSchoolId) {
          console.log('[RequireSchoolAccess] Updating last accessed school from', user?.last_accessed_school_id, 'to', resolvedSchoolId);
          updateLastAccessedSchool(resolvedSchoolId);
        } else if (user?.last_accessed_school_id === resolvedSchoolId) {
          console.log('[RequireSchoolAccess] Last accessed school already matches current school, skipping update');
        }
      }
    } else {
      console.log('[RequireSchoolAccess] Not ready for access check yet. State:', {
        authLoading,
        schoolsLoading,
        isFetchingSchools,
        isChecking,
        resolvedSchoolId: !!resolvedSchoolId,
        schoolsFetched
      });
    }
  }, [authLoading, schoolsLoading, isFetchingSchools, isChecking, resolvedSchoolId, schoolsFetched, schools, navigate]);

  if (authLoading || schoolsLoading || isFetchingSchools || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireSchoolAccess; 