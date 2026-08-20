'use client';

import RoleGuard from '../../../src/components/RoleGuard';
import WaterQuality from '../../../src/views/WaterQuality';

export default function WaterQualityPage() {
  return (
    <RoleGuard roles={['asha_worker', 'block_officer', 'district_admin']}>
      <WaterQuality />
    </RoleGuard>
  );
}
