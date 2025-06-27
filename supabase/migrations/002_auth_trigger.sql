-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  workspace_id_var UUID;
  workspace_slug_var TEXT;
BEGIN
  -- Generate a unique workspace slug
  workspace_slug_var := LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'workspace_name', 'workspace'), ' ', '-')) || '-' || SUBSTRING(gen_random_uuid()::TEXT, 1, 8);
  
  -- Create workspace for new user
  INSERT INTO public.workspaces (name, slug)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'workspace_name', 'My Workspace'),
    workspace_slug_var
  )
  RETURNING id INTO workspace_id_var;
  
  -- Create user profile
  INSERT INTO public.users (id, email, full_name, workspace_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    workspace_id_var,
    'workspace_admin' -- First user in workspace is admin
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to handle user deletion
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS trigger AS $$
BEGIN
  -- Delete user profile (cascade will handle related data)
  DELETE FROM public.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for user deletion
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_delete();