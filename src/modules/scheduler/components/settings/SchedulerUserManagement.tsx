import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Trash2, Plus, AlertTriangle, Shield, ShieldCheck, User, Mail, Calendar } from 'lucide-react';
import { useSchool } from '@/core/contexts';
import { ModuleUser } from '../../types';
import { useToast } from '@/shared/components/ui/use-toast';
import { supabase } from '@/core/lib/supabaseClient';

interface SchedulerUser {
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  granted_by?: string;
  granted_at?: string;
}

const SchedulerUserManagement = () => {
  const { currentSchool, userRole } = useSchool();
  const { toast } = useToast();
  const [schedulerUsers, setSchedulerUsers] = useState<SchedulerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<SchedulerUser | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'admin'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load scheduler module users
  const fetchSchedulerUsers = async () => {
    if (!currentSchool) return;

    setLoading(true);
    try {
      // Get the scheduler module ID
      const { data: schedulerModule, error: moduleError } = await supabase
        .from('modules')
        .select('id')
        .eq('name', 'scheduler')
        .single();

      if (moduleError || !schedulerModule) {
        console.error('Error finding scheduler module:', moduleError);
        return;
      }

      // Get users with access to the scheduler module for this school
      const { data: moduleUsers, error: usersError } = await supabase
        .rpc('get_module_users_for_school', {
          target_school_id: currentSchool.id,
          target_module_id: schedulerModule.id
        });

      if (usersError) {
        console.error('Error fetching scheduler users:', usersError);
        return;
      }

      // Filter to only show admin roles (superadmin and admin)
      const adminUsers = (moduleUsers || []).filter((user: ModuleUser) => 
        user.user_role === 'superadmin' || user.user_role === 'admin'
      );

      setSchedulerUsers(adminUsers.map((user: ModuleUser) => ({
        user_id: user.user_id,
        user_name: user.user_name,
        user_email: user.user_email,
        user_role: user.user_role,
        granted_by: user.granted_by,
        granted_at: user.granted_at
      })));
    } catch (error) {
      console.error('Error loading scheduler users:', error);
      toast({
        title: "Error",
        description: "Failed to load scheduler users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentSchool) {
      fetchSchedulerUsers();
    }
  }, [currentSchool]);

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

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

      // Call the enhanced create-user edge function that handles everything
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
          role: formData.role,
          module_name: 'scheduler' // Grant access to scheduler module
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add user');
      }

      const responseData = await response.json();
      
      // Determine appropriate success message based on what happened
      let successMessage = '';
      if (responseData.created) {
        successMessage = `${formData.name} has been created and added as ${getRoleLabel(formData.role)} to the scheduler. They can reset their password to gain access.`;
      } else if (responseData.school_membership_changed || responseData.module_access_granted) {
        successMessage = `${formData.name} has been added as ${getRoleLabel(formData.role)} to the scheduler.`;
      } else {
        successMessage = `${formData.name} already has ${getRoleLabel(formData.role)} access to the scheduler.`;
      }

      toast({
        title: "User added",
        description: successMessage,
      });

      setIsAddDialogOpen(false);
      setFormData({ email: '', name: '', role: 'admin' });
      setErrors({});
      fetchSchedulerUsers();
    } catch (error) {
      console.error('Error adding user:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add user to scheduler",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async () => {
    if (!userToRemove || !currentSchool) return;

    setLoading(true);
    try {
      // Get the scheduler module ID
      const { data: schedulerModule, error: moduleError } = await supabase
        .from('modules')
        .select('id')
        .eq('name', 'scheduler')
        .single();

      if (moduleError || !schedulerModule) {
        throw new Error('Scheduler module not found');
      }

      // Revoke access from the scheduler module
      const { error: revokeError } = await supabase
        .rpc('revoke_module_access', {
          target_user_id: userToRemove.user_id,
          target_school_id: currentSchool.id,
          target_module_id: schedulerModule.id
        });

      if (revokeError) throw revokeError;

      toast({
        title: "User removed",
        description: `${userToRemove.user_name} has been removed from the scheduler.`,
      });

      setIsRemoveDialogOpen(false);
      setUserToRemove(null);
      fetchSchedulerUsers();
    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        title: "Error",
        description: "Failed to remove user from scheduler",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const canManageUser = (targetUser: SchedulerUser) => {
    if (userRole === 'superadmin') return true;
    if (userRole === 'admin' && targetUser.user_role === 'admin') return true;
    return false;
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'superadmin':
        return <ShieldCheck className="h-4 w-4 text-purple-600" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />;
      default:
        return <User className="h-4 w-4 text-gray-600" />;
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Scheduler User Management
        </CardTitle>
        <CardDescription>
          {userRole === 'admin' 
            ? `Manage scheduler administrators for ${currentSchool?.name}`
            : `Manage scheduler administrators and super administrators for ${currentSchool?.name}`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Scheduler Administrators</h3>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Admin
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading users...</div>
        ) : (
          <div className="space-y-2">
            {schedulerUsers.map((user) => (
              <div
                key={user.user_id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getRoleIcon(user.user_role)}
                  <div>
                    <div className="font-medium">{user.user_name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {user.user_email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 bg-muted rounded-md">
                    {getRoleLabel(user.user_role)}
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

            {schedulerUsers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No scheduler administrators found.
              </div>
            )}
          </div>
        )}

        {/* Add User Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Scheduler Administrator</DialogTitle>
              <DialogDescription>
                Add a new administrator who can manage the scheduler for {currentSchool?.name}. 
                They will receive an account and can reset their password to gain access.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  className={errors.name ? 'border-red-500' : ''}
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
                    ? 'Super administrators can manage all aspects of the scheduler including adding/removing other admins.'
                    : 'Administrators can manage teachers, subjects, lessons, and scheduler settings.'
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
              <DialogTitle>Remove Scheduler Administrator</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove {userToRemove?.user_name} from the scheduler? 
                They will lose access to manage the scheduler for this school.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRemoveDialogOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRemoveUser} disabled={loading}>
                {loading ? 'Removing...' : 'Remove User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default SchedulerUserManagement; 