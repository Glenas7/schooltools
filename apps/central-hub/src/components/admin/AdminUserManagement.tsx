import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, AlertTriangle, Shield, ShieldCheck, User, Mail } from 'lucide-react';
import { useSchool, UserRole } from '@schooltools/shared-auth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

const AdminUserManagement = () => {
  const { currentSchool, userRole } = useSchool();
  const { toast } = useToast();
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'admin' as UserRole
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // For admin users, filter to only show other admin users (not superadmins)
  const filteredAdminUsers = userRole === 'admin' 
    ? adminUsers.filter(user => user.role === 'admin')
    : adminUsers;

  const canManageUser = (targetUser: AdminUser) => {
    if (userRole === 'superadmin') return true;
    if (userRole === 'admin' && targetUser.role === 'admin') return true;
    return false;
  };

  const fetchAdminUsers = async () => {
    if (!currentSchool) return;

    setLoading(true);
    try {
      // Try the secure function first (same pattern as TeachersContext)
      try {
        console.log('Attempting secure function call for admin users');
        const { data: adminData, error: adminError } = await supabase
          .rpc('get_school_admins', { target_school_id: currentSchool.id });

        if (adminError) {
          console.log('Function failed, falling back to RLS queries:', adminError.message);
          throw adminError; // Will be caught and trigger fallback
        }

        if (adminData && adminData.length >= 0) {
          console.log('Function succeeded, processing results');
          // Process function results and format for component
          const formattedUsers: AdminUser[] = adminData.map((admin: any) => ({
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            active: admin.active,
            created_at: new Date().toISOString() // Function doesn't return this, but we don't need the exact timestamp
          }));

          console.log('Formatted admin users from function:', formattedUsers);
          setAdminUsers(formattedUsers);
          return; // Success, exit early
        }
      } catch (functionError) {
        console.log('Function approach failed, using RLS fallback');
      }

      // Fallback: Use RLS-based queries (same as before)
      console.log('Admin fallback: Using RLS-based queries');
      
      // Step 1: Get user_schools records for admin/superadmin roles
      const { data: userSchoolsData, error: userSchoolsError } = await supabase
        .from('user_schools')
        .select('user_id, role, active, created_at')
        .eq('school_id', currentSchool.id)
        .in('role', ['admin', 'superadmin'])
        .eq('active', true);

      if (userSchoolsError) {
        throw userSchoolsError;
      }

      if (!userSchoolsData || userSchoolsData.length === 0) {
        setAdminUsers([]);
        return;
      }

      // Step 2: Get user details separately to avoid RLS recursion
      const userIds = userSchoolsData.map(us => us.user_id);
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      if (usersError) {
        throw usersError;
      }

      // Step 3: Combine the data
      const formattedUsers: AdminUser[] = userSchoolsData.map((userSchool: any) => {
        const user = usersData?.find(u => u.id === userSchool.user_id);
        
        return {
          id: userSchool.user_id,
          name: user?.name || 'Unknown',
          email: user?.email || 'Unknown',
          role: userSchool.role,
          active: userSchool.active,
          created_at: userSchool.created_at
        };
      });

      console.log('Formatted admin users from RLS fallback:', formattedUsers);
      setAdminUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch admin users.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminUsers();
  }, [currentSchool]);

  // Only admins and super admins can access this component
  if (!userRole || !['admin', 'superadmin'].includes(userRole)) {
    return null;
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddUser = async () => {
    if (!validateForm() || !currentSchool) return;

    setLoading(true);
    try {
      // Get the user's session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('User session not found. Please log in again.');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          name: formData.name.trim(),
          school_id: currentSchool.id,
          role: formData.role
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to create admin user: ${errorData}`);
      }

      const responseData = await response.json();

      // Optimistically add the user to the list immediately
      const newUser: AdminUser = {
        id: responseData.id,
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        active: true,
        created_at: new Date().toISOString()
      };
      setAdminUsers(prev => [...prev, newUser]);

      toast({
        title: "Admin user added",
        description: `${formData.name} has been added as ${formData.role === 'superadmin' ? 'a super admin' : 'an admin'}.`,
      });

      // Reset form and close dialog
      setFormData({ 
        email: '', 
        name: '', 
        role: userRole === 'admin' ? 'admin' : 'admin'
      });
      setIsAddDialogOpen(false);
      setErrors({});
      
      // Refresh the list with retry mechanism to ensure consistency
      await refreshAdminUsersWithRetry(responseData.id);
    } catch (error) {
      console.error('Error adding admin user:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add admin user. The email may already be in use.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshAdminUsersWithRetry = async (newUserId?: string, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add a small delay to allow database propagation
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }

        // If we have a new user ID, check if it exists using the same pattern as fetchAdminUsers
        if (newUserId) {
          const { data: checkData } = await supabase
            .from('user_schools')
            .select('user_id, role, active, created_at')
            .eq('school_id', currentSchool!.id)
            .eq('user_id', newUserId)
            .in('role', ['admin', 'superadmin'])
            .eq('active', true);

          if (checkData && checkData.length > 0) {
            // User found, now fetch all admin users
            await fetchAdminUsers();
            break;
          } else if (attempt === maxRetries) {
            // Max retries reached, fetch anyway and show warning
            await fetchAdminUsers();
            toast({
              title: "Warning",
              description: "User was created but may not appear in the list immediately. Please refresh the page if needed.",
              variant: "destructive"
            });
            break;
          }
        } else {
          // No specific user to check for, just fetch
          await fetchAdminUsers();
          break;
        }
      } catch (error) {
        console.error(`Attempt ${attempt} to refresh admin users failed:`, error);
        if (attempt === maxRetries) {
          await fetchAdminUsers(); // Try one final fetch
          toast({
            title: "Warning",
            description: "User was created but the list may not show the latest data. Please refresh the page.",
            variant: "destructive"
          });
        }
      }
    }
  };

  const handleRemoveUser = async () => {
    if (!userToRemove || !currentSchool) return;

    setLoading(true);
    try {
      console.log('Attempting to remove user:', userToRemove.id, 'from school:', currentSchool.id);
      
      // Use the secure function to remove the admin user
      const { data, error } = await supabase
        .rpc('remove_school_admin', {
          target_school_id: currentSchool.id,
          target_user_id: userToRemove.id
        });

      console.log('Remove admin function result:', { data, error });

      if (error) {
        console.error('Remove admin error details:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No user_schools record was deleted. User may not have admin role.');
      }

      console.log('Admin removal successful');

      toast({
        title: "Admin user removed",
        description: `${userToRemove.name} has been removed from the admin team.`,
      });

      setIsRemoveDialogOpen(false);
      setUserToRemove(null);
      
      // Remove from local state immediately for better UX
      setAdminUsers(prev => prev.filter(user => user.id !== userToRemove.id));
      
      // Refresh the list with retry mechanism
      await refreshAdminUsersWithRetry();
    } catch (error) {
      console.error('Error removing admin user:', error);
      toast({
        title: "Error",
        description: `Failed to remove admin user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
      
      // Revert the optimistic update since it failed
      await fetchAdminUsers();
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'superadmin':
        return <ShieldCheck className="h-4 w-4 text-purple-600" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />;
      default:
        return <User className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'superadmin':
        return 'Super Admin';
      case 'admin':
        return 'Administrator';
      default:
        return role;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Admin User Management
        </CardTitle>
        <CardDescription>
          {userRole === 'admin' 
            ? `Manage administrators for ${currentSchool?.name}`
            : `Manage administrators and super administrators for ${currentSchool?.name}`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-muted-foreground">
            {filteredAdminUsers.length} admin user{filteredAdminUsers.length !== 1 ? 's' : ''}
          </p>
          <Button onClick={() => {
            // Reset form and ensure admin users default to 'admin' role
            setFormData({ 
              email: '', 
              name: '', 
              role: userRole === 'admin' ? 'admin' : 'admin'
            });
            setErrors({});
            setIsAddDialogOpen(true);
          }} disabled={loading}>
            <Plus className="h-4 w-4 mr-1" />
            Add Admin User
          </Button>
        </div>

        {filteredAdminUsers.length === 0 ? (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              {userRole === 'admin' 
                ? `No other admin users found. Add administrators to help manage ${currentSchool?.name}.`
                : `No admin users found. Add administrators or super administrators to help manage ${currentSchool?.name}.`
              }
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {filteredAdminUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getRoleIcon(user.role)}
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 bg-muted rounded-md">
                    {getRoleLabel(user.role)}
                  </span>
                  {canManageUser(user) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUserToRemove(user);
                        setIsRemoveDialogOpen(true);
                      }}
                      disabled={loading}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add User Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          if (!open) {
            // Reset form when dialog is closed
            setFormData({ email: '', name: '', role: 'admin' });
            setErrors({});
          }
          setIsAddDialogOpen(open);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Admin User</DialogTitle>
              <DialogDescription>
                {userRole === 'admin' 
                  ? `Add a new administrator to ${currentSchool?.name}`
                  : `Add a new administrator or super administrator to ${currentSchool?.name}`
                }
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
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => handleFormChange('role', value)}>
                  <SelectTrigger className={errors.role ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    {userRole === 'superadmin' && (
                      <SelectItem value="superadmin">Super Administrator</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {errors.role && <p className="text-sm text-red-500">{errors.role}</p>}
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {formData.role === 'superadmin' 
                    ? 'Super administrators can manage all aspects of the school including adding/removing other admins.'
                    : 'Administrators can manage teachers, subjects, lessons, and school settings.'
                  }
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setFormData({ email: '', name: '', role: 'admin' });
                setErrors({});
                setIsAddDialogOpen(false);
              }} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleAddUser} disabled={loading}>
                {loading ? 'Adding...' : 'Add Admin User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove User Confirmation Dialog */}
        <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Admin User</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove {userToRemove?.name} from the admin team?
              </DialogDescription>
            </DialogHeader>
            
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will remove their admin access to {currentSchool?.name}. They will no longer be able to manage the school.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRemoveDialogOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRemoveUser} disabled={loading}>
                {loading ? 'Removing...' : 'Remove Admin User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AdminUserManagement; 