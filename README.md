# School Scheduler - Unified SaaS Platform

A comprehensive scheduling solution for schools to manage lessons, teachers, and subjects across multiple educational institutions.

## Features

- **Multi-tenant Architecture**: Support for multiple schools with isolated data
- **Role-based Access Control**: School administrators and teachers with appropriate permissions
- **Subject Management**: Flexible subject/course management system
- **Lesson Scheduling**: Intuitive drag-and-drop lesson scheduling interface
- **Google Sheets Integration**: Import student data from Google Sheets
- **Unified Interface**: Central hub and scheduler in one integrated application

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Authentication + RLS)
- **State Management**: React Context + TanStack Query
- **Date Management**: date-fns
- **Routing**: React Router (unified single-page application)

## Getting Started

### Prerequisites
- Node.js 18+ 
- Supabase account
- Google Sheets API access (for data import)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd rhythmic-lesson-orchestrator-improved
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Add your Supabase URL and anon key
```

4. Start the development server:
```bash
npm run dev
```

## Application Structure

The application now runs as a unified single-page application with the following routes:

### Public Routes
- `/login` - Authentication
- `/signup` - User registration
- `/forgot-password` - Password reset request
- `/reset-password` - Password reset form

### Protected Routes
- `/` - Dashboard (school selection and overview)
- `/school-setup` - Create new school
- `/school/:slug/manage` - School administration

### School-Specific Routes
- `/school/:slug/schedule` - Lesson scheduling interface
- `/school/:slug/teachers` - Teacher management
- `/school/:slug/subjects` - Subject/course management
- `/school/:slug/locations` - Location management
- `/school/:slug/settings` - School settings

## Database Schema

The application uses a multi-tenant database structure with the following key tables:

- `schools`: Store school information and settings
- `users`: User accounts that can belong to multiple schools
- `user_schools`: Junction table linking users to schools with role assignments
- `subjects`: Subjects/courses offered by each school
- `lessons`: Individual lesson instances
- `teachers_subjects`: Teachers' subject assignments

## Multi-tenancy

The application implements row-level security (RLS) in Supabase to ensure complete data isolation between schools. Users can belong to multiple schools with different roles in each.

## Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Vercel
The application is configured for easy Vercel deployment from the root directory:

1. Connect your repository to Vercel
2. Set environment variables:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
3. Deploy!

The `vercel.json` configuration handles SPA routing automatically.

## Contributing

Please read our contributing guidelines before submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.