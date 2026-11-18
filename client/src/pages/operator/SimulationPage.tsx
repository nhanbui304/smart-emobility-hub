// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { StubNotice } from "../../components/StubNotice";

export function SimulationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Mô phỏng What-if"
        subtitle="Thử kịch bản trên bản sao dữ liệu, không ảnh hưởng vận hành thật"
      />
      <Card tone="highlight">
        <p className="text-sm text-white/70">Kịch bản</p>
        <p className="mt-1 text-lg font-semibold">Tăng nhu cầu · Đóng Hub · Thêm cổng sạc · Thêm xe</p>
      </Card>
      <StubNotice
        owner="Nguyễn Hoàng Nhân"
        useCases="UC14"
        todo={[
          "Chọn Hub + khung giờ → simulationApi.prepareSimulation",
          "Chọn loại kịch bản + giả định → prepareScenario → startSimulation",
          "Nghe SIMULATION_FINISHED, hiển thị so sánh baseline và kịch bản (biểu đồ cột)",
        ]}
      />
    </div>
  );
}
