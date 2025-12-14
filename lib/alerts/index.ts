/**
 * Alert System - Main Exports
 * Date: 2025-12-12
 */

export * from './alert.types';
export * from './alert.service';
export { emailChannel } from './channels/email.channel';
export { webhookChannel } from './channels/webhook.channel';
export { integrationChannel } from './channels/integration.channel';
export { formatSlackAlert, formatSlackDailySummary } from './formatters/slack.formatter';
export { formatDiscordAlert, formatDiscordDailySummary } from './formatters/discord.formatter';
export { formatEmailAlert, formatEmailDailySummary } from './formatters/email.formatter';
