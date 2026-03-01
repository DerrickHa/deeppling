import type {
  AdminOnboardingStep,
  ChecklistSummary,
  Employee,
  EmployeeOnboardingStep,
  Org,
  WizardProgressPayload
} from "@deeppling/shared";

const adminSequence: AdminOnboardingStep[] = ["kyb", "treasury", "policy", "invite", "review", "complete"];

const employeeSequence: EmployeeOnboardingStep[] = [
  "identity",
  "employment",
  "tax",
  "wallet",
  "documents",
  "review",
  "complete"
];

export const getAdminProgress = (
  org: Org,
  checklist: ChecklistSummary
): WizardProgressPayload<AdminOnboardingStep> => {
  const completedSteps: AdminOnboardingStep[] = ["start"];

  const kybDone = org.kybStatus === "COMPLETED";
  const treasuryDone = checklist.treasuryFunded;
  const policyDone = checklist.policyActive;
  const inviteDone = checklist.employeesInvited > 0;
  const reviewDone = org.onboardingReviewCompleted === true;

  if (kybDone) completedSteps.push("kyb");
  if (treasuryDone) completedSteps.push("treasury");
  if (policyDone) completedSteps.push("policy");
  if (inviteDone) completedSteps.push("invite");
  if (reviewDone) completedSteps.push("review");

  let earliestIncompleteStep: AdminOnboardingStep = "kyb";

  for (const step of adminSequence) {
    if (!completedSteps.includes(step)) {
      earliestIncompleteStep = step;
      break;
    }

    if (step === "review") {
      earliestIncompleteStep = "complete";
    }
  }

  if (earliestIncompleteStep === "complete") {
    completedSteps.push("complete");
  }

  return {
    currentStep: earliestIncompleteStep,
    earliestIncompleteStep,
    completedSteps,
    canProceed: checklist.blockers.length === 0,
    blockers: checklist.blockers,
    nextStep: earliestIncompleteStep
  };
};

export const getEmployeeProgress = (employee: Employee): WizardProgressPayload<EmployeeOnboardingStep> => {
  const completedSteps: EmployeeOnboardingStep[] = [];
  const blockers: string[] = [];

  const requiredSteps: Array<Exclude<EmployeeOnboardingStep, "review" | "complete">> = [
    "identity",
    "employment",
    "tax",
    "wallet",
    "documents"
  ];

  for (const step of requiredSteps) {
    if (employee.onboarding[step] === "COMPLETED") {
      completedSteps.push(step);
    }
  }

  let earliestIncompleteStep: EmployeeOnboardingStep = "identity";

  const missingRequired = requiredSteps.find((step) => employee.onboarding[step] !== "COMPLETED");

  if (missingRequired) {
    earliestIncompleteStep = missingRequired;
    blockers.push(`Missing ${missingRequired} step`);
  } else if (employee.readiness === "READY" && employee.onboarding.review === "COMPLETED") {
    completedSteps.push("review", "complete");
    earliestIncompleteStep = "complete";
  } else {
    if (employee.onboarding.review === "COMPLETED") {
      completedSteps.push("review");
    }
    earliestIncompleteStep = "review";
  }

  return {
    currentStep: earliestIncompleteStep,
    earliestIncompleteStep,
    completedSteps,
    canProceed: blockers.length === 0,
    blockers,
    nextStep: earliestIncompleteStep
  };
};

export const isStepAhead = <S extends string>(
  step: S,
  earliestIncompleteStep: S,
  orderedSteps: readonly S[]
): boolean => {
  const currentIndex = orderedSteps.indexOf(step);
  const earliestIndex = orderedSteps.indexOf(earliestIncompleteStep);

  if (currentIndex < 0 || earliestIndex < 0) {
    return false;
  }

  return currentIndex > earliestIndex;
};
