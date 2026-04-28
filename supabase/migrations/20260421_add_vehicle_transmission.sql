-- Optional: run in Supabase SQL editor if your project was created before this column existed.
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS transmission TEXT;
