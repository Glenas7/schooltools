# Architecture Transformation: Single-tenant → Multi-tenant

## Original Architecture (Music Teacher Scheduler)

### Database:
- `users` (with role column)
- `instruments` 
- `teachers_instruments`
- `lessons`

### User Roles:
- Global admin vs teacher roles
- Single school context

### URL Structure:
- `/schedule` - main schedule page
- `/instruments` - manage instruments  
- `/teachers` - manage teachers
- `/settings` - app settings

## New Architecture (Multi-tenant School Scheduler)

### Database:
- `schools` - **NEW**: Core multi-tenancy table
- `users` (role removed)
- `user_schools` - **NEW**: Role-based school membership
- `subjects` (renamed from instruments, with school_id)
- `teachers_subjects` (with school_id)
- `lessons` (with school_id)

### User Roles:
- Role per school (admin/teacher in user_schools)
- Multiple school membership possible
- School-specific permissions

### URL Structure:
- `/` - **NEW**: Landing page (unauthenticated)
- `/login` - Login page
- `/dashboard` - **NEW**: School selection dashboard
- `/schools/{id}/schedule` - School-specific schedule
- `/schools/{id}/subjects` - School-specific subjects (renamed)
- `/schools/{id}/teachers` - School-specific teachers
- `/schools/{id}/settings` - School-specific settings

## Key Changes Required:

### Frontend Contexts:
1. **AuthContext**: 
   - Remove global role
   - Add school context management
   - Add school switching logic

2. **LessonsContext**:
   - Add school_id to all queries
   - Update lesson functions with school parameter

3. **SubjectsContext** (renamed from InstrumentsContext):
   - Add school_id filtering
   - Rename all references

4. **TeachersContext**:
   - Add school_id filtering
   - Update role management (user_schools)

### New Contexts:
- **SchoolContext**: Manage current school, school switching
- **SchoolsContext**: Manage school list, creation, settings

### Routing:
- Implement school-based routing with React Router
- Add route protection by school membership
- Add navigation between schools

### UI Components:
- Landing page component
- School dashboard component  
- School selector component
- Navigation updates for school context

### Language Updates:
- Remove "music", "instrument" terminology
- Use generic "subject", "lesson", "school" language
- Update all user-facing text

## Migration Strategy:

### Phase 2: Backend Multi-tenancy
- Update all contexts for school-awareness
- Modify data fetching patterns
- Update authentication flow

### Phase 3: Frontend Context Updates  
- Add school context management
- Update existing contexts
- Add school switching logic

### Phase 4: Routing & Navigation
- Implement school-based routes
- Create landing page
- Create dashboard  
- Update navigation

### Phase 5: UI & Language Updates
- Remove music terminology
- Add school management UI
- Add invitation system
- Add Google Sheets config

### Phase 6: Testing & Polish
- Multi-school testing
- Role switching testing  
- Data isolation verification 