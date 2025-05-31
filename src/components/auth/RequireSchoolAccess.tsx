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
  const { user, isAuthenticated } = useAuth();
  const { schools, fetchUserSchools } = useSchools();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkSchoolAccess = async () => {
      if (!isAuthenticated || !user) {
        navigate('/login');
        return;
      }

      if (!schoolId) {
        navigate('/school-select');
        return;
      }

      // Fetch user's schools if not already loaded
      if (schools.length === 0) {
        await fetchUserSchools();
      }

      setIsChecking(false);
    };

    checkSchoolAccess();
  }, [isAuthenticated, user, schoolId, schools, navigate, fetchUserSchools]);

  useEffect(() => {
    if (!isChecking && schoolId) {
      // Check if user has access to the requested school
      const hasAccess = schools.some(school => school.id === schoolId);
      
      if (!hasAccess) {
        // User doesn't have access to this school
        if (schools.length === 0) {
          // User has no schools at all
          navigate('/school-setup');
        } else if (schools.length === 1) {
          // User has one school, redirect them there
          navigate(`/school/${schools[0].id}/schedule`);
        } else {
          // User has multiple schools, let them choose
          navigate('/school-select');
        }
      }
    }
  }, [isChecking, schoolId, schools, navigate]);

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isChecking) {
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
    // This will trigger the useEffect redirect above
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireSchoolAccess; 