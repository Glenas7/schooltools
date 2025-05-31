# Music Teacher Schedule App - Backend Implementation Plan

This document outlines the plan for implementing the Supabase backend for the Music Teacher Schedule application.

## 1. Project Overview

The application allows managing music teacher schedules, lessons, students, and instruments. The frontend is already built and expects a specific data structure and API interactions. This plan focuses on creating the Supabase backend to support the existing frontend.

## 2. Data Models & Supabase Schema

Based on the frontend types found in `src/types/index.ts`, the following Supabase tables will be created:

### 2.1. `users` Table
Stores information about all users, including admins and teachers. This table will be linked to Supabase's built-in `auth.users` table.

-   **Supabase Table Name**: `users`
-   **Fields**:
    -   `id`: `uuid` (Primary Key, Foreign Key to `auth.users.id`, ON DELETE CASCADE)
    -   `name`: `text` (Not null)
    -   `email`: `text` (Unique, Not null, taken from `auth.users.email`)
    -   `role`: `text` (Enum: `'admin'`, `'teacher'`, Not null)
    -   `active`: `boolean` (Default: `true`, Not null)
    -   `created_at`: `timestamp with time zone` (Default: `now()`, Not null)
    -   `updated_at`: `timestamp with time zone` (Default: `now()`, Not null)
-   **Row Level Security (RLS)**:
    -   Users can select their own record.
    -   Admins can select all records.
    -   Admins can insert/update/delete any record.
    -   Teachers can update their own `name` and `active` status (if allowed by business logic).

### 2.2. `instruments` Table
Stores information about the musical instruments available for lessons.

-   **Supabase Table Name**: `instruments`
-   **Fields**:
    -   `id`: `uuid` (Primary Key, Default: `gen_random_uuid()`)
    -   `name`: `text` (Unique, Not null)
    -   `color`: `text` (Not null, for UI display)
    -   `created_at`: `timestamp with time zone` (Default: `now()`, Not null)
    -   `updated_at`: `timestamp with time zone` (Default: `now()`, Not null)
-   **RLS**:
    -   Authenticated users can select all instruments.
    -   Admins can insert/update/delete instruments.

### 2.3. `teachers_instruments` Table
A join table to manage the many-to-many relationship between teachers (`users` table with role 'teacher') and `instruments`.

-   **Supabase Table Name**: `teachers_instruments`
-   **Fields**:
    -   `teacher_id`: `uuid` (Primary Key, Foreign Key to `users.id` where `role` is 'teacher', ON DELETE CASCADE)
    -   `instrument_id`: `uuid` (Primary Key, Foreign Key to `instruments.id`, ON DELETE CASCADE)
    -   `created_at`: `timestamp with time zone` (Default: `now()`, Not null)
-   **RLS**:
    -   Authenticated users can select all records (to see which instruments teachers can teach).
    -   Admins can insert/delete records.
    -   Teachers cannot modify their own instrument list.

### 2.4. `lessons` Table
Stores information about scheduled lessons.

-   **Supabase Table Name**: `lessons`
-   **Fields**:
    -   `id`: `uuid` (Primary Key, Default: `gen_random_uuid()`)
    -   `student_name`: `text` (Not null)
    -   `duration_minutes`: `integer` (Not null)
    -   `teacher_id`: `uuid` (Foreign Key to `users.id` where `role` is 'teacher', Nullable, ON DELETE SET NULL) - Allows unassigned lessons.
    -   `day_of_week`: `integer` (Nullable, 0 for Monday, 1 for Tuesday, ..., 4 for Friday. Based on frontend `TimeGrid.tsx`)
    -   `start_time`: `time` (Nullable, HH:MM format)
    -   `instrument_id`: `uuid` (Foreign Key to `instruments.id`, Not null, ON DELETE RESTRICT - prevent deleting instrument if lessons exist)
    -   `start_date`: `date` (Nullable, YYYY-MM-DD format. Represents the first day the lesson occurs or is valid from)
    -   `end_date`: `date` (Nullable, YYYY-MM-DD format. Represents the last day the lesson is valid. If null, lesson recurs indefinitely or until explicitly changed/deleted)
    -   `created_at`: `timestamp with time zone` (Default: `now()`, Not null)
    -   `updated_at`: `timestamp with time zone` (Default: `now()`, Not null)
