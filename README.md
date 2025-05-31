# School Scheduler - Multi-tenant SaaS Platform

A comprehensive scheduling solution for schools to manage lessons, teachers, and subjects across multiple educational institutions.

## Features

- **Multi-tenant Architecture**: Support for multiple schools with isolated data
- **Role-based Access Control**: School administrators and teachers with appropriate permissions
- **Subject Management**: Flexible subject/course management system
- **Lesson Scheduling**: Intuitive drag-and-drop lesson scheduling interface
- **Google Sheets Integration**: Import student data from Google Sheets
- **User-friendly Dashboard**: Easy school selection and management interface

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Authentication + RLS)
- **State Management**: React Context + TanStack Query
- **Date Management**: date-fns

## Getting Started

### Prerequisites
- Node.js 18+ 
- Supabase account
- Google Sheets API access (for data import)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd school-scheduler
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

## Contributing

Please read our contributing guidelines before submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
