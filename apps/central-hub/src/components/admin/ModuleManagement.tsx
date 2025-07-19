import { useState, useEffect } from 'react';
import { useSchool, useModules, useAuth, useSchools } from '@schooltools/shared-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Calendar, UtensilsCrossed, Plus, Trash2, Crown, Shield, User, AlertTriangle, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface ModuleUser {
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  granted_by?: string;
  granted_at?: string;
}

const ModuleManagement: React.FC = () => {
  const { currentSchool, userRole } = useSchool();
  const { getUserModulesForSchool, getModuleUsersForSchool, grantModuleAccess, revokeModuleAccess } = useModules();
  const { user } = useAuth();
  const { fetchUserSchools } = useSchools();
  const { toast } = useToast();

  const [userModules, setUserModules] = useState<any[]>([]);
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [moduleUsers, setModuleUsers] = useState<ModuleUser[]>([]);
  
  // Modal states
  const [showManageModulesModal, setShowManageModulesModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingModules, setSavingModules] = useState(false);
  
  // State for module enablement
  const [allModules, setAllModules] = useState<any[]>([]);
  const [moduleStates, setModuleStates] = useState<Record<string, boolean>>({});
  const [initialModuleStates, setInitialModuleStates] = useState<Record<string, boolean>>({});
  
  // State for school superadmin management
  const [schoolSuperadmins, setSchoolSuperadmins] = useState<any[]>([]);
  const [showAddSchoolSuperadminModal, setShowAddSchoolSuperadminModal] = useState(false);
  const [schoolSuperadminForm, setSchoolSuperadminForm] = useState({
    email: '',
    name: ''
  });
  const [schoolSuperadminErrors, setSchoolSuperadminErrors] = useState<Record<string, string>>({});
  
  // Form data for Add User modal
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'admin',
    moduleId: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isSuperAdmin = userRole === 'superadmin';

  // Helper functions
  const getModuleIcon = (moduleName: string) => {
    switch (moduleName) {
      case 'scheduler':
        return <Calendar className="h-5 w-5" />;
      case 'lunch-menu':
        return <UtensilsCrossed className="h-5 w-5" />;
      default:
        return <div className="h-5 w-5 bg-gray-400 rounded" />;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'superadmin':
        return <Shield className="h-4 w-4 text-purple-500" />;
      case 'admin':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      default:
        return <User className="h-4 w-4 text-blue-500" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'text-purple-600 bg-purple-100';
      case 'admin':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'Super Admin';
      case 'admin':
        return 'Administrator';
      default:
        return role;
    }
  };

  // Load data
  useEffect(() => {
    if (currentSchool) {
      loadUserModules();
      loadAvailableModules();
      loadAllModules();
      loadSchoolSuperadmins();
    }
  }, [currentSchool]);

  const loadUserModules = async () => {
    if (!currentSchool) return;

    try {
      // Get enabled modules for this school first
      const { data: enabledModules, error: enabledError } = await supabase
        .rpc('get_school_enabled_modules', { target_school_id: currentSchool.id });
      
      if (enabledError) throw enabledError;

      // Get all user modules for the school
      const allUserModules = await getUserModulesForSchool(currentSchool.id);
      
      // Filter to only include modules that are enabled for the school
      const enabledModuleIds = new Set((enabledModules || []).map((em: any) => em.module_id));
      const enabledUserModules = allUserModules.filter(module => 
        enabledModuleIds.has(module.module_id)
      );

      setUserModules(enabledUserModules);
    } catch (error) {
      console.error('Error loading user modules:', error);
    }
  };

  const loadAvailableModules = async () => {
    if (!currentSchool) return;

    try {
      const { error } = await supabase
        .rpc('get_available_modules_for_school', { target_school_id: currentSchool.id });
      
      if (error) throw error;
      
      // setAvailableModules(data || []); // This line was removed as per the edit hint
    } catch (error) {
      console.error('Error loading available modules:', error);
    }
  };

  const loadAllModules = async () => {
    if (!currentSchool) return;

    try {
      // Get all available modules
      const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select('id, name, display_name, description, icon, subdomain, is_active')
        .eq('is_active', true);
      
      if (modulesError) throw modulesError;

      // Get currently enabled modules for this school
      const { data: enabledModules, error: enabledError } = await supabase
        .rpc('get_school_enabled_modules', { target_school_id: currentSchool.id });
      
      if (enabledError) throw enabledError;

      setAllModules(modules || []);
      
      // Set initial state for module toggles
      const moduleStates: Record<string, boolean> = {};
      const enabledModuleIds = new Set((enabledModules || []).map((em: any) => em.module_id));
      
      (modules || []).forEach(module => {
        moduleStates[module.id] = enabledModuleIds.has(module.id);
      });
      
      setModuleStates(moduleStates);
      setInitialModuleStates({ ...moduleStates });
    } catch (error) {
      console.error('Error loading all modules:', error);
    }
  };

  const loadModuleUsers = async (moduleId: string) => {
    if (!currentSchool) return;

    setLoading(true);
    try {
      const users = await getModuleUsersForSchool(currentSchool.id, moduleId);
      // Filter to only show admin roles (superadmin and admin)
      const adminUsers = users.filter(user => user.user_role === 'superadmin' || user.user_role === 'admin');
      setModuleUsers(adminUsers);
    } catch (error) {
      console.error('Error loading module users:', error);
      toast({
        title: "Error",
        description: "Failed to load module users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleModuleSelect = async (module: any) => {
    setSelectedModule(module);
    await loadModuleUsers(module.module_id);
  };

  const handleAddUser = async () => {
    if (!currentSchool) return;

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.role) newErrors.role = 'Role is required';
    if (!formData.moduleId) newErrors.moduleId = 'Module is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      // First, create or get the user
      const { data: userData, error: userError } = await supabase
        .rpc('create_user', {
          user_email: formData.email.trim(),
          user_name: formData.name.trim()
        });

      if (userError) throw userError;

      // Extract user_id from the array response
      const userId = userData && userData.length > 0 ? userData[0].user_id : null;
      if (!userId) {
        throw new Error('Failed to get user ID from create_user response');
      }

      // Then grant module access
      const success = await grantModuleAccess(
        userId, 
        currentSchool.id, 
        formData.moduleId, 
        formData.role
      );

      if (success) {
        toast({
          title: "User added",
          description: `${formData.name} has been added as ${getRoleLabel(formData.role)} to the selected module.`,
        });

        setShowAddUserModal(false);
        setFormData({ email: '', name: '', role: 'admin', moduleId: '' });
        setErrors({});

        // Refresh the current module if it matches
        if (selectedModule && selectedModule.module_id === formData.moduleId) {
          await loadModuleUsers(formData.moduleId);
        }
      } else {
        throw new Error('Failed to grant module access');
      }
    } catch (error) {
      console.error('Error adding user:', error);
      toast({
        title: "Error",
        description: "Failed to add user to module",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAccess = async (userId: string, userName: string) => {
    if (!currentSchool || !selectedModule) return;

    try {
      const success = await revokeModuleAccess(userId, currentSchool.id, selectedModule.module_id);
      
      if (success) {
        toast({
          title: "Access revoked",
          description: `${userName}'s access to ${selectedModule.module_display_name} has been revoked.`,
        });
        await loadModuleUsers(selectedModule.module_id);
      } else {
        throw new Error('Failed to revoke access');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to revoke module access",
        variant: "destructive"
      });
    }
  };

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const resetModuleStates = () => {
    setModuleStates({ ...initialModuleStates });
  };

  const handleManageModulesClick = () => {
    resetModuleStates();
    setShowManageModulesModal(true);
  };

  const handleSaveModules = async () => {
    if (!currentSchool) return;
    
    setSavingModules(true);
    try {
      // Find modules that have changed state
      const changes = [];
      for (const [moduleId, enabled] of Object.entries(moduleStates)) {
        if (enabled !== initialModuleStates[moduleId]) {
          changes.push({ moduleId, enabled });
        }
      }

      // Apply each change
      for (const change of changes) {
        if (change.enabled) {
          // Enable module
          const { error } = await supabase
            .rpc('enable_school_module', {
              target_school_id: currentSchool.id,
              target_module_id: change.moduleId
            });
          if (error) throw error;
        } else {
          // Disable module
          const { error } = await supabase
            .rpc('disable_school_module', {
              target_school_id: currentSchool.id,
              target_module_id: change.moduleId
            });
          if (error) throw error;
        }
      }
      
      toast({
        title: "Modules updated",
        description: `${changes.length} module${changes.length !== 1 ? 's' : ''} updated successfully.`,
      });
      
      setShowManageModulesModal(false);
      await loadUserModules();
      await loadAllModules(); // Refresh to get updated states
      
      // Check if the currently selected module was disabled
      if (selectedModule) {
        const wasModuleDisabled = changes.some(change => 
          change.moduleId === selectedModule.module_id && !change.enabled
        );
        
        if (wasModuleDisabled) {
          // Clear selected module and users since the module was disabled
          setSelectedModule(null);
          setModuleUsers([]);
          toast({
            title: "Module deselected",
            description: `${selectedModule.module_display_name} was disabled and removed from selection.`,
          });
        }
      }
      
      // Refresh schools data to update the main dashboard immediately
      await fetchUserSchools();
    } catch (error) {
      console.error('Error updating modules:', error);
      toast({
        title: "Error",
        description: "Failed to update school modules",
        variant: "destructive"
      });
    } finally {
      setSavingModules(false);
    }
  };

  const loadSchoolSuperadmins = async () => {
    if (!currentSchool) return;

    try {
      const { data, error } = await supabase
        .from('user_schools')
        .select(`
          user_id,
          role,
          is_superadmin,
          users!inner(id, name, email)
        `)
        .eq('school_id', currentSchool.id)
        .eq('active', true)
        .eq('role', 'superadmin');

      if (error) throw error;

      const superadmins = (data || []).map((item: any) => ({
        user_id: item.user_id,
        name: item.users.name,
        email: item.users.email,
        role: item.role,
        is_superadmin: item.is_superadmin
      }));

      setSchoolSuperadmins(superadmins);
    } catch (error) {
      console.error('Error loading school superadmins:', error);
    }
  };

  const handleAddSchoolSuperadmin = async () => {
    if (!currentSchool) return;

    // Validation
    const newErrors: Record<string, string> = {};
    if (!schoolSuperadminForm.email.trim()) newErrors.email = 'Email is required';
    if (!schoolSuperadminForm.name.trim()) newErrors.name = 'Name is required';

    if (Object.keys(newErrors).length > 0) {
      setSchoolSuperadminErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      // First, create or get the user
      const { data: userData, error: userError } = await supabase
        .rpc('create_user', {
          user_email: schoolSuperadminForm.email.trim(),
          user_name: schoolSuperadminForm.name.trim()
        });

      if (userError) throw userError;

      // Extract user_id from the array response
      const userId = userData && userData.length > 0 ? userData[0].user_id : null;
      if (!userId) {
        throw new Error('Failed to get user ID from create_user response');
      }

      // Then add them as school superadmin
      const { error: roleError } = await supabase
        .rpc('add_school_superadmin', {
          target_school_id: currentSchool.id,
          target_user_id: userId
        });

      if (roleError) throw roleError;

      toast({
        title: "School superadmin added",
        description: `${schoolSuperadminForm.name} has been added as a school superadmin.`,
      });

      setShowAddSchoolSuperadminModal(false);
      setSchoolSuperadminForm({ email: '', name: '' });
      setSchoolSuperadminErrors({});
      await loadSchoolSuperadmins();
    } catch (error) {
      console.error('Error adding school superadmin:', error);
      toast({
        title: "Error",
        description: "Failed to add school superadmin",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSchoolSuperadmin = async (userId: string, userName: string) => {
    if (!currentSchool) return;

    try {
      const { error } = await supabase
        .rpc('remove_school_superadmin', {
          target_school_id: currentSchool.id,
          target_user_id: userId
        });

      if (error) throw error;

      toast({
        title: "School superadmin removed",
        description: `${userName} has been removed as a school superadmin.`,
      });

      await loadSchoolSuperadmins();
    } catch (error) {
      console.error('Error removing school superadmin:', error);
      toast({
        title: "Error",
        description: "Failed to remove school superadmin",
        variant: "destructive"
      });
    }
  };

  if (!currentSchool) {
    return <div>Loading...</div>;
  }

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-600">
            You need superadmin privileges to manage modules.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Module Management
          </CardTitle>
          <p className="text-sm text-gray-600">
            Manage enabled modules and administrative access for your school
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Available Modules */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">School Modules</h3>
                <Button size="sm" onClick={handleManageModulesClick}>
                  <Plus className="h-4 w-4 mr-1" />
                  Manage Modules
                </Button>
              </div>
              
              <div className="space-y-3">
                {userModules.map((module) => (
                  <div
                    key={module.module_id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedModule?.module_id === module.module_id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleModuleSelect(module)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getModuleIcon(module.module_name)}
                        <div>
                          <h4 className="font-medium">{module.module_display_name}</h4>
                          <p className="text-sm text-gray-600">
                            Your role: 
                            <span className={`ml-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(module.user_role)}`}>
                              {getRoleLabel(module.user_role)}
                            </span>
                          </p>
                        </div>
                      </div>
                      {selectedModule?.module_id === module.module_id && (
                        <div className="text-blue-600">→</div>
                      )}
                    </div>
                  </div>
                ))}
                
                {userModules.length === 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No modules are enabled for this school yet. Add modules to get started.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            {/* Module Users */}
            <div>
              {selectedModule ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">
                      {selectedModule.module_display_name} Admins
                    </h3>
                    <Button 
                      size="sm" 
                      onClick={() => {
                        setFormData({ 
                          email: '', 
                          name: '', 
                          role: 'admin', 
                          moduleId: selectedModule.module_id 
                        });
                        setErrors({});
                        setShowAddUserModal(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Admin
                    </Button>
                  </div>
                  
                  {loading ? (
                    <div className="text-center py-8">Loading users...</div>
                  ) : (
                    <div className="space-y-2">
                      {moduleUsers.map((user) => (
                        <div
                          key={user.user_id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {getRoleIcon(user.user_role)}
                            <div>
                              <div className="font-medium">{user.user_name}</div>
                              <div className="text-sm text-gray-600 flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {user.user_email}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.user_role)}`}>
                              {getRoleLabel(user.user_role)}
                            </span>
                            {user.user_role !== 'superadmin' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRevokeAccess(user.user_id, user.user_name)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {moduleUsers.length === 0 && (
                        <Alert>
                          <Shield className="h-4 w-4" />
                          <AlertDescription>
                            No admin users found for this module. Add administrators to help manage module access.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-600">
                  Select a module to manage its administrators
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* School Superadmin Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            School Superadmin Management
          </CardTitle>
          <p className="text-sm text-gray-600">
            Manage school-level superadmin access for {currentSchool?.name}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">School Superadmins</h3>
            <Button size="sm" onClick={() => setShowAddSchoolSuperadminModal(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Superadmin
            </Button>
          </div>
          
          <div className="space-y-2">
            {schoolSuperadmins.map((superadmin) => (
              <div
                key={superadmin.user_id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-purple-500" />
                  <div>
                    <div className="font-medium">{superadmin.name}</div>
                    <div className="text-sm text-gray-600 flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {superadmin.email}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-full text-xs font-medium text-purple-600 bg-purple-100">
                    School Superadmin
                  </span>
                  {/* Don't allow removing yourself */}
                  {superadmin.user_id !== user?.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveSchoolSuperadmin(superadmin.user_id, superadmin.name)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            
            {schoolSuperadmins.length === 0 && (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  No school superadmins found. Add superadmins to help manage school-wide access.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manage Modules Modal */}
      <Dialog open={showManageModulesModal} onOpenChange={setShowManageModulesModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage School Modules</DialogTitle>
            <DialogDescription>
              Enable or disable modules for {currentSchool?.name}. Each module may require additional payment.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            {allModules.map((module) => {
              const isEnabled = moduleStates[module.id] || false;
              return (
                <div
                  key={module.id}
                  onClick={() => {
                    const newStates = { ...moduleStates, [module.id]: !moduleStates[module.id] };
                    setModuleStates(newStates);
                  }}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 transform hover:scale-[1.02] ${
                    isEnabled 
                      ? 'border-green-500 bg-gradient-to-r from-green-50 to-green-100 shadow-md' 
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl transition-transform duration-200 ${isEnabled ? 'scale-110' : ''}`}>
                        {module.icon || '📋'}
                      </div>
                      <div>
                        <h4 className={`font-medium transition-colors duration-200 ${
                          isEnabled ? 'text-green-900' : 'text-gray-900'
                        }`}>
                          {module.display_name}
                        </h4>
                        <p className={`text-sm transition-colors duration-200 ${
                          isEnabled ? 'text-green-700' : 'text-gray-600'
                        }`}>
                          {module.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {isEnabled ? (
                        <div className="flex items-center gap-2 bg-green-500 text-white px-3 py-1.5 rounded-full text-sm font-medium">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Enabled
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-sm font-medium">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          Disabled
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {allModules.length === 0 && (
              <p className="text-center py-4 text-gray-600">
                No modules are available.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManageModulesModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveModules} disabled={savingModules}>
              {savingModules ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Modal */}
      <Dialog open={showAddUserModal} onOpenChange={(open) => {
        if (!open) {
          setFormData({ email: '', name: '', role: 'admin', moduleId: '' });
          setErrors({});
        }
        setShowAddUserModal(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Module Administrator</DialogTitle>
            <DialogDescription>
              Add a new administrator to manage module access and settings
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleFormChange('email', e.target.value)}
                className={errors.email ? 'border-red-500' : ''}
                placeholder="Enter email address"
              />
              {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                className={errors.name ? 'border-red-500' : ''}
                placeholder="Enter full name"
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="module">Module</Label>
              <Select value={formData.moduleId} onValueChange={(value) => handleFormChange('moduleId', value)}>
                <SelectTrigger className={errors.moduleId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  {userModules.map((module) => (
                    <SelectItem key={module.module_id} value={module.module_id}>
                      {module.module_display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.moduleId && <p className="text-sm text-red-500">{errors.moduleId}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={formData.role} onValueChange={(value) => handleFormChange('role', value)}>
                <SelectTrigger className={errors.role ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="superadmin">Super Administrator</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && <p className="text-sm text-red-500">{errors.role}</p>}
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {formData.role === 'superadmin' 
                  ? 'Super administrators can manage all aspects of the school including adding/removing other admins.'
                  : 'Administrators can manage users and settings for the selected module.'
                }
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setFormData({ email: '', name: '', role: 'admin', moduleId: '' });
                setErrors({});
                setShowAddUserModal(false);
              }} 
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={loading}>
              {loading ? 'Adding...' : 'Add Admin User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add School Superadmin Modal */}
      <Dialog open={showAddSchoolSuperadminModal} onOpenChange={(open) => {
        if (!open) {
          setSchoolSuperadminForm({ email: '', name: '' });
          setSchoolSuperadminErrors({});
        }
        setShowAddSchoolSuperadminModal(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add School Superadmin</DialogTitle>
            <DialogDescription>
              Add a new school-level superadmin who can manage all aspects of {currentSchool?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="school-superadmin-email">Email</Label>
              <Input
                id="school-superadmin-email"
                type="email"
                value={schoolSuperadminForm.email}
                onChange={(e) => {
                  setSchoolSuperadminForm(prev => ({ ...prev, email: e.target.value }));
                  if (schoolSuperadminErrors.email) {
                    setSchoolSuperadminErrors(prev => ({ ...prev, email: '' }));
                  }
                }}
                className={schoolSuperadminErrors.email ? 'border-red-500' : ''}
                placeholder="Enter email address"
              />
              {schoolSuperadminErrors.email && <p className="text-sm text-red-500">{schoolSuperadminErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="school-superadmin-name">Name</Label>
              <Input
                id="school-superadmin-name"
                value={schoolSuperadminForm.name}
                onChange={(e) => {
                  setSchoolSuperadminForm(prev => ({ ...prev, name: e.target.value }));
                  if (schoolSuperadminErrors.name) {
                    setSchoolSuperadminErrors(prev => ({ ...prev, name: '' }));
                  }
                }}
                className={schoolSuperadminErrors.name ? 'border-red-500' : ''}
                placeholder="Enter full name"
              />
              {schoolSuperadminErrors.name && <p className="text-sm text-red-500">{schoolSuperadminErrors.name}</p>}
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                School superadmins have full control over the school including managing modules, users, and all settings. They can also add/remove other superadmins.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSchoolSuperadminForm({ email: '', name: '' });
              setSchoolSuperadminErrors({});
              setShowAddSchoolSuperadminModal(false);
            }} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleAddSchoolSuperadmin} disabled={loading}>
              {loading ? 'Adding...' : 'Add Superadmin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModuleManagement; 