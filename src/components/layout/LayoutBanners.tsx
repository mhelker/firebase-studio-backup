'use client';

import { RestartServerBanner } from '@/components/restart-server-banner';
import { DeployRulesBanner } from '@/components/deploy-rules-banner';

export function LayoutBanners() {
  return (
    <>
      <RestartServerBanner />
      <DeployRulesBanner />
    </>
  );
}