'use client';

import RoleGuard from '../../../src/components/RoleGuard';
import Intelligence from '../../../src/views/Intelligence';

export default function IntelligencePage() {
  return (
    <RoleGuard roles={['block_officer', 'district_admin']}>
      <Intelligence />
    </RoleGuard>
  );
}
