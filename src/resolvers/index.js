import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import { kvs } from '@forge/kvs';
import { fetchActiveSOWConstraints } from '../sowParser';
import { evaluateIssueDrift } from '../driftEngine';

const resolver = new Resolver();

/**
 * Helper to fetch issue text directly from Jira REST API v3
 */
async function fetchIssueText(issueKey) {
  try {
    const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}?fields=summary,description`);
    if (res.ok) {
      const data = await res.json();
      const summary = data.fields?.summary || '';
      let desc = '';
      if (typeof data.fields?.description === 'string') {
        desc = data.fields.description;
      } else if (data.fields?.description) {
        desc = JSON.stringify(data.fields.description);
      }
      return `${summary} ${desc}`.trim();
    }
  } catch (err) {
    console.warn('[ScopeGuard] Could not fetch issue fields from Jira API:', err.message);
  }
  return '';
}

/**
 * Loads current audit state for a Jira issue.
 */
resolver.define('getIssueAudit', async (req) => {
  const { issueKey, issueSummary, issueDescription } = req.payload || {};
  if (!issueKey) {
    return { error: 'No issue key provided' };
  }

  // 1. Check if an audit already exists in KVS
  try {
    const cachedAudit = await kvs.get(`audit:${issueKey}`);
    if (cachedAudit && cachedAudit.status) {
      return cachedAudit;
    }
  } catch (err) {
    console.warn('[ScopeGuard] KVS read error in getIssueAudit:', err.message);
  }

  // 2. Fetch issue text (either passed from client or directly from Jira REST API)
  let fullText = `${issueSummary || ''} ${issueDescription || ''}`.trim();
  if (!fullText || fullText.length < 5) {
    const apiText = await fetchIssueText(issueKey);
    if (apiText) {
      fullText = apiText;
    }
  }

  // 3. Perform live audit
  const sow = await fetchActiveSOWConstraints();
  const audit = await evaluateIssueDrift(fullText, sow);
  audit.issueKey = issueKey;

  try {
    await kvs.set(`audit:${issueKey}`, audit);
  } catch (err) {
    console.warn('[ScopeGuard] KVS write error:', err.message);
  }

  return audit;
});

/**
 * Forces a live re-audit against active Confluence SOW
 */
resolver.define('reAuditIssue', async (req) => {
  const { issueKey, issueSummary, issueDescription } = req.payload || {};
  if (!issueKey) {
    return { error: 'No issue key provided' };
  }

  let fullText = `${issueSummary || ''} ${issueDescription || ''}`.trim();
  if (!fullText || fullText.length < 5) {
    const apiText = await fetchIssueText(issueKey);
    if (apiText) {
      fullText = apiText;
    }
  }

  const sow = await fetchActiveSOWConstraints();
  const audit = await evaluateIssueDrift(fullText, sow);
  audit.issueKey = issueKey;

  try {
    await kvs.set(`audit:${issueKey}`, audit);
  } catch (err) {
    console.warn('[ScopeGuard] KVS write error in reAuditIssue:', err.message);
  }

  return audit;
});

/**
 * Converts the out-of-scope ticket to a Paid Change Request:
 * 1. Adds label 'paid-change-request' to Jira ticket
 * 2. Posts formatted ADF audit comment citing Confluence SOW
 * 3. Updates Forge KVS state
 */
resolver.define('convertToChangeRequest', async (req) => {
  const { issueKey, violatedClause, estimatedImpact, sowTitle } = req.payload || {};
  if (!issueKey) {
    return { success: false, error: 'Missing issueKey' };
  }

  const impactText = estimatedImpact || '$7,500 Fixed Scope Addendum / 40 Engineering Hours';
  const clauseText = violatedClause || 'SOW §4.1: Excluded Third-Party Integration';
  const sowDocTitle = sowTitle || 'Master Services Agreement v2.4';

  try {
    // 1. Add label 'paid-change-request' to Jira ticket
    await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        update: {
          labels: [
            { add: 'paid-change-request' },
            { add: 'scopeguard-audited' }
          ]
        }
      })
    });

    // 2. Post formatted ADF Audit Comment to Jira ticket
    const commentBody = {
      body: {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [
              {
                type: 'text',
                text: '🛡️ ScopeGuard Legal & Scope Audit Notice'
              }
            ]
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Status: ', marks: [{ type: 'strong' }] },
              { type: 'text', text: 'CONVERTED TO PAID CHANGE REQUEST', marks: [{ type: 'code' }] }
            ]
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Governing Contract: ', marks: [{ type: 'strong' }] },
              { type: 'text', text: sowDocTitle }
            ]
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Violated SOW Clause: ', marks: [{ type: 'strong' }] },
              { type: 'text', text: clauseText, marks: [{ type: 'em' }] }
            ]
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Commercial Impact: ', marks: [{ type: 'strong' }] },
              { type: 'text', text: impactText }
            ]
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Notice: This requirement has been flagged by ScopeGuard Contract Sentinel as exceeding the contracted scope. Work on this item is paused until client authorization of Change Request #CR-' + issueKey + '.'
              }
            ]
          }
        ]
      }
    };

    await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commentBody)
    });

    // 3. Update audit state in Forge KVS
    let existingAudit = {};
    try {
      existingAudit = (await kvs.get(`audit:${issueKey}`)) || {};
    } catch (e) {
      // ignore
    }

    const updatedAudit = {
      ...existingAudit,
      status: 'CHANGE_REQUEST_CREATED',
      convertedToChangeRequest: true,
      convertedAt: new Date().toISOString(),
      violatedClause: clauseText,
      estimatedImpact: impactText,
      sowTitle: sowDocTitle
    };

    try {
      await kvs.set(`audit:${issueKey}`, updatedAudit);
    } catch (e) {
      console.warn('[ScopeGuard] KVS write error:', e.message);
    }

    return {
      success: true,
      audit: updatedAudit
    };
  } catch (err) {
    console.error('[ScopeGuard] convertToChangeRequest error:', err);
    return { success: false, error: err.message };
  }
});

export const handler = resolver.getDefinitions();
