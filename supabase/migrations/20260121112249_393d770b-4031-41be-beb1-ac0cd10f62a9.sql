-- Add unique_id column to profiles for Valorant-style friend system
ALTER TABLE public.profiles 
ADD COLUMN unique_id TEXT UNIQUE;

-- Create function to generate unique ID (username#XXXX format)
CREATE OR REPLACE FUNCTION public.generate_unique_id()
RETURNS TRIGGER AS $$
DECLARE
  random_suffix TEXT;
  new_unique_id TEXT;
BEGIN
  -- Generate random 4-digit suffix
  random_suffix := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  new_unique_id := NEW.username || '#' || random_suffix;
  
  -- Ensure uniqueness by regenerating if exists
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE unique_id = new_unique_id) LOOP
    random_suffix := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    new_unique_id := NEW.username || '#' || random_suffix;
  END LOOP;
  
  NEW.unique_id := new_unique_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate unique_id on insert
CREATE TRIGGER generate_profile_unique_id
BEFORE INSERT ON public.profiles
FOR EACH ROW
WHEN (NEW.unique_id IS NULL)
EXECUTE FUNCTION public.generate_unique_id();

-- Generate unique IDs for existing profiles without one
UPDATE public.profiles
SET unique_id = username || '#' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0')
WHERE unique_id IS NULL;