-   **RLS**:
    -   Admins can select/insert/update/delete all lessons.
    -   Teachers can select lessons assigned to them.
    -   Teachers cannot update any fields of lessons assigned to them.
    -   **Note**: Complex lesson modifications (assigning, unassigning, rescheduling, deleting/archiving based on drag-and-drop actions) often involve multiple steps (e.g., updating an old record and inserting a new one). These will be handled by dedicated database functions (see Section 5) rather than direct table operations from the client, to ensure atomicity and correct application of business logic. RLS will still protect direct table access.

## 3. Authentication & Authorization

-   **Authentication**: Supabase Auth will be used. Users will sign up/log in with email and password.
-   **User Roles**:
    -   `admin`: Full access to manage teachers, instruments, and all lessons.
    -   `teacher`: Can only view their own schedule. They cannot modify any data, and have read-only access only to their schedule (for all weeks in the school year)
-   **RLS Policies**: Will be implemented for each table as described above to enforce data access rules.
-   **Custom Claims**: The `role` and `user_id` (from the public `users` table) will be added to the JWT as custom claims for easier RLS policy creation and client-side role checking. This will require a trigger on `auth.users` table to populate the public `users` table and another trigger on the public `users` table to update claims.

## 4. API Endpoints (Implicit via Supabase Client)

The frontend uses `@tanstack/react-query` and custom context hooks (`useLessons`, `useTeachers`, `useInstruments`, `useAuth`). These will interact with Supabase using the Supabase client library. We don't need to define REST API endpoints explicitly, but rather ensure our table structures and RLS policies support the operations performed by these hooks.

**Key Operations to Support:**

### 4.1. Auth (`AuthContext`)
-   Login (`supabase.auth.signInWithPassword`)
-   Logout (`supabase.auth.signOut`)
-   Get current user (`supabase.auth.getUser`, `supabase.auth.onAuthStateChange`)
-   Forgot Password (no sign up, only admins can create users and admins will be manually created for now)
-   Fetch user profile (from `users` table).

### 4.2. Instruments (`InstrumentsContext`)
-   Fetch all instruments.
-   Create new instrument (admin only).
-   Update instrument (admin only).
-   Delete instrument (admin only).

### 4.3. Teachers (`TeachersContext`, interacts with `users` and `teachers_instruments`)
-   Fetch all teachers (users with 'teacher' role) including their assigned instruments. This will likely require a view or a function to join `users` and `teachers_instruments` (admin only).
-   Create new teacher (admin only - involves creating an auth user and a `users` table entry).
-   Update teacher details (admin only for all fields).
-   Update teacher's instruments (admin only).
-   Activate/Deactivate teacher (admin only).

### 4.4. Lessons (`LessonsContext`)
-   Fetch lessons (filtered by teacher, week, and active status).
-   Create new lesson (admin assigns, potentially to unassigned or a specific teacher - this will be a simpler direct insert, followed by an assign operation if needed).
-   Assign lesson (admin: `assignLesson(lessonId, selectedTeacherId, day, time, currentWeek)`). This frontend action will call a dedicated Supabase database function.
    -   This involves:
        1.  Determining the `original_slot_date` for the lesson being assigned (if it was previously scheduled).
        2.  If the lesson was an existing unassigned lesson: update its `teacher_id`, `day_of_week`, `start_time`. Its `start_date` should be set to the date of the slot in `currentWeek`. `end_date` remains `null`.
        3.  If the lesson was *dragged from another teacher/slot* (rescheduling): this is handled by the `handle_lesson_move` function described in Section 5.
-   Unassign lesson (admin: `unassignLesson(lessonId, currentWeek)`). This frontend action will call `handle_lesson_unassign` (Section 5).
    -   The original lesson is end-dated or deleted (only if its start date would be equal to its end date after end-dating it).
    -   A new, corresponding unassigned lesson is created with `start_date` in `currentWeek`.
