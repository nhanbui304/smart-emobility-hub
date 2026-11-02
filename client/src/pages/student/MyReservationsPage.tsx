// Owner: Lê Quốc Linh – View My Reservations
import { Link } from "react-router-dom";
import { hubApi } from "../../api/hubs";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PageHeader } from "../../components/PageHeader";
import { Spinner } from "../../components/Spinner";
import { StubNotice } from "../../components/StubNotice";
import { useAsync } from "../../hooks/useAsync";

export function MyReservationsPage() {
  const { loading, error, reload } = useAsync(() => hubApi.myReservations(), []);

  return (
    <div className="space-y-4">
      <Link to="/student" className="text-sm text-neutral-500">
        ← Trang chủ
      </Link>
      <PageHeader title="Đặt chỗ của tôi" subtitle="Đặt xe, chỗ đỗ và lịch sạc còn hiệu lực" />
      <StubNotice
        owner="Lê Quốc Linh"
        useCases="View My Reservations"
        todo={["Hiện thực MyReservationsService.getMyReservations", "Hiển thị 3 nhóm, mỗi mục có StatusBadge và thời gian"]}
      />
      {loading && <Spinner />}
      <ErrorMessage error={error} onRetry={reload} />
    </div>
  );
}
