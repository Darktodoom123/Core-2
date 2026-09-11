import { u as cn } from "./ui-CuoqGbiO.js";
import { AlertTriangle, Check, Circle, Clock3, X } from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region resources/js/components/workspace/canonical-status-badge.tsx
var statusTones = {
	draft: "neutral",
	pending_approval: "warning",
	scheduled: "brand",
	dispatched: "brand",
	accepted: "brand",
	en_route: "brand",
	arrived: "success",
	working: "success",
	completed: "success",
	cancelled: "danger",
	routine: "neutral",
	priority: "warning",
	emergency: "danger",
	submitted: "neutral",
	dispatching: "brand",
	forwarded: "brand",
	approved: "success",
	rejected: "danger",
	verified: "success",
	logged: "success",
	available: "success",
	assigned: "brand",
	under_inspection: "warning",
	under_maintenance: "warning",
	awaiting_parts: "warning",
	ready_for_service: "success",
	unavailable: "danger",
	pending: "warning"
};
var toneClasses = {
	neutral: "bg-surface-subtle text-ink-soft",
	brand: "bg-brand-soft text-brand-strong",
	success: "bg-success-soft text-success-strong",
	warning: "bg-warning-soft text-warning-strong",
	danger: "bg-danger-soft text-danger"
};
var toneIcons = {
	neutral: Circle,
	brand: Clock3,
	success: Check,
	warning: AlertTriangle,
	danger: X
};
function CanonicalStatusBadge({ status, className }) {
	const tone = statusTones[status.value];
	const Icon = toneIcons[tone];
	return /* @__PURE__ */ jsxs("span", {
		className: cn("inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", toneClasses[tone], className),
		children: [/* @__PURE__ */ jsx(Icon, {
			className: "h-3 w-3",
			"aria-hidden": "true"
		}), status.label]
	});
}
//#endregion
export { CanonicalStatusBadge as t };

//# sourceMappingURL=canonical-status-badge-D9JpJjoH.js.map