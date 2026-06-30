-- Seed/update the provider-agnostic URL reader portal tool.
-- The tools table predates this migration set in some environments, so this is
-- intentionally conditional rather than a table-creation migration.

DO $$
DECLARE
  read_url_parameters jsonb := '{
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "The public http(s) URL to read."
      },
      "maxCharacters": {
        "type": "number",
        "description": "Optional maximum characters to return, from 1000 to 15000. Defaults to 8000."
      }
    },
    "required": ["url"]
  }'::jsonb;
  read_url_description text := 'Read and extract readable text from one specific public web page URL. Use this when the user asks to read, summarize, inspect, or analyze a URL they provided. Do not use this for broad web searches.';
BEGIN
  IF to_regclass('public.tools') IS NULL THEN
    RAISE NOTICE 'Skipping read_url seed because public.tools does not exist';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tools'
      AND column_name IN ('description', 'parameters', 'is_builtin', 'is_enabled', 'updated_at')
    GROUP BY table_name
    HAVING count(*) = 5
  ) THEN
    RAISE NOTICE 'Skipping read_url seed because public.tools is missing expected registry columns';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.tools WHERE name = 'read_url') THEN
    UPDATE public.tools
    SET
      description = read_url_description,
      parameters = read_url_parameters,
      is_builtin = true,
      is_enabled = COALESCE(is_enabled, false),
      updated_at = now()
    WHERE name = 'read_url';
  ELSE
    INSERT INTO public.tools (
      name,
      description,
      parameters,
      is_builtin,
      is_enabled
    )
    VALUES (
      'read_url',
      read_url_description,
      read_url_parameters,
      true,
      false
    );
  END IF;
END $$;
