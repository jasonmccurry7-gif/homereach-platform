-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase Auth Trigger
-- Auto-creates a profiles row whenever a new user signs up via Supabase Auth.
-- Also sets the user_role custom claim on the JWT so middleware can read it
-- without a DB query on every request.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
BEGIN
  -- Determine role: admins are hard-coded via env-driven email list
  -- For simplicity during setup, default all users to 'client'
  _role := COALESCE(NEW.raw_app_meta_data->>'user_role', 'client');

  -- Insert profile row
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    _role::user_role
  )
  ON CONFLICT (id) DO NOTHING;

  -- Set custom JWT claim so middleware can read role without DB query
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('user_role', _role)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- 2. Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

-- profiles: users can read/update their own row; admins can read all
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: own read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: own update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles: admin read all"
  ON public.profiles FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- businesses: owners can CRUD their own; admins can do everything
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "businesses: owner full access"
  ON public.businesses
  USING (owner_id = auth.uid());

CREATE POLICY "businesses: admin full access"
  ON public.businesses
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- orders: business owners can view their own orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders: business owner read"
  ON public.orders FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "orders: admin full access"
  ON public.orders
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- outreach_replies: business owners can view their own replies
ALTER TABLE public.outreach_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "replies: business owner read"
  ON public.outreach_replies FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "replies: admin full access"
  ON public.outreach_replies
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
