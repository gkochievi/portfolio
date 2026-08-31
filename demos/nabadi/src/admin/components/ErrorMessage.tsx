import { useTranslation } from 'react-i18next';
import { ApiError } from '@/lib/api';

export function ErrorMessage({ error }: { error: unknown }) {
  const { t } = useTranslation('errors');
  if (!(error instanceof ApiError)) return null;
  return (
    <div role="alert" className="text-danger text-sm py-1">
      {t(error.code, { defaultValue: error.message })}
    </div>
  );
}
