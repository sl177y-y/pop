#!/bin/bash

# Install Supabase JS client
npm install @supabase/supabase-js

echo "Supabase client installed successfully!"
echo "Remember to create a .env.local file with your Supabase credentials:"
echo "NEXT_PUBLIC_SUPABASE_URL=your_supabase_url"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key"
echo "SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key" 