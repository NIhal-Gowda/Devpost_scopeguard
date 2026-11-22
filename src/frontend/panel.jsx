import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text,
  Heading,
  Stack,
  Inline,
  Box,
  Badge,
  Button,
  SectionMessage,
  Lozenge,
  Spinner,
  ProgressBar,
  Tag,
  TagGroup
} from '@forge/react';
import { invoke, view } from '@forge/bridge';

const ScopeGuardPanel = () => {
  const [loading, setLoading] = useState(true);
  const [reAuditing, setReAuditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [auditData, setAuditData] = useState(null);
  const [issueKey, setIssueKey] = useState('');
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const context = await view.getContext();
        const currentIssueKey = context?.extension?.issue?.key || 'DEMO-101';
        setIssueKey(currentIssueKey);

        const result = await invoke('getIssueAudit', {
          issueKey: currentIssueKey,
          issueSummary: context?.extension?.issue?.summary || '',
          issueDescription: context?.extension?.issue?.description || ''
        });

        setAuditData(result);
      } catch (err) {
        console.error('Error initializing ScopeGuard panel:', err);
        setNotification({
          appearance: 'error',
          title: 'Initialization Failed',
          message: err.message || 'Unable to connect to ScopeGuard audit service.'
        });
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const handleReAudit = async () => {
    if (!issueKey) return;
    setReAuditing(true);
    setNotification(null);
    try {
      const refreshed = await invoke('reAuditIssue', { issueKey });
      setAuditData(refreshed);
      setNotification({
        appearance: 'confirmation',
        title: 'Audit Complete',
        message: 'Contract scope re-evaluated against latest active Confluence SOW.'
      });
    } catch (err) {
      setNotification({
        appearance: 'error',
        title: 'Re-audit Failed',
        message: err.message || 'Could not re-scan Confluence SOW.'
      });
    } finally {
      setReAuditing(false);
    }
  };

  const handleConvertToChangeRequest = async () => {
    if (!issueKey || !auditData) return;
    setConverting(true);
    setNotification(null);
    try {
      const res = await invoke('convertToChangeRequest', {
        issueKey,
        violatedClause: auditData.violatedClause,
        estimatedImpact: '$7,500 Scope Adjustment / 40 Engineering Hours',
        sowTitle: auditData.sowTitle
      });

      if (res.success) {
        setAuditData(res.audit);
        setNotification({
          appearance: 'success',
          title: 'Converted to Paid Change Request',
          message: `Label 'paid-change-request' applied to ${issueKey} and formal SOW audit notice posted to Jira comments.`
        });
      } else {
        throw new Error(res.error || 'Conversion failed');
      }
    } catch (err) {
      setNotification({
        appearance: 'error',
        title: 'Conversion Error',
        message: err.message || 'Failed to convert ticket to Change Request.'
      });
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return (
      <Box padding="space.200">
        <Stack space="space.150" alignInline="center">
          <Spinner size="medium" />
          <Text>Scanning ticket against signed Confluence Statements of Work...</Text>
        </Stack>
      </Box>
    );
  }

  const status = auditData?.status || 'COMPLIANT';
  const riskScore = auditData?.riskScore ?? 0;
  const isBreach = status === 'SCOPE BREACH DETECTED';
  const isAtRisk = status === 'AT RISK';
  const isConverted = status === 'CHANGE_REQUEST_CREATED' || auditData?.convertedToChangeRequest;

  // Determine badge & lozenge styling
  let lozengeAppearance = 'success';
  let lozengeText = 'COMPLIANT (IN SOW SCOPE)';

  if (isConverted) {
    lozengeAppearance = 'new';
    lozengeText = 'PAID CHANGE REQUEST AUTHORIZATION PENDING';
  } else if (isBreach) {
    lozengeAppearance = 'removed';
    lozengeText = 'CONTRACT SCOPE BREACH DETECTED';
  } else if (isAtRisk) {
    lozengeAppearance = 'inprogress';
    lozengeText = 'AT RISK (POTENTIAL SCOPE DRIFT)';
  }

  const progressBarValue = Math.min(1, Math.max(0, riskScore / 100));

  return (
    <Stack space="space.200">
      {/* 1. Header & Live Contract Governance Status */}
      <Box padding="space.150">
        <Inline spread="space-between" alignBlock="center">
          <Inline space="space.100" alignBlock="center">
            <Badge appearance="primary">ScopeGuard</Badge>
            <Heading as="h4">Contract Governance Sentinel</Heading>
          </Inline>
          <Lozenge appearance={lozengeAppearance} isBold>
            {lozengeText}
          </Lozenge>
        </Inline>
      </Box>

      {/* 2. Notification Banner if action performed */}
      {notification && (
        <SectionMessage appearance={notification.appearance} title={notification.title}>
          <Text>{notification.message}</Text>
        </SectionMessage>
      )}

      {/* 3. Scope Breach Risk Meter */}
      <Box padding="space.150">
        <Stack space="space.075">
          <Inline spread="space-between" alignBlock="center">
            <Text>
              <strong>Scope Breach Risk Score:</strong>
            </Text>
            <Text>
              <strong>{riskScore}%</strong>
            </Text>
          </Inline>
          <ProgressBar value={progressBarValue} />
        </Stack>
      </Box>

      {/* 4. Violated SOW Clause Callout */}
      {(isBreach || isAtRisk || isConverted) && (
        <SectionMessage
          appearance={isConverted ? 'information' : isBreach ? 'error' : 'warning'}
          title={isConverted ? 'Change Request Scope Addendum' : 'Contractual Violation Detected'}
        >
          <Stack space="space.100">
            <Text>
              <strong>Quoted SOW Clause:</strong>
            </Text>
            <Text>
              <em>"{auditData?.violatedClause}"</em>
            </Text>
            <Text>
              <strong>Audit Assessment:</strong> {auditData?.explanation}
            </Text>
            {auditData?.matchedKeywords && auditData.matchedKeywords.length > 0 && (
              <Inline space="space.050" alignBlock="center">
                <Text>
                  <small>Conflict Keywords:</small>
                </Text>
                <TagGroup>
                  {auditData.matchedKeywords.map((kw, i) => (
                    <Tag key={i} text={kw} />
                  ))}
                </TagGroup>
              </Inline>
            )}
          </Stack>
        </SectionMessage>
      )}

      {/* 5. Linked Confluence SOW Details */}
      <Box padding="space.150">
        <Stack space="space.100">
          <Inline spread="space-between" alignBlock="center">
            <Text>
              <strong>Governing Statement of Work:</strong>
            </Text>
            <Lozenge appearance="success">sow-active</Lozenge>
          </Inline>
          <Text>{auditData?.sowTitle || 'Master Services Agreement v2.4 (Enterprise Fixed-Price Scope)'}</Text>
          <Inline space="space.150">
            <Text>
              <small>Document Owner: {auditData?.sowOwner || 'Commercial Operations'}</small>
            </Text>
            <Text>
              <small>Status: Active Confluence Contract Baseline</small>
            </Text>
          </Inline>
        </Stack>
      </Box>

      {/* 6. Executive Action Buttons */}
      <Box padding="space.150">
        <Inline space="space.100">
          <Button
            appearance="default"
            onClick={handleReAudit}
            isDisabled={reAuditing || converting}
          >
            {reAuditing ? 'Scanning Confluence SOW...' : 'Re-Audit Against Confluence SOW'}
          </Button>

          {(isBreach || isAtRisk) && !isConverted && (
            <Button
              appearance="danger"
              onClick={handleConvertToChangeRequest}
              isDisabled={converting || reAuditing}
            >
              {converting ? 'Converting Ticket...' : 'Convert to Paid Change Request'}
            </Button>
          )}

          {isConverted && (
            <Button appearance="subtle" isDisabled>
              Change Request CR-{issueKey} Authorized
            </Button>
          )}
        </Inline>
      </Box>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <ScopeGuardPanel />
  </React.StrictMode>
);
