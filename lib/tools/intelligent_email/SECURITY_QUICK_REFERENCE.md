# Email Security Tool - Quick Reference

## Tool: `email_security` v1.0.0

### Actions

#### 1. Detect PII
```typescript
await emailSecurityTool.execute({
  action: 'detect_pii',
  email: { from, to, subject, body }
});

// Returns:
{
  foundPII: boolean,
  piiTypes: string[],
  recommendations: string[],
  confidence: 'high' | 'medium' | 'low'
}
```

#### 2. Detect Spam/Phishing
```typescript
await emailSecurityTool.execute({
  action: 'detect_spam',
  email: { from, to, subject, body }
});

// Returns:
{
  isSpam: boolean,
  indicators: string[],
  riskLevel: 'high' | 'medium' | 'low',
  recommendations: string[]
}
```

#### 3. Analyze Sentiment
```typescript
await emailSecurityTool.execute({
  action: 'analyze_sentiment',
  email: { from, to, subject, body }
});

// Returns:
{
  sentiment: 'positive' | 'negative' | 'neutral',
  confidence: number,
  emotionalTone: string,
  keyPhrases: string[],
  recommendations: string[]
}
```

## Usage Patterns

### Before Sending
```typescript
// Check for PII before sending
const piiCheck = await emailSecurityTool.execute({
  action: 'detect_pii',
  email: draftEmail
});

if (piiCheck.data.foundPII) {
  console.warn('Warning: Email contains PII:', piiCheck.data.piiTypes);
}
```

### Incoming Email Analysis
```typescript
// Check incoming email for spam
const spamCheck = await emailSecurityTool.execute({
  action: 'detect_spam',
  email: incomingEmail
});

if (spamCheck.data.riskLevel === 'high') {
  // Move to spam folder
}
```

### Customer Service
```typescript
// Analyze customer email sentiment
const sentiment = await emailSecurityTool.execute({
  action: 'analyze_sentiment',
  email: customerEmail
});

if (sentiment.data.sentiment === 'negative') {
  // Escalate to manager
}
```

## Testing

```bash
# Run all security tests
npx tsx web-ui/lib/tools/intelligent_email/test-security.ts
```

## Environment

Requires:
- `OPENAI_API_KEY` - For AI analysis
- Optional: `EMAIL_SECURITY_MODEL` - Override model (default: gpt-4o-mini)
