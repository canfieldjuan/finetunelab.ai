# Intelligent Email Tool

An AI-powered email tool for sending emails via Resend API with future extensibility for advanced features.

## Phase 1: Core Functionality ✅

### Features

- Send emails via Resend API
- Support for multiple recipients
- CC and BCC support
- HTML and plain text emails
- Reply-to address configuration
- Robust error handling and logging

### Configuration

Set these environment variables:

```bash
# Required
RESEND_API_KEY=re_your_api_key_here

# Optional
EMAIL_DEFAULT_FROM=noreply@yourdomain.com
EMAIL_TOOL_ENABLED=true
EMAIL_TIMEOUT=10000
EMAIL_MAX_RECIPIENTS=50
```

### Usage

The tool is automatically registered with the tool registry. The LLM can call it with these parameters:

```typescript
{
  to: "recipient@example.com",           // Required: Single or comma-separated emails
  subject: "Your Subject",                // Required
  body: "Your email content",             // Required: Plain text
  from: "sender@example.com",             // Optional: Uses EMAIL_DEFAULT_FROM if not set
  html: "<h1>HTML Content</h1>",         // Optional: HTML version
  cc: "cc@example.com",                   // Optional: Comma-separated
  bcc: "bcc@example.com",                 // Optional: Comma-separated
  replyTo: "reply@example.com"            // Optional
}
```

### File Structure

```
intelligent_email/
├── index.ts              # Main tool definition
├── email.config.ts       # Configuration
├── resend.provider.ts    # Resend API integration
├── types.ts              # TypeScript types
└── README.md             # This file
```

### Example

```typescript
const result = await executeToolFromRegistry('intelligent_email', {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Thank you for signing up.',
  from: 'hello@myapp.com'
});

console.log(result);
// {
//   success: true,
//   messageId: 're_abc123',
//   provider: 'resend',
//   to: ['user@example.com'],
//   subject: 'Welcome!'
// }
```

## Future Phases

### Phase 2: Intelligence Features (Planned)

- Email summarization
- Smart reply suggestions
- Sentiment analysis
- Action item extraction

### Phase 3: Extensibility (Planned)

- Generic EmailProvider interface
- Support for Gmail, Outlook, SMTP
- Provider switching based on configuration

### Phase 4: Security & Privacy (Planned)

- PII detection
- Spam/phishing detection
- Data encryption

### Phase 5: Automation (Planned)

- Auto-response rules
- Email templates
- Scheduled sending
- Follow-up reminders

## Development

### Adding Debug Logs

The tool includes comprehensive logging at key points:

- Configuration initialization
- Email send attempts
- API responses
- Error conditions

### Testing

Create test files in the tool directory:

- Unit tests for provider functions
- Integration tests for tool execution
- Mock Resend API responses

## Security Notes

1. **API Key**: Never commit your Resend API key to version control
2. **Email Validation**: The tool validates recipient count but not email format (Resend handles this)
3. **Verified Domains**: Sender addresses must be verified in your Resend account
4. **Rate Limiting**: Respect Resend API rate limits (consult their documentation)

## Troubleshooting

### "Resend API key not configured"

- Set the `RESEND_API_KEY` environment variable
- Restart your application after setting the variable

### "No sender address provided"

- Set `from` parameter in the tool call, or
- Set `EMAIL_DEFAULT_FROM` environment variable

### "Too many recipients"

- Default limit is 50 recipients
- Adjust `EMAIL_MAX_RECIPIENTS` environment variable
- Or split into multiple emails

### "Failed to send email: timeout"

- Increase `EMAIL_TIMEOUT` (default: 10000ms)
- Check network connectivity
- Verify Resend API status

## License

Part of the web-ui tool system.
