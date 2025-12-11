-- Assign free plan to existing users who don't have a subscription
-- Run this in Supabase SQL Editor

-- Get the free plan ID
DO $$
DECLARE
  free_plan_id UUID;
  user_record RECORD;
BEGIN
  -- Get free plan ID
  SELECT id INTO free_plan_id
  FROM subscription_plans
  WHERE name = 'free'
  LIMIT 1;

  -- Loop through all users without a subscription
  FOR user_record IN
    SELECT id
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM user_subscriptions)
  LOOP
    -- Assign free plan
    INSERT INTO user_subscriptions (
      user_id,
      plan_id,
      status,
      current_period_start,
      current_period_end
    ) VALUES (
      user_record.id,
      free_plan_id,
      'active',
      NOW(),
      NOW() + INTERVAL '1 month'
    )
    ON CONFLICT (user_id) DO NOTHING;

    RAISE NOTICE 'Assigned free plan to user: %', user_record.id;
  END LOOP;
END $$;

-- Verify assignments
SELECT
  u.id as user_id,
  u.email,
  sp.display_name as plan,
  us.status
FROM auth.users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
ORDER BY u.created_at DESC
LIMIT 10;
