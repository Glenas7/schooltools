import { useParams, useNavigate } from 'react-router-dom';
import { SchoolProvider, useSchool } from '@schooltools/shared-auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import SchoolInformationManagement from '@/components/admin/SchoolInformationManagement';
import ModuleManagement from '@/components/admin/ModuleManagement';

// Inner component that uses the SchoolProvider context
const SchoolManagementContent = () => {
  const { currentSchool, loading } = useSchool();
  const navigate = useNavigate();

  // Show loading spinner while school is being loaded
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-600" />
          <p className="mt-2 text-gray-600">Loading school data...</p>
        </div>
      </div>
    );
  }

  // Show error if school couldn't be loaded
  if (!loading && !currentSchool) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">School Not Found</h1>
          <p className="text-gray-600 mb-6">The requested school could not be found or you don't have access to it.</p>
          <Button onClick={() => navigate('/')}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/')}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">School Management</h1>
                <p className="text-gray-600">Manage administrators and settings</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <SchoolInformationManagement />
          <ModuleManagement />
        </div>
      </main>
    </div>
  );
};

// Outer component that provides the SchoolProvider context
const SchoolManagement = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const navigate = useNavigate();

  if (!schoolSlug) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid URL</h1>
          <p className="text-gray-600 mb-6">No school specified in the URL.</p>
          <Button onClick={() => navigate('/')}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <SchoolProvider supabaseClient={supabase}>
      <SchoolManagementContent />
    </SchoolProvider>
  );
};

export default SchoolManagement; 