-   Reschedule lesson (admin only: `rescheduleLesson(lessonId, day, time, currentWeek)`). This frontend action will call `handle_lesson_move` (Section 5).
    -   The original lesson is end-dated or deleted.
    -   A new lesson is created in the new slot.
-   Update lesson details (e.g., student name, duration, instrument, end date - only admin). These might be direct updates if they don't involve slot changes. The frontend will need to be updated to add an interface to update lessons. A modal might make the most sense for this, maybe we can add an "edit lesson" button to the UI which could toggle on and off, and when on clicking a lesson opens the modal instead of initiating the dragging action.
-   Delete lesson (admin - dragging to trash area). This frontend action will call `handle_lesson_trash` (Section 5).
    -   The original lesson is end-dated or deleted (only if its start date would be equal to its end date after end-dating it).
-   **Note**: Backend database functions for these operations should return details of affected/created lessons to help the frontend update its state efficiently.

## 5. Supabase Functions (Edge Functions or Database Functions)

-   **`get_teachers_with_instruments` (Database Function/View)**:
    -   To simplify fetching teachers along with an array of `instrument_ids` or `instrument` objects they teach. This will be useful for `TeachersContext`.
    -   Alternatively, query `users` and then make separate queries for `teachers_instruments` or use Supabase's relational query features. A dedicated function/view is cleaner.
-   **`on_new_user` (Database Trigger Function)**:
    -   When a new user signs up via `auth.users`, this trigger will create a corresponding entry in the public `users` table. It should also set a default role (e.g., 'teacher', or handle role assignment separately if admins create users).
-   **`update_user_claims` (Database Trigger Function)**:
    -   When `role` in the public `users` table changes, or when a new user is added, this trigger will update the custom claims (`app_metadata.role`, `app_metadata.user_id`) in the `auth.users` table for that user. This makes RLS policies more efficient.
-   **`handle_lesson_move` (Database Function - RPC)**:
    -   **Purpose**: Handles dragging an existing lesson to a new calendar slot for a teacher.
    -   **Parameters**: `original_lesson_id`, `target_teacher_id`, `target_day_of_week`, `target_start_time`, `target_slot_date` (the specific date in `currentWeek` of the new slot).
    -   **Logic**:
        1.  Identify `original_slot_date` from `original_lesson_id`'s existing schedule or if it's passed.
        2.  If `original_lesson.start_date` == `original_slot_date`, delete `original_lesson`.
        3.  Else, update `original_lesson.end_date` to `original_slot_date`.
        4.  Create a new lesson: `student_name`, `duration_minutes`, `instrument_id` copied from original; `teacher_id` = `target_teacher_id`; `day_of_week` = `target_day_of_week`; `start_time` = `target_start_time`; `start_date` = `target_slot_date`; `end_date` = `null`.
        5.  Return details of new lesson and status of original.
