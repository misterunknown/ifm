# Security Policy

IFM (Improved File Manager) exposes a filesystem over HTTP and ships features
such as authentication, file upload/download, archive extraction and remote
("server-side") uploads. Because of this surface, security reports are taken
seriously and handled with priority.

## Supported Versions

Security fixes are provided for the latest released `4.x` series and the
`master` branch. Older majors are not maintained.

| Version        | Supported          |
| -------------- | ------------------ |
| `master`       | :white_check_mark: |
| latest `4.x`   | :white_check_mark: |
| `< 4.0`        | :x:                |

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Instead, report privately via GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
("Report a vulnerability" under the repository's **Security** tab), or contact
the maintainers as listed in the repository.

When reporting, please include:

- a description of the issue and its impact,
- the affected version / commit,
- steps to reproduce (a minimal proof of concept is ideal),
- any relevant configuration (auth mode, enabled features, `root_dir` setup).

You can expect an initial acknowledgement within a reasonable timeframe. Once a
fix is available, a coordinated disclosure date will be agreed upon.

## Scope and Hardening Notes

The following areas are particularly security-relevant. Reports here are
especially welcome:

- **Path traversal / jail escape** — any way to read, write, list, move or
  delete outside the configured `root_dir`.
- **Authentication / session / CSRF** — bypassing auth, fixation, CSRF on
  state-changing endpoints.
- **SSRF** — abusing the remote-upload feature to reach internal services
  (the SSRF guard can be tightened/loosened via configuration).
- **Command / archive handling** — issues in archive creation/extraction,
  including zip-slip and command construction.

### Operator guidance

- Never enable authentication while leaving `auth_source` at the bundled
  default credentials — IFM refuses to run in that configuration on purpose.
- Restrict `root_dir` to the smallest necessary directory.
- Keep `remoteupload_disable_ssrf_check` at its secure default (`0`) unless you
  fully control the network and target URLs.
- Run behind HTTPS so session cookies are sent with the `Secure` flag.
