import api, { route } from '@forge/api';
import { kvs } from '@forge/kvs';

export const FALLBACK_DEMO_SOW = {
  id: 'SOW-MSA-V2.4',
  title: 'Master Services Agreement v2.4 (Enterprise Fixed-Price Scope)',
  owner: 'Atlassian Commercial & Legal Operations',
  url: 'https://confluence.atlassian.com/display/GOV/Master+Services+Agreement+v2.4',
  version: '2.4.0 (Active)',
  effectiveDate: '2026-01-01',
  clauses: [
    {
      id: 'CLAUSE-01',
      category: 'Third-Party Payments',
      title: 'Payment Gateway Integration Exclusion',
      rule: 'Fixed-price scope strictly excludes integration with third-party payment gateways (Stripe, PayPal, Adyen, Braintree, Square, Authorize.Net). Any credit card processing, merchant webhook, or checkout flow requires a formal Paid Change Request and minimum $7,500 implementation fee.',
      keywords: [
        'stripe',
        'paypal',
        'adyen',
        'braintree',
        'square',
        'checkout webhook',
        'payment gateway',
        'card processing',
        'payment processing',
        'credit card',
        'pci compliance'
      ]
    },
    {
      id: 'CLAUSE-02',
      category: 'Mobile Applications',
      title: 'Native Mobile Platforms Out-of-Scope',
      rule: 'Contract baseline covers responsive web interfaces only. Custom native mobile applications (iOS/Swift, Android/Kotlin, React Native, Flutter, App Store/Play Store submissions) are strictly out of scope.',
      keywords: [
        'ios',
        'swift',
        'android',
        'kotlin',
        'react native',
        'flutter',
        'mobile app',
        'native mobile',
        'app store',
        'google play',
        'mobile build'
      ]
    },
    {
      id: 'CLAUSE-03',
      category: 'SLA & Uptime',
      title: 'SLA Thresholds & High Availability',
      rule: 'Standard delivery SLA guarantees 99.5% service uptime and 24-business-hour response time. Sub-1-hour SLA guarantees, dedicated 24/7 on-call engineering rotations, and 99.99% high-availability guarantees require an Enterprise Addendum.',
      keywords: [
        'sub-1-hour',
        'sub 1 hour',
        '15 minute response',
        '30 minute response',
        '24/7 on-call',
        'dedicated on-call',
        '99.99%',
        '1-hour sla',
        'sub-one-hour'
      ]
    },
    {
      id: 'CLAUSE-04',
      category: 'Data Migration & ETL',
      title: 'Legacy Data Migration Caps',
      rule: 'Legacy data migration is capped at 50,000 records using standard CSV imports. Real-time automated ETL pipelines, mainframe migrations, and SAP/Oracle ERP bidirectional syncing are excluded.',
      keywords: [
        'etl pipeline',
        'mainframe',
        'oracle erp',
        'sap sync',
        'sap integration',
        'bulk legacy migration',
        'custom etl',
        'real-time sync'
      ]
    },
    {
      id: 'CLAUSE-05',
      category: 'AI & Inference Infrastructure',
      title: 'Custom Model Training & Dedicated Compute',
      rule: 'In-scope AI capabilities are limited to standard public cloud model endpoints. Custom LLM fine-tuning, on-premise GPU cluster deployment, and dedicated private inference clusters are strictly out of scope.',
      keywords: [
        'fine-tune model',
        'fine-tuning custom',
        'gpu cluster',
        'on-premise llm',
        'dedicated inference',
        'private llm cluster'
      ]
    }
  ]
};

/**
 * Strips Confluence ADF or storage XHTML markup to clean plain text.
 */
export function cleanConfluenceMarkup(content) {
  if (!content) return '';
  if (typeof content === 'string') {
    return content
      .replace(/<ac:[^>]*>(.*?)<\/ac:[^>]*>/gis, ' $1 ')
      .replace(/<ri:[^>]*\/>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return String(content);
}

/**
 * Fetches active Confluence SOW constraints tagged with 'sow-active'.
 * Falls back to @forge/kvs cache or FALLBACK_DEMO_SOW.
 */
export async function fetchActiveSOWConstraints(spaceKey = null) {
  try {
    // 1. Try querying Confluence REST API for pages with label 'sow-active'
    let cql = 'label="sow-active"';
    if (spaceKey) {
      cql += ` and space="${spaceKey}"`;
    }

    const searchUrl = route`/wiki/rest/api/content/search?cql=${cql}&expand=body.storage,version,history`;
    const response = await api.asApp().requestConfluence(searchUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const page = data.results[0];
        const pageTitle = page.title || 'Confluence Active SOW';
        const pageBody = page.body?.storage?.value || '';
        const rawText = cleanConfluenceMarkup(pageBody);

        // Extract constraints/exclusions from page text
        const extractedClauses = extractClausesFromText(rawText);

        const liveSow = {
          id: `confluence-page-${page.id}`,
          title: pageTitle,
          owner: page.history?.createdBy?.displayName || 'Confluence Project Lead',
          url: `/wiki${page._links?.webui || ''}`,
          version: `Confluence v${page.version?.number || 1}`,
          effectiveDate: page.version?.createdAt || new Date().toISOString(),
          clauses: extractedClauses.length > 0 ? extractedClauses : FALLBACK_DEMO_SOW.clauses,
          isFromConfluenceLive: true
        };

        // Cache into Forge KVS for triggers & quick retrieval
        await kvs.set('sow:active_rules', liveSow);
        return liveSow;
      }
    }
  } catch (err) {
    console.warn('[ScopeGuard] Confluence SOW live fetch encountered error, using cache/fallback:', err.message);
  }

  // 2. Fall back to @forge/kvs cached SOW if available
  try {
    const cached = await kvs.get('sow:active_rules');
    if (cached && cached.clauses && cached.clauses.length > 0) {
      return cached;
    }
  } catch (e) {
    console.warn('[ScopeGuard] KVS read fallback warning:', e.message);
  }

  // 3. Fallback to built-in Demo SOW (ensures 100% demo-readiness)
  try {
    await kvs.set('sow:active_rules', FALLBACK_DEMO_SOW);
  } catch (e) {
    // Ignore cache write error
  }

  return FALLBACK_DEMO_SOW;
}

/**
 * Parses raw text extracted from Confluence into discrete clauses.
 */
function extractClausesFromText(text) {
  if (!text) return [];
  const clauses = [];
  const sentences = text.split(/(?<=[.?!])\s+/);

  sentences.forEach((s, idx) => {
    const lower = s.toLowerCase();
    if (
      lower.includes('exclude') ||
      lower.includes('out of scope') ||
      lower.includes('not included') ||
      lower.includes('prohibited') ||
      lower.includes('cap') ||
      lower.includes('sla')
    ) {
      clauses.push({
        id: `CONF-CLAUSE-${idx + 1}`,
        category: 'Contractual Exclusion',
        title: `Confluence Exclusion #${idx + 1}`,
        rule: s.trim(),
        keywords: extractKeywords(s)
      });
    }
  });

  return clauses;
}

function extractKeywords(text) {
  const common = ['the', 'and', 'with', 'for', 'this', 'that', 'from', 'are', 'not', 'out', 'scope'];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !common.includes(w))
    .slice(0, 8);
}
