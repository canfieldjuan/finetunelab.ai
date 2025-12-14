/**
 * Email Alert Channel
 * Uses existing intelligent_email provider
 * Date: 2025-12-12
 */

import {
  AlertPayload,
  AlertDeliveryResult,
  AlertChannel,
  UserAlertPreferences,
  alertTypeToPreferenceKey,
  getAlertConfig,
} from '../alert.types';
import { formatEmailAlert } from '../formatters/email.formatter';
import { sendEmailViaResend } from '@/lib/tools/intelligent_email/resend.provider';

export class EmailChannel implements AlertChannel {
  async send(
    alert: AlertPayload,
    preferences: UserAlertPreferences
  ): Promise<AlertDeliveryResult> {
    console.log('[EmailChannel] Processing alert:', alert.type);

    if (!preferences.email_enabled) {
      console.log('[EmailChannel] Email disabled for user');
      return { success: false, channel: 'email', error: 'Email disabled' };
    }

    const prefKey = alertTypeToPreferenceKey(alert.type);
    if (prefKey && !preferences[prefKey]) {
      console.log('[EmailChannel] Alert type disabled:', alert.type);
      return { success: false, channel: 'email', error: `Alert type ${alert.type} disabled` };
    }

    if (this.isQuietHours(preferences)) {
      console.log('[EmailChannel] Quiet hours active, skipping');
      return { success: false, channel: 'email', error: 'Quiet hours active' };
    }

    const recipientEmail = preferences.email_address || await this.getUserAuthEmail(alert.userId);
    if (!recipientEmail) {
      console.error('[EmailChannel] No email address for user:', alert.userId);
      return { success: false, channel: 'email', error: 'No email address' };
    }

    const config = getAlertConfig();
    const formatted = formatEmailAlert(alert);

    try {
      const result = await sendEmailViaResend({
        from: config.emailFromAddress,
        to: [recipientEmail],
        subject: formatted.subject,
        body: formatted.text,
        html: formatted.html,
      });

      if (result.success) {
        console.log('[EmailChannel] Email sent:', result.messageId);
        return {
          success: true,
          channel: 'email',
          messageId: result.messageId,
        };
      }

      console.error('[EmailChannel] Send failed:', result.error);
      return {
        success: false,
        channel: 'email',
        error: result.error,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[EmailChannel] Exception:', errorMsg);
      return {
        success: false,
        channel: 'email',
        error: errorMsg,
      };
    }
  }

  private isQuietHours(prefs: UserAlertPreferences): boolean {
    if (!prefs.quiet_hours_enabled) return false;

    const now = new Date();
    let userHour: number;

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: prefs.timezone || 'UTC',
      });
      userHour = parseInt(formatter.format(now), 10);
    } catch {
      userHour = now.getUTCHours();
    }

    const start = prefs.quiet_hours_start;
    const end = prefs.quiet_hours_end;

    if (start <= end) {
      return userHour >= start && userHour < end;
    }
    return userHour >= start || userHour < end;
  }

  private async getUserAuthEmail(userId: string): Promise<string | null> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('[EmailChannel] Missing Supabase config');
        return null;
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data, error } = await supabase.auth.admin.getUserById(userId);

      if (error || !data.user) {
        console.error('[EmailChannel] Failed to get user:', error?.message);
        return null;
      }

      return data.user.email || null;
    } catch (err) {
      console.error('[EmailChannel] Error fetching user email:', err);
      return null;
    }
  }
}

export const emailChannel = new EmailChannel();
