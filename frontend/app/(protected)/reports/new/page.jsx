'use client';

import RoleGuard from '../../../../src/components/RoleGuard';
import ReportForm from '../../../../src/views/ReportForm';

export default function NewReportPage() {
  return (
    <RoleGuard roles={['volunteer', 'asha_worker']}>
      <ReportForm />
    </RoleGuard>
  );
}
