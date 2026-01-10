-- Update profiles table with new user fields
-- Run this in your Supabase SQL Editor

-- Add new columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS nic TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS birthdate DATE,
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);
CREATE INDEX IF NOT EXISTS profiles_nic_idx ON public.profiles(nic);

-- Update the trigger function to include username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, nic, birthdate, gender)
  VALUES (
    new.id, 
    new.email,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'nic',
    (new.raw_user_meta_data->>'birthdate')::date,
    new.raw_user_meta_data->>'gender'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    nic = EXCLUDED.nic,
    birthdate = EXCLUDED.birthdate,
    gender = EXCLUDED.gender;
  RETURN new;
END;
$$;

-- Update RLS policies to allow users to see usernames (for blog authors display)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_public_info"
  ON public.profiles FOR SELECT
  USING (true);  -- Allow reading username for display purposes

-- Keep update/delete restricted to own profile
CREATE POLICY "profiles_update_own_new"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_delete_own_new"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);
