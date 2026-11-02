// Owner: Lê Quốc Linh – UC12 Coordinate Vehicle Redistribution
import { PageHeader } from "../../components/PageHeader";
import { StubNotice } from "../../components/StubNotice";

export function RedistributionPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Điều chuyển xe" subtitle="Chuyển xe từ Hub thừa sang Hub thiếu" />
      <StubNotice
        owner="Lê Quốc Linh"
        useCases="UC12"
        todo={[
          "Chọn Hub nguồn, Hub đích, danh sách xe AVAILABLE → createRedistributionOrder",
          "Theo dõi từng xe: xác nhận rời Hub / tới Hub",
          "Hủy các xe chưa xuất phát",
        ]}
      />
    </div>
  );
}
