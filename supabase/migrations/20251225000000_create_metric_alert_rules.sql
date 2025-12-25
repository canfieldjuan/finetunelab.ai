-- Create metric_alert_rules table for trace/anomaly metric-based alerting
-- Date: 2025-12-25

CREATE TABLE IF NOT EXISTS metric_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Rule configuration
  rule_name TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('latency', 'error_rate', 'cost', 'throughput', 'ttft', 'token_usage', 'anomaly_severity')),
  threshold_value NUMERIC NOT NULL,
  comparison_operator TEXT NOT NULL CHECK (comparison_operator IN ('>', '<', '>=', '<=', '==', '!=')),
  time_window_minutes INTEGER NOT NULL DEFAULT 5 CHECK (time_window_minutes > 0),
  aggregation_method TEXT NOT NULL CHECK (aggregation_method IN ('p50', 'p95', 'p99', 'avg', 'max', 'min', 'count', 'sum')),

  -- Optional filters
  model_filter TEXT,
  operation_filter TEXT,
  status_filter TEXT,

  -- Notification settings
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_webhooks BOOLEAN NOT NULL DEFAULT false,
  notify_integrations BOOLEAN NOT NULL DEFAULT false,
  cooldown_minutes INTEGER NOT NULL DEFAULT 30 CHECK (cooldown_minutes >= 0),

  -- State
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  trigger_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster user lookups
CREATE INDEX idx_metric_alert_rules_user_id ON metric_alert_rules(user_id);
CREATE INDEX idx_metric_alert_rules_enabled ON metric_alert_rules(enabled) WHERE enabled = true;
CREATE INDEX idx_metric_alert_rules_metric_type ON metric_alert_rules(metric_type);

-- Create RLS policies
ALTER TABLE metric_alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own alert rules"
  ON metric_alert_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own alert rules"
  ON metric_alert_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert rules"
  ON metric_alert_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alert rules"
  ON metric_alert_rules FOR DELETE
  USING (auth.uid() = user_id);

-- Create metric_alert_rule_evaluations table for history
CREATE TABLE IF NOT EXISTS metric_alert_rule_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES metric_alert_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Evaluation results
  metric_value NUMERIC NOT NULL,
  threshold_value NUMERIC NOT NULL,
  triggered BOOLEAN NOT NULL,
  time_window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  time_window_end TIMESTAMP WITH TIME ZONE NOT NULL,
  sample_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,

  evaluated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for evaluation history
CREATE INDEX idx_metric_alert_rule_evaluations_rule_id ON metric_alert_rule_evaluations(rule_id);
CREATE INDEX idx_metric_alert_rule_evaluations_user_id ON metric_alert_rule_evaluations(user_id);
CREATE INDEX idx_metric_alert_rule_evaluations_triggered ON metric_alert_rule_evaluations(triggered) WHERE triggered = true;
CREATE INDEX idx_metric_alert_rule_evaluations_evaluated_at ON metric_alert_rule_evaluations(evaluated_at DESC);

-- Create RLS policies for evaluations
ALTER TABLE metric_alert_rule_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rule evaluations"
  ON metric_alert_rule_evaluations FOR SELECT
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_metric_alert_rule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_metric_alert_rule_updated_at_trigger
  BEFORE UPDATE ON metric_alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_metric_alert_rule_updated_at();

-- Comments for documentation
COMMENT ON TABLE metric_alert_rules IS 'Metric-based alert rules for continuous monitoring of trace metrics and anomalies';
COMMENT ON COLUMN metric_alert_rules.metric_type IS 'Type of metric to monitor: latency, error_rate, cost, throughput, ttft, token_usage, anomaly_severity';
COMMENT ON COLUMN metric_alert_rules.comparison_operator IS 'Comparison operator: >, <, >=, <=, ==, !=';
COMMENT ON COLUMN metric_alert_rules.aggregation_method IS 'How to aggregate metrics: p50, p95, p99, avg, max, min, count, sum';
COMMENT ON COLUMN metric_alert_rules.time_window_minutes IS 'Time window in minutes to evaluate metrics';
COMMENT ON COLUMN metric_alert_rules.cooldown_minutes IS 'Minimum time between alerts to prevent spam';

COMMENT ON TABLE metric_alert_rule_evaluations IS 'History of metric alert rule evaluations';
