import { Navigate, useParams } from 'react-router-dom';

export function CaseFileRedirect() {
  const { id } = useParams();
  return <Navigate to={`/cases/${id ?? ''}`} replace />;
}
