# Security Standards & Best Practices

**Last Updated:** 2025-12-20

---

## 🛡️ Overview

This project follows **OWASP Top 10** and **NIST** security guidelines to prevent vulnerable code from reaching production.

---

## 🔍 Automated Security Scanning

### 1. **Dependency Vulnerability Scanning**
- **Tool:** `npm audit`
- **When:** Every commit, merge request, main branch
- **Action:** Pipeline **FAILS** if critical/high vulnerabilities detected
- **Manual check:**
  ```bash
  npm audit
  npm audit fix  # Auto-fix vulnerabilities
  ```

### 2. **Secret Detection**
- **Tools:** GitLab Secret Detection, GitGuardian
- **When:** Pre-commit, every push
- **Detects:** API keys, passwords, tokens, private keys
- **Action:** **BLOCKS** commit if secrets detected
- **Patterns monitored:**
  - Supabase keys: `eyJ...`
  - OpenAI keys: `sk-...`
  - Stripe keys: `sk_live_...`
  - AWS credentials: `AKIA...`
  - Generic API keys

### 3. **Static Application Security Testing (SAST)**
- **Tool:** GitLab SAST (Ultimate tier) or SonarQube
- **When:** Every merge request
- **Detects:**
  - SQL injection vulnerabilities
  - XSS (Cross-Site Scripting)
  - Hardcoded credentials
  - Insecure crypto
  - Path traversal issues

### 4. **License Compliance**
- **Tool:** `license-checker`
- **When:** Every merge request
- **Allowed licenses:** MIT, Apache-2.0, BSD-3-Clause, ISC
- **Blocked licenses:** GPL-3.0, AGPL-3.0 (copyleft)

### 5. **Container Scanning**
- **Tool:** GitLab Container Scanning
- **When:** Docker image builds
- **Detects:** OS vulnerabilities, malware

---

## 📋 Security Checklist (Before Every Commit)

### Environment Variables
- [ ] No hardcoded secrets in code
- [ ] All secrets in `.env.local` (gitignored)
- [ ] Public env vars use `NEXT_PUBLIC_` prefix
- [ ] Production secrets stored in GitLab CI/CD variables

### Code Review
- [ ] No SQL queries without parameterization
- [ ] User input sanitized (XSS prevention)
- [ ] Authentication tokens validated
- [ ] File uploads restricted (type, size)
- [ ] Rate limiting on API endpoints

### Dependencies
- [ ] `npm audit` shows 0 critical/high vulnerabilities
- [ ] No deprecated packages
- [ ] Dependencies pinned in package-lock.json

### Data Security
- [ ] PII encrypted at rest
- [ ] HTTPS enforced
- [ ] Database RLS (Row Level Security) enabled
- [ ] Supabase policies reviewed

---

## 🚨 Vulnerability Response Process

### If Vulnerability Detected:

**1. Critical/High Severity:**
```bash
# Immediately fix
npm audit fix --force
# Or update specific package
npm update <package-name>
# Test
npm run build && npm run test
# Commit
git commit -m "security: fix critical vulnerability in <package>"
```

**2. Moderate/Low Severity:**
- Create issue in GitLab
- Schedule fix in next sprint
- Monitor for exploits

**3. Secret Leaked:**
```bash
# 1. Revoke compromised credential IMMEDIATELY
# 2. Remove from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/file" \
  --prune-empty --tag-name-filter cat -- --all

# 3. Force push (coordinate with team!)
git push --force --all

# 4. Rotate all related credentials
# 5. Document incident
```

---

## 🔐 Secret Management Best Practices

### Local Development
```bash
# .env.local (gitignored)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_test_...
```

### Production
- **GitLab CI/CD Variables** (Settings → CI/CD → Variables)
  - Mark as "Protected" (only main branch)
  - Mark as "Masked" (hidden in logs)

### Code Usage
```typescript
// ✅ Good
const apiKey = process.env.OPENAI_API_KEY;

// ❌ Bad - NEVER do this
const apiKey = "sk-proj-abc123...";
```

---

## 📚 Security Standards We Follow

### OWASP Top 10 (2021)
1. ✅ **Broken Access Control** - RLS policies, auth middleware
2. ✅ **Cryptographic Failures** - HTTPS, encrypted secrets
3. ✅ **Injection** - Parameterized queries, input sanitization
4. ✅ **Insecure Design** - Security review in planning
5. ✅ **Security Misconfiguration** - Default configs reviewed
6. ✅ **Vulnerable Components** - npm audit, dependency scanning
7. ✅ **Authentication Failures** - Supabase Auth, session management
8. ✅ **Data Integrity Failures** - Code signing, integrity checks
9. ✅ **Logging Failures** - Centralized logging, no sensitive data
10. ✅ **SSRF** - URL validation, whitelist external requests

### Additional Standards
- **NIST Cybersecurity Framework**
- **CIS Controls**
- **PCI DSS** (for payment processing)
- **GDPR/CCPA** (for data privacy)

---

## 🛠️ Security Tools Integrated

### Pre-Commit (Local)
- **GitGuardian** - Secret scanning
- **ESLint Security Plugin** - Code analysis
- **npm audit** - Dependency check

### CI/CD (GitLab)
- **npm audit** - Dependency vulnerabilities
- **GitLab Secret Detection** - Credential scanning
- **GitLab SAST** - Static security analysis
- **Container Scanning** - Docker image vulnerabilities
- **License Compliance** - Legal risk assessment

### Runtime (Production)
- **Supabase RLS** - Database access control
- **Rate Limiting** - DDoS prevention
- **WAF** (Cloudflare) - Web application firewall
- **Error Tracking** (Sentry) - No stack traces exposed

---

## 📞 Security Contacts

**Security Issues:** Report via GitLab Security tab or email security@finetunelab.ai

**Vulnerability Disclosure:** Responsible disclosure within 90 days

**Bug Bounty:** (Coming soon)

---

## 📖 Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [GitLab Security Docs](https://docs.gitlab.com/ee/user/application_security/)
- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices)

---

## 🔄 Review Schedule

- **Weekly:** Review npm audit reports
- **Monthly:** Update dependencies
- **Quarterly:** Security policy review
- **Annually:** Third-party security audit

**Next review due:** 2025-03-20
