# Security Policy

## Supported Versions

Security updates and critical vulnerability patches are applied to the active `main` branch.

| Version | Supported |
| :--- | :--- |
| 1.0.x (Current) | Yes |

## Reporting a Vulnerability

If you identify a security issue, vulnerability, or secret exposure:
1. Please do not open a public GitHub issue.
2. Report the vulnerability privately to the project maintainer.
3. Include clear steps to reproduce and an assessment of the vulnerability's impact.
4. Maintainers will investigate and deploy an expedited patch.

## Production Security Measures

- **No Client-Side Secrets:** Private keys (such as `GEMINI_API_KEY`) are kept on the server behind Vercel serverless endpoints.
- **Row Level Security (RLS):** All Supabase database tables enforce strict isolation with `auth.uid() = user_id`.
- **Namespaced Storage:** Browser storage keys are isolated per user (`bm:${userId}:${key}`).
- **Input Validation & Sanitization:** SQL parameters, CSV inputs, and prompt queries are sanitized against injection.