-   **`handle_lesson_unassign` (Database Function - RPC)**:
    -   **Purpose**: Handles dragging an existing scheduled lesson to the "Unassigned Lessons" pool.
    -   **Parameters**: `original_lesson_id`, `unassign_date` (the specific date in `currentWeek` from which it's considered unassigned, typically the original slot date).
    -   **Logic**:
        1.  If `original_lesson.start_date` == `unassign_date`, delete `original_lesson`.
        2.  Else, update `original_lesson.end_date` to `unassign_date`.
        3.  Create a new lesson: `student_name`, `duration_minutes`, `instrument_id` copied; `teacher_id` = `null`; `day_of_week` = `null`; `start_time` = `null`; `start_date` = `unassign_date`; `end_date` = `null`.
        4.  Return details of new unassigned lesson and status of original.
-   **`handle_lesson_trash` (Database Function - RPC)**:
    -   **Purpose**: Handles dragging an existing lesson (scheduled or unassigned) to the "Trash Area".
    -   **Parameters**: `original_lesson_id`, `trash_date` (the specific date in `currentWeek` from which it's considered trashed, typically its original slot date if scheduled, or its `start_date` if unassigned and dragged from the list).
    -   **Logic**:
        1.  If `original_lesson.start_date` == `trash_date`, delete `original_lesson`.
        2.  Else, update `original_lesson.end_date` to `trash_date`.
        3.  Return status of original lesson. (No new lesson created).
-   **`create_new_lesson_from_form` (Database Function - RPC)**:
    -   **Purpose**: Handles creating a new lesson from the admin form.
    -   **Parameters**: `p_student_name TEXT`, `p_duration_minutes INTEGER`, `p_instrument_id UUID`, `p_teacher_id UUID (nullable)`, `p_day_of_week INTEGER (nullable)`, `p_start_time TIME (nullable)`, `p_start_date DATE (nullable)`, `p_end_date DATE (nullable)`.
    -   **Logic**: Inserts a new lesson with the provided details. Returns the new lesson.
-   **`admin_create_teacher` (Edge Function)**:
    -   **Purpose**: Handles creating a new teacher user (auth + public profile) and linking instruments.
    -   **Input**: `email`, `name`, `instrumentIds`.
    -   **Logic**:
        1.  Generates a temporary random password.
        2.  Calls `supabase.auth.admin.createUser()` (using service role key) with email, temp password, and metadata (name, role: 'teacher').
        3.  `on_new_user` trigger creates `public.users` entry (with `active: false`).
        4.  Edge function links `instrumentIds` to the new teacher in `teachers_instruments`.
    -   **Output**: New teacher's profile data or error.
-   **Note on Database Functions for Lessons**: These functions should be designed to run with appropriate permissions (e.g., `SECURITY DEFINER` if they need to bypass RLS for their internal logic while still being callable by users with correct RLS to initiate the action) and ensure all steps are performed atomically (e.g., within a transaction block).

## 6. Implementation Steps & Progress Tracker

### Phase 1: Supabase Project Setup & Basic Schema
-   [X] 1. Create a new Supabase project.
-   [X] 2. Enable and configure Authentication (Email/Password provider).
-   [X] 3. Design and Create Tables:
    -   [X] 3.1. `instruments` table.
    -   [X] 3.2. `users` table (public profile linked to `auth.users`).
    -   [X] 3.3. `teachers_instruments` join table.
    -   [X] 3.4. `lessons` table.
-   [X] 4. Define relationships (Foreign Keys) between tables.
-   [X] 5. Implement initial RLS policies for basic read access for authenticated users.

### Phase 2: User Management & Authentication Integration
-   [X] 1. Implement `on_new_user` trigger to populate public `users` table from `auth.users`.
    -   [X] Define default role or admin creation flow for users. (Flow defined: Admin creates users with metadata, trigger populates `users` table).
-   [X] 2. Implement `update_user_claims` trigger to set custom JWT claims (`role`, `user_id`).
-   [X] 3. Refine RLS for `users` table (admins can manage, users can see own).
-   [X] 4. Integrate frontend Login/Logout with Supabase Auth.
-   [X] 5. Fetch user profile data in `AuthContext`.

### Phase 3: Core Modules Implementation (Instruments & Teachers)
-   **Instruments:**
    -   [X] 1. Implement RLS for `instruments` (admin CRUD, auth read).
    -   [X] 2. Connect `InstrumentsContext` to Supabase for CRUD operations.
-   **Teachers:**
    -   [X] 3. Create `get_teachers_with_instruments` view/function.
    -   [X] 4. Implement RLS for `teachers_instruments` (admin manage, auth read).
    -   [X] 5. Connect `TeachersContext` to Supabase (fetch teachers with their instruments, admin can create/update teachers and their instrument assignments). (Note: `addTeacher` requires a backend Edge Function for secure auth user creation, not implemented directly in context yet).

### Phase 4: Lessons Module Implementation
-   [X] 1. Implement RLS for `lessons` table (admin full CRUD, teachers manage own assigned lessons).
-   [X] 2. Connect `LessonsContext` to Supabase:
    -   [X] 2.1. Fetch lessons (with filtering for teacher, week, active status).
    -   [X] 2.2. Create new lesson.
    -   [X] 2.3. Assign/Unassign lesson ( `end_date` updates, based on `currentWeek`, and new lesson is created via RPC calls).
    -   [X] 2.4. Reschedule lesson ( `end_date` updates, based on `currentWeek`, and new lesson is created via RPC calls).
    -   [X] 2.5. Delete lesson (via RPC call to trash/archive).
-   [X] 3. Clarify and implement logic for `startDate` and `endDate` during lesson manipulation, especially concerning the `currentWeek` parameter passed from the frontend.

### Phase 5: Advanced Features & Refinements
-   [X] 1. Implement cascading deletes or `SET NULL` / `RESTRICT` on foreign keys as appropriate. (Initial thoughts added in schema).
-   [X] 2. Add database indexes for frequently queried columns (e.g., `lessons.teacher_id`, `lessons.day_of_week`, `lessons.start_date`, `lessons.end_date`).
-   [ ] 3. Thoroughly test all RLS policies for edge cases. ([ ] User Testing Required)
-   [ ] 4. Review frontend components (`Schedule.tsx`, `TimeGrid.tsx`, context files) to ensure all data interactions are covered. ([ ] User Review Required)
-   [X] 5. Set up Storage for any file uploads if needed (not apparent from current analysis). (N/A for now)

### Phase 6: Deployment & Final Testing
-   [X] 1. Ensure environment variables for Supabase URL and Anon Key are set up for frontend deployment.
-   [ ] 2. Perform end-to-end testing with the deployed frontend and backend. ([ ] User Testing Required)
-   [X] 3. (Optional) Set up Supabase CLI for schema migrations and local development. (Recommended)

## 7. Open Questions & Considerations

-   **Teacher Self-Management**: Teachers cannot modify their own instrument list or profile details, all is controlled by admins.
-   **Student Access**: Students do not have access.
-   **`currentWeek` Logic & Lesson Lifecycle**: The `currentWeek` parameter is crucial. When lessons are moved/unassigned/trashed:
    -   The original lesson's `end_date` is set to the date of its slot in `currentWeek` from which it was dragged.
    -   If the original lesson's `start_date` was that same date, it's deleted.
    -   A new lesson (if applicable) gets its `start_date` set to the relevant date in `currentWeek` (new slot date, or unassign date) and `end_date = null`.
    -   **Lesson Active Period**: A lesson is considered active on a given `date` if `date >= lesson.startDate` AND `date < lesson.endDate` (`endDate` is exclusive).
-   **Frontend `endDate` Display Logic**: The frontend's lesson display logic (e.g., in `TimeGrid.tsx`) will need a slight modification to interpret `endDate` as exclusive, aligning with the rule: 'A lesson is active if `date >= lesson.startDate` AND `date < lesson.endDate`'.
-   **Frontend Unassigned Lessons Filter**: The frontend's 'Unassigned Lessons' view will need to filter lessons where `teacher_id` is null AND (`start_date` is null OR (`start_date` is on or before the Friday of the `currentWeek` being viewed AND (`end_date` is null OR `end_date` is after the Monday of `currentWeek`))) to correctly display unassigned lessons relevant to the viewed week and future.
-   **Atomicity of Lesson Operations**: All multi-step lesson modifications (move, unassign, trash) MUST be performed atomically on the backend, encapsulated within single database function calls, to prevent data inconsistencies.
-   **Timezone Handling**: Ensure consistency in how dates and times are stored (UTC in database) and displayed (local time in frontend). Supabase handles `timestamp with time zone` well. `date` and `time` types are timezone-naive, so application logic must be consistent.
-   **Error Handling**: Plan for robust error handling in frontend contexts when Supabase calls fail.
-   **Seeding Initial Data**: For development and testing, scripts to seed instruments, admin users, etc., would be beneficial.
-   **Lesson Deletion**: Dragging a lesson to the delete area from the schedule should update it to have an end date equal to the date in the currently displayed week where it has been dragged from, but should not create any other lesson. It would be the same as unassigning a lesson, but without creating a new unassigned lesson. Dragging a lesson to the delete area from the unassigned area should just delete it altogether.

This plan provides a comprehensive roadmap. The next step would be to start with Phase 1: Supabase Project Setup & Basic Schema. 