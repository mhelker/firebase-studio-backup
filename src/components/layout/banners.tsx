'use client';

import { RestartServerBanner } from '../restart-server-banner';
import { DeployRulesBanner } from '../deploy-rules-banner';

export function LayoutBanners() {
  return (
    <>
      <RestartServerBanner />
      <DeployRulesBanner />
    </>
  );
}