// Owner: Ngô Minh Triết – UC07 Submit Charging Request, Cancel Charging Request
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { StubNotice } from "../../components/StubNotice";

export function ChargingRequestPage() {
  return (
    <div className="space-y-4">
      <Link to="/student/my-vehicle" className="text-sm text-neutral-500">
        ← Xe của tôi
      </Link>
      <PageHeader title="Yêu cầu sạc" subtitle="Sạc ngay tại Hub đang đứng" />
      <StubNotice
        owner="Ngô Minh Triết"
        useCases="UC07"
        todo={[
          "Form: Hub, xe, pin hiện tại, pin mong muốn",
          "chargingRequestApi.submitChargingRequest → hiển thị cổng được phân hoặc vị trí trong hàng đợi",
          "Nút Hủy yêu cầu (Cancel Charging Request)",
        ]}
      />
    </div>
  );
}
