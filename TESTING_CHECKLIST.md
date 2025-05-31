# Rhythmic Lesson Orchestrator - Testing Checklist

This document outlines the key functionalities to test in the Rhythmic Lesson Orchestrator application.

## I. User Authentication

### A. Login & Logout
- [X] 1. Valid admin login redirects to schedule/dashboard.
- [X] 2. Valid teacher login redirects to their schedule.
- [X] 3. Invalid login attempt (wrong email/password) shows an error message.
- [X] 4. Logout from admin session redirects to login page.
- [X] 5. Logout from teacher session redirects to login page.
- [X] 6. Session persistence: After closing and reopening the browser, the user remains logged in (if session hasn't expired).
- [X] 7. Accessing protected routes without login redirects to the login page.

### B. Password Reset
- [X] 1. Request password reset with a valid email associated with an account.
- [X] 2. Receive password reset email.
- [X] 3. Clicking the reset link in the email navigates to the reset password page.
- [X] 4. Reset password page correctly handles the token from the URL.
- [X] 5. Successfully reset password with matching new passwords (meeting complexity if any).
- [X] 6. Attempt to reset password with non-matching new passwords shows an error.
- [X] 7. Attempt to reset password with a password shorter than the minimum length shows an error.
- [X] 8. After successful password reset, user is redirected to the login page.
- [X] 9. User can log in with the new password.
- [X] 10. Using an expired or invalid reset link shows an appropriate error on the reset password page.
- [X] 11. Request password reset with an email NOT associated with an account (should show a generic success/check email message for security).

### C. Access Control (Authorization)
- [X] 1. Non-admin user (e.g., teacher) cannot access admin-only pages (e.g., Teachers, Instruments management) and is redirected appropriately.
- [X] 2. Admin user can access all admin-only pages.
- [X] 3. Teacher user can only see their own schedule by default (if applicable).

## II. Teacher Management (Admin Only)

### A. View Teachers
- [X] 1. Admin can view a list of all teachers.
- [X] 2. Teacher list displays correct information: Name, Email, Instruments, Active Status.
- [X] 3. Teacher list loads correctly, even with many teachers.

### B. Add Teacher
- [X] 1. Admin can open the "Add Teacher" form.
- [X] 2. Successfully add a new teacher with valid details (Name, Email, Instruments).
- [X] 3. New teacher appears in the teacher list immediately after adding.
- [X] 4. New teacher is set to "Active" by default (or as per design).
- [X] 5. Attempt to add a teacher with an email that already exists shows an error.
- [X] 6. Attempt to add a teacher with invalid email format shows an error.
- [X] 7. Attempt to add a teacher without required fields (e.g., name, email) shows an error.

### C. Edit Teacher
- [X] 1. Admin can open the "Edit Teacher" form for an existing teacher.
- [X] 2. Form is pre-filled with the selected teacher's current details.
- [X] 3. Successfully update teacher's Name.
- [X] 4. Successfully update teacher's assigned Instruments.
- [X] 5. Changes are reflected in the teacher list immediately after saving.
- [X] 6. Email field is non-editable (or handled as per design if editable).

### D. Activate/Deactivate Teacher
- [X] 1. Admin can toggle a teacher's active/inactive status.
- [X] 2. Status change is reflected immediately in the teacher list (e.g., badge update).
- [X] 3. Deactivated teachers cannot log in (or are logged out if active session and then deactivated).
- [X] 4. Deactivated teachers do not appear in the teacher selector on the Schedule page for new lesson assignments.
- [X] 5. Activating an inactive teacher allows them to log in and appear in selectors again.

## III. Instrument Management (Admin Only)

### A. View Instruments
- [X] 1. Admin can view a list of all instruments.
- [X] 2. Instrument list displays correct information (e.g., Name, Color).

### B. Add Instrument
- [X] 1. Admin can open the "Add Instrument" form.
- [X] 2. Successfully add a new instrument with a unique name and color.
- [X] 3. New instrument appears in the list immediately.
- [X] 4. Attempt to add an instrument with a name that already exists shows an error.

### C. Edit Instrument
- [X] 1. Admin can open the "Edit Instrument" form.
- [X] 2. Form is pre-filled with current details.
- [X] 3. Successfully update instrument Name.
- [X] 4. Successfully update instrument Color.
- [X] 5. Changes are reflected in the list immediately.

### D. Delete Instrument
- [X] 1. Admin can delete an instrument.
- [X] 2. Confirmation prompt before deletion.
- [X] 3. Instrument is removed from the list.
- [X] 4. Impact of deleting an instrument assigned to teachers/lessons (e.g., is it unassigned, or is deletion prevented? Test as per design).

## IV. Schedule Management

### A. View Schedule
- [X] 1. Schedule grid displays correctly for the current week (e.g., days, time slots).
- [X] 2. Navigate to the Next Week.
- [X] 3. Navigate to the Previous Week.
- [X] 4. Navigate to the Current Week (today).
- [X] 5. Lessons are displayed in the correct time slots for the selected teacher/week.
- [X] 6. Lesson cards show relevant information (Student Name, Instrument, Duration).
- [X] 7. Unassigned lessons panel (if admin) displays lessons not yet assigned to a teacher/slot.

### B. Teacher Selection (Admin)
- [X] 1. Admin can select different active teachers from a dropdown.
- [X] 2. Schedule grid updates to show lessons for the selected teacher.
- [X] 3. Teacher selector only shows active teachers.

### C. Create New Lesson (Admin)
- [X] 1. Admin can open the "New Lesson" form.
- [ ] 2. Successfully create a new lesson and assign it to a teacher, day, time, and instrument.
- [ ] 3. New lesson appears on the schedule in the correct slot.
- [ ] 4. Successfully create a new unassigned lesson (student name, instrument, duration, but no teacher/slot).
- [ ] 5. New unassigned lesson appears in the "Unassigned Lessons" panel.
- [ ] 6. Validate form fields (e.g., student name required, duration valid).

### D. Drag and Drop Lessons (Admin)
- [ ] 1. Drag an unassigned lesson to a teacher's schedule slot.
    - [ ] Lesson is assigned to the teacher, day, time, and week.
    - [ ] Lesson is removed from the unassigned panel.
- [ ] 2. Drag an assigned lesson to a different time slot for the SAME teacher, SAME week.
    - [ ] Lesson is rescheduled (day/time updated).
- [ ] 3. Drag an assigned lesson to a different day for the SAME teacher, SAME week.
    - [ ] Lesson is rescheduled (day/time updated).
- [ ] 4. Drag an assigned lesson to a slot for a DIFFERENT teacher, SAME week.
    - [ ] Lesson is reassigned to the new teacher and rescheduled (teacher_id, day, time updated).
- [ ] 5. Drag an assigned lesson from the schedule back to the "Unassigned Lessons" panel.
    - [ ] Lesson becomes unassigned (teacher_id, day, time, start_date possibly nulled).
    - [ ] Lesson appears in the unassigned panel.
- [ ] 6. Drag an assigned lesson to the "Trash" area.
    - [ ] Lesson is deleted (or marked as inactive, as per design).
    - [ ] Lesson is removed from the schedule/unassigned panel.
    - [ ] Confirmation for deletion if applicable.
- [ ] 7. Attempt to drag a lesson to an occupied slot (test conflict handling, if any).

### E. Recurring Lessons (If Implemented)
- [ ] 1. Create a recurring lesson.
- [ ] 2. Recurring lessons appear correctly across subsequent weeks.
- [ ] 3. Edit a single instance of a recurring lesson.
- [ ] 4. Edit all instances of a recurring lesson.
- [ ] 5. Delete a single instance of a recurring lesson.
- [ ] 6. Delete all instances of a recurring lesson.

## V. General UI/UX

- [ ] 1. Application is responsive across different screen sizes (desktop, tablet, mobile - if targeted).
- [ ] 2. Consistent styling and branding.
- [ ] 3. Clear error messages and user feedback (e.g., toast notifications for success/failure).
- [ ] 4. Loading states are shown for asynchronous operations.
- [ ] 5. No console errors in the browser developer tools during normal operation.
- [ ] 6. Intuitive navigation and user flow.
- [ ] 7. Accessibility considerations (e.g., keyboard navigation, ARIA attributes - basic checks).

## VI. Performance

- [ ] 1. Pages load within an acceptable time.
- [ ] 2. Actions (e.g., saving, dragging) are responsive.
- [ ] 3. No noticeable lag with a reasonable amount of data (e.g., multiple teachers, many lessons).

## VII. Database & Backend Integrity

- [ ] 1. Data consistency: Changes made in the UI are correctly reflected in the Supabase database (auth.users, public.users, lessons, teachers_instruments, etc.).
- [ ] 2. RLS policies are correctly enforced (e.g., teachers can only modify their own relevant data, admins have wider access).
- [ ] 3. Edge Functions (e.g., `admin_create_teacher`, `update_teacher_details` RPC) execute correctly and handle permissions.
- [ ] 4. Database triggers (e.g., `update_custom_claims`, `sync_user_data_to_public`) are working as expected.

---
Date Tested: 
Tested By: 
Notes: 