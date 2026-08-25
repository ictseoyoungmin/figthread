import { sha256Canonical } from "./canonicalize.js";
import { compilePromotedMotion, promoteMotionProgram } from "./motion.js";
import { readProfilePromotion, validateProfileMotion } from "./profile.js";

function readLayoutPromotion(promotion) {
  if (!promotion?.promoted || !promotion.resolved_layout || !promotion.promotion_receipt) return null;
  const receipt = promotion.promotion_receipt;
  const { promotion_hash, ...base } = receipt;
  if (sha256Canonical(base) !== promotion_hash) return null;
  if (promotion.resolved_layout.layout_hash !== receipt.layout_hash) return null;
  if (promotion.resolved_layout.figure_hash !== receipt.figure_hash) return null;
  return {
    figureHash: receipt.figure_hash,
    layoutHash: receipt.layout_hash,
    profilePlanHash: receipt.profile_plan_hash
  };
}

function failedProfileReport(profileReport, mode) {
  return {
    mode,
    status: "fail",
    promotion_eligible: false,
    stage: "profile-motion",
    profile_validation: profileReport,
    issues: profileReport.issues
  };
}

export function compileProfileMotion(figurePromotion, profilePromotion, layoutPromotion, motion, options = {}) {
  const mode = options.mode ?? "gate";
  const profile = readProfilePromotion(profilePromotion);
  const layout = readLayoutPromotion(layoutPromotion);
  if (!profile || !layout || layout.figureHash !== profile.figureHash || layout.profilePlanHash !== profile.profilePlanHash) {
    return {
      mode,
      status: "fail",
      promotion_eligible: false,
      stage: "profile-motion",
      issues: [{
        code: "PRF007_MOTION",
        severity: "error",
        stage_owner: "profile",
        message: "motion compilation requires matching promoted profile and layout artifacts"
      }]
    };
  }
  const profileReport = validateProfileMotion(profilePromotion, motion, { mode });
  if (profileReport.status === "fail") return failedProfileReport(profileReport, mode);
  const result = compilePromotedMotion(figurePromotion, layoutPromotion, motion, { mode });
  if (result.status === "fail") return { ...result, profile_plan_hash: profile.profilePlanHash, profile_validation: profileReport };
  const status = result.status === "pass" && profileReport.status === "pass" ? "pass" : "pass-with-warnings";
  return { ...result, status, profile_plan_hash: profile.profilePlanHash, profile_validation: profileReport };
}

export function promoteProfileMotionProgram(figurePromotion, profilePromotion, layoutPromotion, motion) {
  const preflight = compileProfileMotion(figurePromotion, profilePromotion, layoutPromotion, motion, { mode: "gate" });
  if (preflight.status === "fail" || !preflight.promotion_eligible) return { promoted: false, report: preflight };
  const promoted = promoteMotionProgram(figurePromotion, layoutPromotion, motion);
  if (!promoted.promoted) return promoted;
  return {
    ...promoted,
    profile_plan_hash: preflight.profile_plan_hash,
    profile_validation: preflight.profile_validation
  };
}
