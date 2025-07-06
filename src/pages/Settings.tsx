import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Check, X, AlertTriangle, RefreshCw, Zap, ExternalLink, Save, Calendar, Building2, Copy, Download, Upload, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { compareLessons, ComparisonResult, SheetLesson, DbLesson, wouldCauseConflict, alignLessonWithSheet } from '../lib/lessonComparisonService';
import { useToast } from '@/hooks/use-toast';
import { useSchool } from '../contexts/SchoolContext';
import { supabase } from '../lib/supabaseClient';
import AdminUserManagement from '../components/settings/AdminUserManagement';
import { useStudentNames } from '../hooks/useStudentNames';
import { exportLessonsToSheet, updateExportSettings } from '../lib/exportLessonsService';

const Settings = () => {
  const { user } = useAuth();
  const { isSchoolAdmin, currentSchool, refreshSchool, userRole } = useSchool();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult | null>(null);
  const [aligningStatus, setAligningStatus] = useState<{ [key: string]: { loading: boolean; error: string | null; conflict: boolean; conflictMessage: string | null } }>({});
  const { toast } = useToast();
  const { invalidateStudentNames, refreshStudentNames, isLoading: isLoadingStudents } = useStudentNames();

  // Google Sheet URL state
  const [googleSheetUrl, setGoogleSheetUrl] = useState(currentSchool?.google_sheet_url || '');
  const [googleSheetName, setGoogleSheetName] = useState(currentSchool?.google_sheet_name || 'Sheet1');
  const [googleSheetRange, setGoogleSheetRange] = useState(currentSchool?.google_sheet_range || 'A2:A');
  const [isSavingSheetUrl, setIsSavingSheetUrl] = useState(false);

  // Lessons Google Sheet state
  const [lessonsGoogleSheetUrl, setLessonsGoogleSheetUrl] = useState(currentSchool?.google_sheet_lessons_url || '');
  const [lessonsGoogleSheetName, setLessonsGoogleSheetName] = useState(currentSchool?.google_sheet_lessons_name || 'lessons');
  const [lessonsGoogleSheetRange, setLessonsGoogleSheetRange] = useState(currentSchool?.google_sheet_lessons_range || 'A1:E1000');
  const [isSavingLessonsSheetUrl, setIsSavingLessonsSheetUrl] = useState(false);

  // School year end date state
  const [schoolYearEndDate, setSchoolYearEndDate] = useState(currentSchool?.school_year_end_date || '');
  const [isSavingSchoolYear, setIsSavingSchoolYear] = useState(false);
  const [isUpdatingLessonEndDates, setIsUpdatingLessonEndDates] = useState(false);
  const [lessonsWithoutEndDateCount, setLessonsWithoutEndDateCount] = useState<number | null>(null);
  const [isFetchingLessonCount, setIsFetchingLessonCount] = useState(false);

  // School name editing state (superadmin only)
  const [schoolName, setSchoolName] = useState(currentSchool?.name || '');
  const [isSavingSchoolName, setIsSavingSchoolName] = useState(false);

  // School description editing state (superadmin only)
  const [schoolDescription, setSchoolDescription] = useState(currentSchool?.description || '');
  const [isSavingSchoolDescription, setIsSavingSchoolDescription] = useState(false);

  // Export lessons state
  const [exportGoogleSheetUrl, setExportGoogleSheetUrl] = useState(currentSchool?.export_google_sheet_url || '');
  const [exportGoogleSheetTab, setExportGoogleSheetTab] = useState(currentSchool?.export_google_sheet_tab || 'lessons');
  const [autoExportFrequency, setAutoExportFrequency] = useState(currentSchool?.auto_export_frequency || 'none');
  const [isSavingExportSettings, setIsSavingExportSettings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportLogs, setExportLogs] = useState<any[]>([]);
  const [isLoadingExportLogs, setIsLoadingExportLogs] = useState(false);

  // Sync google sheet state when currentSchool changes
  useEffect(() => {
    setGoogleSheetUrl(currentSchool?.google_sheet_url || '');
    setGoogleSheetName(currentSchool?.google_sheet_name || 'Sheet1');
    setGoogleSheetRange(currentSchool?.google_sheet_range || 'A2:A');
    
    setLessonsGoogleSheetUrl(currentSchool?.google_sheet_lessons_url || '');
    setLessonsGoogleSheetName(currentSchool?.google_sheet_lessons_name || 'lessons');
    setLessonsGoogleSheetRange(currentSchool?.google_sheet_lessons_range || 'A1:E1000');
    
    setSchoolYearEndDate(currentSchool?.school_year_end_date || '');
    setSchoolName(currentSchool?.name || '');
    setSchoolDescription(currentSchool?.description || '');
    
    setExportGoogleSheetUrl(currentSchool?.export_google_sheet_url || '');
    setExportGoogleSheetTab(currentSchool?.export_google_sheet_tab || 'lessons');
    setAutoExportFrequency(currentSchool?.auto_export_frequency || 'none');
  }, [
    currentSchool?.google_sheet_url, 
    currentSchool?.google_sheet_name, 
    currentSchool?.google_sheet_range,
    currentSchool?.google_sheet_lessons_url,
    currentSchool?.google_sheet_lessons_name,
    currentSchool?.google_sheet_lessons_range,
    currentSchool?.school_year_end_date,
    currentSchool?.name,
    currentSchool?.description,
    currentSchool?.export_google_sheet_url,
    currentSchool?.export_google_sheet_tab,
    currentSchool?.auto_export_frequency
  ]);

  // Fetch lesson count without end dates when school changes
  useEffect(() => {
    if (currentSchool?.id) {
      fetchLessonsWithoutEndDateCount();
      fetchExportLogs();
    }
  }, [currentSchool?.id]);

  // Redirect non-admin users (school-specific admin check)
  if (!isSchoolAdmin) {
    return <Navigate to="/" />;
  }

  const fetchLessonsWithoutEndDateCount = async () => {
    if (!currentSchool?.id) return;
    
    setIsFetchingLessonCount(true);
    try {
      const { data, error } = await supabase
        .rpc('count_lessons_without_end_date', { p_school_id: currentSchool.id });

      if (error) {
        throw error;
      }

      setLessonsWithoutEndDateCount(data || 0);
    } catch (error) {
      console.error('Error fetching lessons without end date count:', error);
      setLessonsWithoutEndDateCount(null);
    } finally {
      setIsFetchingLessonCount(false);
    }
  };

  const fetchExportLogs = async () => {
    if (!currentSchool?.id) return;
    
    setIsLoadingExportLogs(true);
    try {
      const { data, error } = await supabase
        .from('export_logs')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        throw error;
      }

      setExportLogs(data || []);
    } catch (error) {
      console.error('Error fetching export logs:', error);
      setExportLogs([]);
    } finally {
      setIsLoadingExportLogs(false);
    }
  };

  const handleSaveGoogleSheetUrl = async () => {
    if (!currentSchool) return;
    
    setIsSavingSheetUrl(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ 
          google_sheet_url: googleSheetUrl || null,
          google_sheet_name: googleSheetName || 'Sheet1',
          google_sheet_range: googleSheetRange || 'A2:A'
        })
        .eq('id', currentSchool.id);

      if (error) {
        throw error;
      }

      await refreshSchool();
      
      // Invalidate student names cache to refresh with new Google Sheet data
      invalidateStudentNames();
      
      toast({
        title: "Google Sheet configuration updated",
        description: "The Google Sheet settings have been saved successfully. Student data will refresh automatically.",
      });
    } catch (error) {
      console.error('Error updating Google Sheet configuration:', error);
      toast({
        title: "Error",
        description: "Failed to update Google Sheet configuration. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSavingSheetUrl(false);
    }
  };

  const handleSaveLessonsGoogleSheetUrl = async () => {
    if (!currentSchool) return;
    
    setIsSavingLessonsSheetUrl(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ 
          google_sheet_lessons_url: lessonsGoogleSheetUrl || null,
          google_sheet_lessons_name: lessonsGoogleSheetName || 'lessons',
          google_sheet_lessons_range: lessonsGoogleSheetRange || 'A1:E1000'
        })
        .eq('id', currentSchool.id);

      if (error) {
        throw error;
      }

      await refreshSchool();
      
      toast({
        title: "Lessons Google Sheet configuration updated",
        description: "The lessons Google Sheet settings have been saved successfully.",
      });
    } catch (error) {
      console.error('Error updating lessons Google Sheet configuration:', error);
      toast({
        title: "Error",
        description: "Failed to update lessons Google Sheet configuration. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSavingLessonsSheetUrl(false);
    }
  };

  const handleCheckLessons = async () => {
    if (!currentSchool) {
      setError('No school selected');
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsModalOpen(true);
    setAligningStatus({});
    
    try {
      // Call the comparison service with school ID
      const results = await compareLessons(currentSchool.id);
      setComparisonResults(results);
      
      // Display a message if no mismatches found
      if (
        results.missingInDb.length === 0 && 
        results.missingInSheet.length === 0 && 
        results.mismatched.length === 0
      ) {
        console.log('All lessons match between database and Google Sheets!');
      }
    } catch (err) {
      console.error('Error comparing lessons:', err);
      setError('Failed to compare lessons: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAlignWithSheet = async (dbLesson: DbLesson, sheetLesson: SheetLesson) => {
    const lessonId = dbLesson.id;
    
    if (!currentSchool?.id) {
      toast({
        title: "Error",
        description: "No school selected",
        variant: "destructive"
      });
      return;
    }
    
    // Set loading state
    setAligningStatus(prev => ({
      ...prev,
      [lessonId]: { loading: true, error: null, conflict: false, conflictMessage: null }
    }));
    
    try {
      // Step 1: Check for conflicts first
      const { hasConflict, conflictMessage } = await wouldCauseConflict(dbLesson, sheetLesson, currentSchool.id);
      
      if (hasConflict) {
        setAligningStatus(prev => ({
          ...prev,
          [lessonId]: { loading: false, error: null, conflict: true, conflictMessage }
        }));
        
        toast({
          title: "Cannot align lesson",
          description: conflictMessage || "Would cause a scheduling conflict",
          variant: "destructive"
        });
        
        return;
      }
      
      // Step 2: If no conflicts, perform the alignment
      const result = await alignLessonWithSheet(dbLesson, sheetLesson, currentSchool.id);
      
      if (result.success) {
        toast({
          title: "Lesson aligned",
          description: "Successfully aligned lesson with Google Sheet data",
        });
        
        // Update the comparison results
        if (comparisonResults) {
          // Create updated mismatched array without this aligned lesson
          const updatedMismatched = comparisonResults.mismatched.filter(
            mismatch => mismatch.dbLesson.id !== lessonId
          );
          
          // Add this lesson to matched array
          const newMatched = [
            ...comparisonResults.matched,
            { dbLesson: result.updatedLesson!, sheetLesson }
          ];
          
          setComparisonResults({
            ...comparisonResults,
            mismatched: updatedMismatched,
            matched: newMatched
          });
        }
        
        // Clear the aligning status for this lesson
        setAligningStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[lessonId];
          return newStatus;
        });
      } else {
        setAligningStatus(prev => ({
          ...prev,
          [lessonId]: { 
            loading: false, 
            error: result.message, 
            conflict: false,
            conflictMessage: null 
          }
        }));
        
        toast({
          title: "Failed to align lesson",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Error aligning lesson:', err);
      
      setAligningStatus(prev => ({
        ...prev,
        [lessonId]: { 
          loading: false, 
          error: err.message || 'Failed to align lesson', 
          conflict: false,
          conflictMessage: null 
        }
      }));
      
      toast({
        title: "Error",
        description: err.message || "Failed to align lesson with Google Sheet data",
        variant: "destructive"
      });
    }
  };

  const handleSaveSchoolYearEndDate = async () => {
    if (!currentSchool) return;
    
    setIsSavingSchoolYear(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ 
          school_year_end_date: schoolYearEndDate || null
        })
        .eq('id', currentSchool.id);

      if (error) {
        throw error;
      }

      await refreshSchool();
      
      toast({
        title: "School year end date saved",
        description: "The school year end date has been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating school year end date:', error);
      toast({
        title: "Error",
        description: "Failed to update school year end date. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSavingSchoolYear(false);
    }
  };

  const handleBulkUpdateLessonEndDates = async () => {
    if (!currentSchool?.id || !schoolYearEndDate) return;
    
    setIsUpdatingLessonEndDates(true);
    try {
      const { data, error } = await supabase
        .rpc('bulk_update_lesson_end_dates', { 
          p_school_id: currentSchool.id,
          p_end_date: new Date(new Date(schoolYearEndDate).getTime() + 24*60*60*1000).toISOString().split('T')[0]
        });

      if (error) {
        throw error;
      }

      // Refresh the count after update
      await fetchLessonsWithoutEndDateCount();
      
      toast({
        title: "Lesson end dates updated",
        description: `Successfully updated end dates for ${data || 0} lessons.`,
      });
    } catch (error: any) {
      console.error('Error updating lesson end dates:', error);
      toast({
        title: "Error",
        description: `Failed to update lesson end dates: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsUpdatingLessonEndDates(false);
    }
  };

  const handleSaveSchoolName = async () => {
    if (!currentSchool || !schoolName.trim()) return;
    
    setIsSavingSchoolName(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ name: schoolName.trim() })
        .eq('id', currentSchool.id);

      if (error) {
        throw error;
      }

      await refreshSchool();
      
      toast({
        title: "School name updated",
        description: "The school name has been updated successfully.",
      });
    } catch (error: any) {
      console.error('Error updating school name:', error);
      toast({
        title: "Error",
        description: `Failed to update school name: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsSavingSchoolName(false);
    }
  };

  const handleSaveSchoolDescription = async () => {
    if (!currentSchool || !schoolDescription.trim()) return;
    
    setIsSavingSchoolDescription(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ description: schoolDescription.trim() })
        .eq('id', currentSchool.id);

      if (error) {
        throw error;
      }

      await refreshSchool();
      
      toast({
        title: "School description updated",
        description: "The school description has been updated successfully.",
      });
    } catch (error: any) {
      console.error('Error updating school description:', error);
      toast({
        title: "Error",
        description: `Failed to update school description: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsSavingSchoolDescription(false);
    }
  };

  const copyJoinCode = async () => {
    if (!currentSchool?.join_code) return;
    
    try {
      await navigator.clipboard.writeText(currentSchool.join_code);
      toast({
        title: "Join code copied",
        description: "The join code has been copied to your clipboard.",
      });
    } catch (error) {
      console.error('Error copying join code:', error);
      toast({
        title: "Error",
        description: "Failed to copy join code to clipboard.",
        variant: "destructive"
      });
    }
  };

  const handleSaveExportSettings = async () => {
    if (!currentSchool) return;
    
    setIsSavingExportSettings(true);
    try {
      const result = await updateExportSettings(currentSchool.id, {
        export_google_sheet_url: exportGoogleSheetUrl || null,
        export_google_sheet_tab: exportGoogleSheetTab || 'lessons',
        auto_export_frequency: autoExportFrequency
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save export settings');
      }

      await refreshSchool();
      
      toast({
        title: "Export settings saved",
        description: "The lesson export settings have been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving export settings:', error);
      toast({
        title: "Error",
        description: "Failed to save export settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSavingExportSettings(false);
    }
  };

  const handleExportLessons = async () => {
    if (!currentSchool) return;
    
    if (!exportGoogleSheetUrl) {
      toast({
        title: "Configuration required",
        description: "Please configure the export Google Sheet URL first.",
        variant: "destructive"
      });
      return;
    }
    
    setIsExporting(true);
    try {
      const result = await exportLessonsToSheet(currentSchool.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to export lessons');
      }
      
      toast({
        title: "Export successful",
        description: result.message,
      });
      
      // Refresh export logs to show the latest export
      await fetchExportLogs();
    } catch (error) {
      console.error('Error exporting lessons:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : 'Failed to export lessons. Please try again.',
        variant: "destructive"
      });
      
      // Refresh export logs to show any error logs
      await fetchExportLogs();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      {/* Join Code Display Section - For Admins and Super Admins */}
      {currentSchool?.join_code && (
        <Card className="mb-6 border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Copy className="h-5 w-5 mr-2" />
              School Join Code
            </CardTitle>
            <CardDescription>Share this code with teachers to allow them to join your school</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="bg-gray-100 p-3 rounded-lg flex-1">
                <code className="text-lg font-mono font-semibold text-gray-800">
                  {currentSchool.join_code}
                </code>
              </div>
              <Button 
                onClick={copyJoinCode}
                variant="outline"
                size="sm"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Teachers can use this code on the school selection page to request access to join your school.
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* School Name Management Section - Only for Super Admins */}
      {userRole === 'superadmin' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              School Management
            </CardTitle>
            <CardDescription>Manage basic school information (Super Admin only)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="school-name">School Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="school-name"
                    type="text"
                    placeholder="Enter school name"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSaveSchoolName}
                    disabled={isSavingSchoolName || !schoolName.trim() || schoolName === currentSchool?.name}
                    size="sm"
                    variant="outline"
                  >
                    {isSavingSchoolName ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Change the name of the school. This will be reflected throughout the application.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="school-description">School Description</Label>
                <div className="flex gap-2">
                  <Input
                    id="school-description"
                    type="text"
                    placeholder="Enter school description (optional)"
                    value={schoolDescription}
                    onChange={(e) => setSchoolDescription(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSaveSchoolDescription}
                    disabled={isSavingSchoolDescription || schoolDescription === currentSchool?.description}
                    size="sm"
                    variant="outline"
                  >
                    {isSavingSchoolDescription ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Add or change the school description. This will help with school identification.
                </p>
              </div>
            </div>
            
            <div className="bg-amber-50 p-4 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 mr-2 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-900 mb-1">Important Note</h4>
                  <p className="text-sm text-amber-800">
                    Changing the school name and description will update them everywhere in the application. Make sure this is intentional as it affects all users and reports.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* School Year Management Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            School Year Management
          </CardTitle>
          <CardDescription>Set school year end date and bulk update lesson schedules</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="school-year-end-date">School Year End Date</Label>
              <div className="flex gap-2">
                <Input
                  id="school-year-end-date"
                  type="date"
                  value={schoolYearEndDate}
                  onChange={(e) => setSchoolYearEndDate(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSaveSchoolYearEndDate}
                  disabled={isSavingSchoolYear}
                  size="sm"
                  variant="outline"
                >
                  {isSavingSchoolYear ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Set the last day of the school year (inclusive). This will be used to calculate lesson end dates.
              </p>
            </div>

            {schoolYearEndDate && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Bulk Update Lesson End Dates</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-800">
                      Lessons without end dates: 
                    </span>
                    <span className="font-semibold text-blue-900">
                      {isFetchingLessonCount ? (
                        <Loader2 className="h-4 w-4 animate-spin inline" />
                      ) : (
                        lessonsWithoutEndDateCount !== null ? lessonsWithoutEndDateCount : 'Unknown'
                      )}
                    </span>
                  </div>
                  
                  {lessonsWithoutEndDateCount !== null && lessonsWithoutEndDateCount > 0 && (
                    <>
                      <p className="text-sm text-blue-800">
                        Click the button below to set end date to <strong>{new Date(new Date(schoolYearEndDate).getTime() + 24*60*60*1000).toLocaleDateString('en-GB')}</strong> for all lessons that don't have an end date yet.
                      </p>
                      <p className="text-xs text-blue-700">
                        Note: End dates are exclusive, so this sets the end date to 1 day after the school year end to make the school year end date inclusive.
                      </p>
                      <Button 
                        onClick={handleBulkUpdateLessonEndDates}
                        disabled={isUpdatingLessonEndDates || !schoolYearEndDate}
                        className="w-full"
                        variant="default"
                      >
                        {isUpdatingLessonEndDates ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Updating lesson end dates...
                          </>
                        ) : (
                          <>
                            <Calendar className="h-4 w-4 mr-2" />
                            Apply End Date to {lessonsWithoutEndDateCount} Lessons
                          </>
                        )}
                      </Button>
                    </>
                  )}
                  
                  {lessonsWithoutEndDateCount === 0 && (
                    <div className="flex items-center text-green-700">
                      <Check className="h-4 w-4 mr-2" />
                      All lessons already have end dates
                    </div>
                  )}
                </div>
              </div>
            )}

            {!schoolYearEndDate && (
              <div className="bg-amber-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2 text-amber-600" />
                  <span className="text-sm text-amber-800">
                    Set a school year end date to enable bulk updating of lesson end dates.
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Student Google Sheet Configuration Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Students Google Sheet Configuration</CardTitle>
          <CardDescription>Configure student google sheet settings for {currentSchool?.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="google-sheet-url">Google Sheet URL</Label>
            <div className="flex gap-2">
              <Input
                id="google-sheet-url"
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={googleSheetUrl}
                onChange={(e) => setGoogleSheetUrl(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleSaveGoogleSheetUrl}
                disabled={isSavingSheetUrl}
                size="sm"
              >
                {isSavingSheetUrl ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Enter the URL of your Google Sheet containing student data. Remember you will need to grant at least read-only access to this email for us to be able to use its contents: schooltools@schooltools-459418.iam.gserviceaccount.com.
              {googleSheetUrl && (
                <a 
                  href={googleSheetUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center text-blue-600 hover:text-blue-800"
                >
                  View Sheet <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              )}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="google-sheet-name">Sheet Name</Label>
              <Input
                id="google-sheet-name"
                type="text"
                placeholder="Sheet1"
                value={googleSheetName}
                onChange={(e) => setGoogleSheetName(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Name of the worksheet tab (e.g., "Sheet1", "Students", etc.)
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="google-sheet-range">Range</Label>
              <Input
                id="google-sheet-range"
                type="text"
                placeholder="A2:A"
                value={googleSheetRange}
                onChange={(e) => setGoogleSheetRange(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Cell range for student names (e.g., "A2:A", "B1:B100")
              </p>
            </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-lg">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 mr-2 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-900 mb-1">Useful tip:</h4>
                <p className="text-sm text-amber-800">
                  Include all information you want about a student in the column of the google sheet that you reference here. For example, if knowing the student's year group is important, instead of just having a column with student names like "Alice Smith", have a column with "Alice Smith, Year 7A". This way, you can customize what information you want to see in the schedules.
                </p>
              </div>
            </div>
          </div>
          
                      <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 mb-2">Configuration Summary</h4>
                <p className="text-sm text-blue-800">
                  Student names will be read from <strong>{googleSheetName || 'Sheet1'}</strong> 
                  {' '}in range <strong>{googleSheetRange || 'A2:A'}</strong>
                  {googleSheetUrl ? ' of your configured Google Sheet.' : '. Please configure a Google Sheet URL first.'}
                </p>
              </div>
              {googleSheetUrl && (
                <Button 
                  onClick={async () => {
                    try {
                      await refreshStudentNames();
                      toast({
                        title: "Student data refreshed",
                        description: "Student names have been reloaded from Google Sheets.",
                      });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to refresh student data. Please check your Google Sheet configuration.",
                        variant: "destructive"
                      });
                    }
                  }}
                  disabled={isLoadingStudents}
                  size="sm"
                  variant="outline"
                  className="ml-4 flex-shrink-0"
                >
                  {isLoadingStudents ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh Students
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lessons Google Sheet Configuration Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Lessons Google Sheet Configuration</CardTitle>
          <CardDescription>Configure Google Sheets integration for lessons comparison and sync</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="lessons-google-sheet-url">Lessons Google Sheet URL</Label>
            <div className="flex gap-2">
              <Input
                id="lessons-google-sheet-url"
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={lessonsGoogleSheetUrl}
                onChange={(e) => setLessonsGoogleSheetUrl(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleSaveLessonsGoogleSheetUrl}
                disabled={isSavingLessonsSheetUrl}
                size="sm"
              >
                {isSavingLessonsSheetUrl ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Enter the URL of your Google Sheet containing lessons data for comparison. Remember you will need to grant at least read-only access to this email for us to be able to use its contents: schooltools@schooltools-459418.iam.gserviceaccount.com. 
              {lessonsGoogleSheetUrl && (
                <a 
                  href={lessonsGoogleSheetUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center text-blue-600 hover:text-blue-800"
                >
                  View Sheet <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              )}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lessons-google-sheet-name">Lessons Sheet Name</Label>
              <Input
                id="lessons-google-sheet-name"
                type="text"
                placeholder="lessons"
                value={lessonsGoogleSheetName}
                onChange={(e) => setLessonsGoogleSheetName(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Name of the worksheet tab containing lessons (e.g., "lessons", "Sheet1")
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lessons-google-sheet-range">Lessons Range</Label>
              <Input
                id="lessons-google-sheet-range"
                type="text"
                placeholder="A1:E1000"
                value={lessonsGoogleSheetRange}
                onChange={(e) => setLessonsGoogleSheetRange(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Cell range for lessons data (e.g., "A1:E1000", "A2:E100")
              </p>
            </div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-medium text-purple-900 mb-2">Lessons Configuration Summary</h4>
            <p className="text-sm text-purple-800">
              Lessons data will be read from <strong>{lessonsGoogleSheetName || 'lessons'}</strong> 
              {' '}in range <strong>{lessonsGoogleSheetRange || 'A1:E1000'}</strong>
              {lessonsGoogleSheetUrl ? ' of your configured lessons Google Sheet.' : '. Please configure a lessons Google Sheet URL first.'}
            </p>
            <p className="text-sm text-purple-700 mt-2">
              Expected columns: Student Name, Duration, Teacher, Start Date, Subject
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Maintenance Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Data Maintenance</CardTitle>
          <CardDescription>Compare and reconcile data between database and external sources</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Click the button below to compare lessons in the database with those in the Google Sheet.
            This will identify any discrepancies that need to be addressed.
          </p>
          <Button onClick={handleCheckLessons}>
            Check Lessons vs Google Sheets
          </Button>
        </CardContent>
      </Card>

      {/* Export Lessons Section - For Admins and Super Admins */}
      {(userRole === 'admin' || userRole === 'superadmin') && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Download className="h-5 w-5 mr-2" />
              Export Lessons
            </CardTitle>
            <CardDescription>Export all lessons to Google Sheets for external use and analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 mr-2 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-1">Google Sheets Access Required</h4>
                  <p className="text-sm text-blue-800">
                    To export lessons, you need to give our Google service account <strong>edit access</strong> to your Google Sheet. 
                    Share the sheet with this email: <code className="bg-blue-100 px-1 rounded">schooltools@schooltools-459418.iam.gserviceaccount.com</code>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="export-google-sheet-url">Export Google Sheet URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="export-google-sheet-url"
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={exportGoogleSheetUrl}
                    onChange={(e) => setExportGoogleSheetUrl(e.target.value)}
                    className="flex-1"
                  />
                  {exportGoogleSheetUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(exportGoogleSheetUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  URL of the Google Sheet where lessons will be exported
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="export-google-sheet-tab">Sheet Tab Name</Label>
                  <Input
                    id="export-google-sheet-tab"
                    type="text"
                    placeholder="lessons"
                    value={exportGoogleSheetTab}
                    onChange={(e) => setExportGoogleSheetTab(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Name of the worksheet tab to export to
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="auto-export-frequency">Auto-Export Frequency</Label>
                  <Select value={autoExportFrequency} onValueChange={(value) => setAutoExportFrequency(value as 'none' | 'hourly' | 'daily' | 'weekly')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Manual only)</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    How often to automatically export lessons
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleSaveExportSettings}
                  disabled={isSavingExportSettings}
                  variant="outline"
                >
                  {isSavingExportSettings ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Settings
                </Button>
                
                <Button 
                  onClick={handleExportLessons}
                  disabled={isExporting || !exportGoogleSheetUrl}
                  variant="default"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Export Now
                </Button>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Export Data Includes:</h4>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• Student Name</li>
                <li>• Duration (minutes)</li>
                <li>• Subject</li>
                <li>• Teacher (or "Unassigned")</li>
                <li>• Location (or "No location")</li>
                <li>• Day of Week</li>
                <li>• Start Time</li>
                <li>• Start Date</li>
                <li>• End Date</li>
              </ul>
              <p className="text-sm text-green-700 mt-2">
                All existing data in the target sheet tab will be cleared before export.
              </p>
            </div>
            
            {/* Export Logs Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Export History</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchExportLogs}
                  disabled={isLoadingExportLogs}
                >
                  {isLoadingExportLogs ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh
                </Button>
              </div>
              
              {isLoadingExportLogs ? (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-500" />
                  <p className="text-sm text-gray-500">Loading export history...</p>
                </div>
              ) : exportLogs.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-lg">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">No exports yet</p>
                  <p className="text-xs text-gray-400 mt-1">Export history will appear here</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {exportLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        log.status === 'completed'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {log.status === 'completed' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {log.export_type === 'manual' ? 'Manual Export' : 'Automated Export'}
                          </p>
                          {log.error_message && (
                            <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {autoExportFrequency !== 'none' && exportGoogleSheetUrl && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-blue-600 mr-2" />
                    <p className="text-sm text-blue-800">
                      <strong>Automated exports enabled:</strong> {autoExportFrequency}
                    </p>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Next export will run automatically based on your selected frequency
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin User Management Section - For Admins and Super Admins */}
      {(userRole === 'admin' || userRole === 'superadmin') && (
        <div className="mb-6">
          <AdminUserManagement />
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lesson Comparison Results</DialogTitle>
            <DialogDescription>
              Comparison between database lessons and Google Sheet lessons
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-10 w-10 animate-spin text-gray-500 mb-2" />
              <p className="text-gray-500">Comparing lessons...</p>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : comparisonResults ? (
            <>
              {comparisonResults.missingInDb.length === 0 &&
               comparisonResults.missingInSheet.length === 0 &&
               comparisonResults.mismatched.length === 0 &&
               comparisonResults.matched.length > 0 ? (
                <div className="py-8 text-center">
                  <Check className="mx-auto h-16 w-16 text-green-500 mb-4" />
                  <h3 className="text-xl font-medium text-green-600 mb-2">Perfect Match!</h3>
                  <p className="text-gray-600">
                    All lessons in the database match those in the Google Sheet. No discrepancies found.
                  </p>
                </div>
              ) : (
                <Tabs defaultValue="missing-in-db">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="matched" className="relative">
                      <span>Matched</span>
                      {comparisonResults.matched.length > 0 && (
                        <span className="ml-2 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                          {comparisonResults.matched.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="missing-in-db" className="relative">
                      <span>Missing in Database</span>
                      {comparisonResults.missingInDb.length > 0 && (
                        <span className="ml-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                          {comparisonResults.missingInDb.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="missing-in-sheet" className="relative">
                      <span>Missing in Sheet</span>
                      {comparisonResults.missingInSheet.length > 0 && (
                        <span className="ml-2 bg-yellow-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                          {comparisonResults.missingInSheet.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="mismatched" className="relative">
                      <span>Mismatched</span>
                      {comparisonResults.mismatched.length > 0 && (
                        <span className="ml-2 bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                          {comparisonResults.mismatched.length}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="matched" className="py-4">
                    <h3 className="text-lg font-semibold mb-4">Perfectly Matched Lessons</h3>
                    {comparisonResults.matched.length === 0 ? (
                      <p className="text-orange-600 flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2" /> No perfectly matched lessons found
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {comparisonResults.matched.map((match, idx) => (
                          <Card key={idx} className="bg-green-50">
                            <CardHeader className="py-3">
                              <CardTitle className="text-lg flex items-center">
                                <Check className="h-5 w-5 mr-2 text-green-500" />
                                {match.dbLesson.studentName}
                              </CardTitle>
                              <CardDescription>{match.dbLesson.subjectName}</CardDescription>
                            </CardHeader>
                            <CardContent className="py-2">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <ul className="space-y-1 text-sm">
                                    <li><span className="font-semibold">Teacher:</span> {match.dbLesson.teacherName || 'Unassigned'}</li>
                                    <li><span className="font-semibold">Duration:</span> {match.dbLesson.duration} minutes</li>
                                    <li><span className="font-semibold">Start Date:</span> {match.dbLesson.startDate || 'Not set'}</li>
                                    <li><span className="font-semibold">Lesson ID:</span> {match.dbLesson.id}</li>
                                  </ul>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="missing-in-db" className="py-4">
                    <h3 className="text-lg font-semibold mb-4">Lessons in Google Sheet but missing in Database</h3>
                    {comparisonResults.missingInDb.length === 0 ? (
                      <p className="text-green-600 flex items-center">
                        <Check className="h-5 w-5 mr-2" /> No missing lessons found in database
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {comparisonResults.missingInDb.map((lesson, idx) => (
                          <Card key={idx} className="bg-red-50">
                            <CardHeader className="py-3">
                              <CardTitle className="text-lg">{lesson.studentName}</CardTitle>
                              <CardDescription>{lesson.subject}</CardDescription>
                            </CardHeader>
                            <CardContent className="py-2">
                              <ul className="space-y-1 text-sm">
                                <li><span className="font-semibold">Teacher:</span> {lesson.teacher}</li>
                                <li><span className="font-semibold">Duration:</span> {lesson.duration} minutes</li>
                                <li><span className="font-semibold">Start Date:</span> {lesson.startDate}</li>
                                {lesson.row && (
                                  <li><span className="font-semibold">Sheet Row:</span> {lesson.row}</li>
                                )}
                              </ul>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="missing-in-sheet" className="py-4">
                    <h3 className="text-lg font-semibold mb-4">Lessons in Database but missing in Google Sheet</h3>
                    {comparisonResults.missingInSheet.length === 0 ? (
                      <p className="text-green-600 flex items-center">
                        <Check className="h-5 w-5 mr-2" /> No missing lessons found in Google Sheet
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {comparisonResults.missingInSheet.map((lesson, idx) => (
                          <Card key={idx} className="bg-yellow-50">
                            <CardHeader className="py-3">
                              <CardTitle className="text-lg">{lesson.studentName}</CardTitle>
                              <CardDescription>{lesson.subjectName}</CardDescription>
                            </CardHeader>
                            <CardContent className="py-2">
                              <ul className="space-y-1 text-sm">
                                <li><span className="font-semibold">Teacher:</span> {lesson.teacherName || 'Unassigned'}</li>
                                <li><span className="font-semibold">Duration:</span> {lesson.duration} minutes</li>
                                <li><span className="font-semibold">Start Date:</span> {lesson.startDate || 'Not set'}</li>
                                <li><span className="font-semibold">Lesson ID:</span> {lesson.id}</li>
                              </ul>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="mismatched" className="py-4">
                    <h3 className="text-lg font-semibold mb-4">Lessons with Discrepancies</h3>
                    {comparisonResults.mismatched.length === 0 ? (
                      <p className="text-green-600 flex items-center">
                        <Check className="h-5 w-5 mr-2" /> No mismatched lessons found
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-6">
                        {comparisonResults.mismatched.map((mismatch, idx) => (
                          <Card key={idx} className="bg-orange-50">
                            <CardHeader className="py-3">
                              <CardTitle className="text-lg flex items-center">
                                <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                                {mismatch.dbLesson.studentName}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="py-2">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-semibold mb-2 text-blue-700">Database Version</h4>
                                  <ul className="space-y-1 text-sm">
                                    <li><span className="font-semibold">Teacher:</span> {mismatch.dbLesson.teacherName || 'Unassigned'}</li>
                                    <li><span className="font-semibold">Duration:</span> {mismatch.dbLesson.duration} minutes</li>
                                    <li><span className="font-semibold">Subject:</span> {mismatch.dbLesson.subjectName}</li>
                                    <li><span className="font-semibold">Start Date:</span> {mismatch.dbLesson.startDate || 'Not set'}</li>
                                    <li><span className="font-semibold">Lesson ID:</span> {mismatch.dbLesson.id}</li>
                                  </ul>
                                </div>
                                <div>
                                  <h4 className="font-semibold mb-2 text-green-700">Google Sheet Version</h4>
                                  <ul className="space-y-1 text-sm">
                                    <li><span className="font-semibold">Teacher:</span> {mismatch.sheetLesson.teacher}</li>
                                    <li><span className="font-semibold">Duration:</span> {mismatch.sheetLesson.duration} minutes</li>
                                    <li><span className="font-semibold">Subject:</span> {mismatch.sheetLesson.subject}</li>
                                    <li><span className="font-semibold">Start Date:</span> {mismatch.sheetLesson.startDate}</li>
                                    {mismatch.sheetLesson.row && (
                                      <li><span className="font-semibold">Sheet Row:</span> {mismatch.sheetLesson.row}</li>
                                    )}
                                  </ul>
                                </div>
                              </div>
                              
                              <div className="mt-4 pt-3 border-t border-orange-200">
                                <h4 className="font-semibold mb-2">Differences:</h4>
                                <ul className="space-y-1">
                                  {mismatch.differences.map((diff, index) => (
                                    <li key={index} className="text-sm text-red-600 flex items-start">
                                      <X className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                                      {diff}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              
                              <div className="mt-4 pt-3 border-t border-orange-200">
                                {aligningStatus[mismatch.dbLesson.id]?.loading ? (
                                  <div className="flex items-center text-blue-600">
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Checking for conflicts and aligning lesson...
                                  </div>
                                ) : aligningStatus[mismatch.dbLesson.id]?.error ? (
                                  <Alert variant="destructive" className="mt-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{aligningStatus[mismatch.dbLesson.id].error}</AlertDescription>
                                  </Alert>
                                ) : aligningStatus[mismatch.dbLesson.id]?.conflict ? (
                                  <Alert variant="destructive" className="mt-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                      Cannot align: {aligningStatus[mismatch.dbLesson.id].conflictMessage}
                                    </AlertDescription>
                                  </Alert>
                                ) : (
                                  <div className="flex flex-col space-y-2">
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="w-full"
                                      onClick={() => handleAlignWithSheet(mismatch.dbLesson, mismatch.sheetLesson)}
                                    >
                                      <Zap className="h-4 w-4 mr-2" />
                                      Align with Google Sheet
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings; 