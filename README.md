# 🛡️ ScopeGuard: Contract-to-Jira Scope Drift Sentinel

> **Atlassian Codegeist 2026 Entry**  
> **Track:** Apps for Business Teams  
> **Bonuses:** Best Rovo Agent | Best Teamwork Graph Integration  
> **Platform:** 100% Native Atlassian Forge (`@forge/react`, `@forge/api`, `@forge/kvs`)

---

## 💡 The Problem: Silent Scope Creep Destroys Margins
In fixed-price agency contracts, enterprise professional services, and IT consulting engagements, **scope creep costs technology providers 15% to 35% of total project profitability**.
- Developers routinely implement unbilled feature requests (e.g., custom third-party payment gateways, native mobile apps, sub-1-hour SLAs) simply because tickets appear in Jira sprints.
- Statements of Work (SOWs) and Master Services Agreements (MSAs) remain buried in Confluence or PDFs, inaccessible to engineers and product owners during daily sprint planning.
- Account executives only discover scope breaches after hundreds of unbilled engineering hours have been burned.

---

## ⚡ The Solution: ScopeGuard
**ScopeGuard** is a native Atlassian Forge application connecting **Confluence Cloud, Jira Cloud, and Atlassian Rovo** into an automated contract compliance and governance layer.

1. **Continuous Confluence SOW Indexing:**
   - Automatically monitors Confluence pages tagged with label `sow-active`.
   - Parses contractual constraints, prohibited integrations, SLA caps, and excluded deliverables into structured Forge Key-Value Storage (`@forge/kvs`).
2. **Real-Time Jira Issue Audit:**
   - Automated event triggers (`avi:jira:created:issue`, `avi:jira:updated:issue`) scan every new or edited Jira ticket against active SOW rules.
   - An executive **Contract Compliance Panel** rendered natively with `@forge/react` UI Kit provides instant visual telemetry: `COMPLIANT` (Green), `AT RISK` (Yellow), or `SCOPE BREACH DETECTED` (Red).
3. **Autonomous Rovo Agent ("ScopeGuard Contract Sentinel"):**
   - Natural language Rovo Agent interacting natively inside Atlassian Chat and Jira.
   - Leverages Rovo Actions (`fetch-sow-constraints` and `convert-to-change-request`) to cite exact contractual clauses and assess scope breach risk (0–100%).
4. **One-Click Change Request Conversion:**
   - Automatically converts out-of-scope tickets into **Paid Change Requests**.
   - Applies the `paid-change-request` label, posts a formal Atlassian Document Format (ADF) legal notice citing governing clauses, and locks engineering work until commercial approval.

---

## 🏗️ Architecture & Modules

```
                           +--------------------------------+
                           |  Confluence Cloud (Active SOW)  |
                           |       label: "sow-active"      |
                           +---------------+----------------+
                                           |
                              confluence-sow-sync-trigger
                                           v
+------------------------+      +---------------------+      +------------------------+
|  Atlassian Rovo Agent  | <--> |  Forge KVS Storage  | <--> |   Jira Issue Panel     |
| (ScopeGuard Sentinel)  |      |   (@forge/kvs)      |      |   (@forge/react UI Kit)|
+------------------------+      +---------------------+      +------------------------+
            |                                                            |
     rovo:actions                                                resolvers/index.js
   - fetch-sow-constraints                                       - getIssueAudit
   - convert-to-change-request                                   - reAuditIssue
            |                                                    - convertToChangeRequest
            +------------------------------+-----------------------------+
                                           |
                                           v
                             +--------------------------+
                             |   Jira Cloud Issue API   |
                             | - Labels update          |
                             | - ADF Audit Comments     |
                             +--------------------------+
```

### Forge Manifest Modules:
- **`rovo:agent` (`scopeguard-agent`):** Name: `ScopeGuard Sentinel`. Instructed to audit Jira tickets against signed Confluence SOWs, quote exact contractual clauses, score risk 0–100%, and offer one-click Change Request conversions.
- **`action` (`fetch-sow-constraints` & `convert-to-change-request`):** Enables Rovo Agent to retrieve active SOW boundaries and execute mutations against Jira tickets.
- **`jira:issuePanel` (`scopeguard-drift-panel`):** Native UI Kit panel displaying real-time risk scores, quote callouts, linked Confluence SOW metadata, and interactive audit/conversion buttons.
- **`trigger` (`jira-issue-audit-trigger` & `confluence-sow-sync-trigger`):** Background listeners for Jira issue creations/edits and Confluence SOW page revisions.
- **`permissions.scopes`:** `read:jira-work`, `write:jira-work`, `read:confluence-content.all`, `read:confluence-content.summary`, `read:confluence-props`, `read:page:confluence`, `search:confluence`, `storage:app`.

---

## 🚀 Quickstart & Installation

### Prerequisites
- Node.js 22.x or 24.x
- Atlassian Forge CLI (`npm install -g @forge/cli`)
- Access to an Atlassian Cloud Developer Site (`*.atlassian.net`)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/NIhal-Gowda/Devpost_scopeguard.git
cd Devpost_scopeguard/scopeguard
npm install
```

### 2. Verify Linting
```bash
forge lint
```

### 3. Deploy to Forge Development Environment
```bash
forge deploy
```

### 4. Install App to Jira & Confluence Cloud Site
```bash
forge install --site your-site.atlassian.net --product jira
forge install --site your-site.atlassian.net --product confluence
```

---

## 🧪 3-Step Live Demonstration Checklist

### Step 1: Confluence Statement of Work Setup
1. In your Confluence Cloud space, create a page titled **"Statement of Work - Enterprise Core v2.4"**.
2. Add the label **`sow-active`** to the page.
3. Include standard exclusions in the page content:
   > *"Fixed-price scope strictly excludes third-party payment gateways (Stripe, PayPal, Adyen), custom native mobile apps (iOS/Android), and sub-1-hour SLA guarantees."*
4. *(Note: If no Confluence page is tagged yet, ScopeGuard includes a built-in fallback SOW so the app is instantly testable out-of-the-box!)*

### Step 2: Create an Out-of-Scope Jira Ticket
1. In Jira Cloud, create a new issue:
   - **Summary:** `Integrate Stripe Checkout Webhook`
   - **Description:** `Need to configure Stripe webhook endpoint for processing credit cards and customer checkouts.`

### Step 3: Verify Automated Scope Breach Alert & Rovo Agent
1. Open the created ticket in Jira.
2. In the right-hand panel, view the **ScopeGuard Contract Audit** card:
   - Status: **`CONTRACT SCOPE BREACH DETECTED`** (Red)
   - Risk Score: **`90%`**
   - Violated Clause: Direct quote citing SOW §4.1 (Third-Party Payment Gateway exclusion).
3. Click **"Convert to Paid Change Request"**:
   - The label `paid-change-request` is automatically added to the Jira ticket.
   - A formatted legal/finance audit comment is posted citing governing SOW clauses.
4. Open **Atlassian Rovo Chat** and mention `@ScopeGuard Sentinel`:
   - Prompt: *"Audit ticket PROJ-1 against our active Confluence SOW"*
   - Watch the Rovo Agent fetch constraints, analyze the scope drift, and cite the contract!

---

## 👥 Authors
- **Nihal Gowda** ([GitHub: @NIhal-Gowda](https://github.com/NIhal-Gowda))
- Built for **Atlassian Codegeist 2026**
