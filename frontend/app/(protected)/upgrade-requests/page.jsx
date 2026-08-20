'use client';

import RoleGuard from '../../../src/components/RoleGuard';
import UpgradeRequests from '../../../src/views/UpgradeRequests';

export default function UpgradeRequestsPage() {
  return (
    <RoleGuard roles={['block_officer', 'district_admin']}>
      <UpgradeRequests />
    </RoleGuard>
  );
}
