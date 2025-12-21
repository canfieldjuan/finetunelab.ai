/**
 * UsageWarningBanner Component
 * Alert banner shown when usage exceeds 90% threshold
 */

"use client";

import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface UsageWarnings {
  traceWarning: boolean;
  payloadWarning: boolean;
  traceUsagePercent: number;
  payloadUsagePercent: number;
}

interface UsageWarningBannerProps {
  warnings: UsageWarnings;
  tier?: string;
}

export function UsageWarningBanner({
  warnings,
  tier,
}: UsageWarningBannerProps) {
  const hasWarnings = warnings.traceWarning || warnings.payloadWarning;

  if (!hasWarnings) {
    return null;
  }

  const getAlertVariant = () => {
    if (warnings.traceUsagePercent >= 100 || warnings.payloadUsagePercent >= 100) {
      return "destructive";
    }
    return "default";
  };

  const getAlertTitle = () => {
    if (warnings.traceUsagePercent >= 100 || warnings.payloadUsagePercent >= 100) {
      return "Usage Limit Exceeded";
    }
    return "Approaching Usage Limits";
  };

  const getAlertMessage = () => {
    const messages: string[] = [];

    if (warnings.traceWarning) {
      messages.push(
        `Traces: ${warnings.traceUsagePercent.toFixed(1)}% of included limit used`
      );
    }

    if (warnings.payloadWarning) {
      messages.push(
        `Payload: ${warnings.payloadUsagePercent.toFixed(1)}% of included limit used`
      );
    }

    return messages.join(" • ");
  };

  return (
    <Alert variant={getAlertVariant()} className="mb-6">
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <AlertTitle>{getAlertTitle()}</AlertTitle>
      <AlertDescription>
        {getAlertMessage()}
        {warnings.traceUsagePercent >= 100 || warnings.payloadUsagePercent >= 100 ? (
          <span className="block mt-2">
            Overage charges will apply. Consider upgrading to a higher tier for better rates.
          </span>
        ) : (
          <span className="block mt-2">
            You may incur overage charges soon. Monitor your usage or upgrade your tier.
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}
