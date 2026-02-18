-- Allow users to update their own profile (e.g. for presence, avatar, etc.)
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Fix Admin View Policy (Non-recursive)
-- We check if the user requesting the data has the 'service_role' (not applicable here usually) 
-- OR strictly rely on the user ID being the same, 
-- OR use a more advanced technique.
-- BUT EASIEST FIX for the "Admin can see everyone" recursion crash:
-- 1. Create a function to check admin status that bypasses RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Use this function in the policy
CREATE POLICY "Admins can view all profiles_fixed"
ON public.profiles
FOR SELECT
USING (
  public.is_admin()
);
