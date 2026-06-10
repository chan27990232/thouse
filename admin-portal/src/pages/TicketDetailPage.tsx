import { Navigate, useParams } from 'react-router-dom';

/** 保留舊連結相容，導向統一聊天版面 */
export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/tickets" replace />;
  return <Navigate to={`/tickets/${id}`} replace />;
}
