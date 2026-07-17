CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void AS $$
BEGIN
  -- Delete the current authenticated user from auth.users
  -- Because public tables reference auth.users(id) ON DELETE CASCADE,
  -- deleting the user from auth.users will automatically clean up all associated data.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke execute on function delete_user_account from public to prevent anonymous execution
REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM public;

-- Grant execute on function delete_user_account only to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
