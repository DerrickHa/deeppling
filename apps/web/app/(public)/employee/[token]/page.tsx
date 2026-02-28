import EmployeeOnboardingClient from "./EmployeeOnboardingClient";

export default async function EmployeeOnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <EmployeeOnboardingClient token={token} />;
}
