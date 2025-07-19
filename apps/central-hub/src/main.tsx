import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { AuthProvider, SchoolsProvider, ModulesProvider } from '@schooltools/shared-auth'
import { supabase } from './lib/supabaseClient.ts'
import { Toaster } from 'sonner'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider supabaseClient={supabase}>
          <SchoolsProvider supabaseClient={supabase}>
            <ModulesProvider supabaseClient={supabase}>
              <BrowserRouter>
                <App />
                <Toaster />
              </BrowserRouter>
            </ModulesProvider>
          </SchoolsProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>,
) 