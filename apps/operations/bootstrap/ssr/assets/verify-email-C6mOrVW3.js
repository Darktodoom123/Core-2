import { t as AuthShell } from "./auth-shell-Cu5-fe_S.js";
import { Head, router, useForm } from "@inertiajs/react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region resources/js/pages/auth/verify-email.tsx
function VerifyEmail({ status }) {
	const form = useForm({});
	return /* @__PURE__ */ jsxs(AuthShell, { children: [
		/* @__PURE__ */ jsx(Head, { title: "Verify email" }),
		/* @__PURE__ */ jsx("h1", {
			id: "auth-title",
			className: "text-2xl font-semibold text-ink",
			children: "Verify your email"
		}),
		/* @__PURE__ */ jsx("p", {
			className: "mt-2 text-sm leading-6 text-ink-soft",
			children: "Open the verification link sent to your company email before entering operational data."
		}),
		status === "verification-link-sent" && /* @__PURE__ */ jsx("p", {
			role: "status",
			className: "mt-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-green-800",
			children: "A new verification link was sent."
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "mt-6 flex flex-col gap-2 sm:flex-row",
			children: [/* @__PURE__ */ jsx("button", {
				onClick: () => form.post("/email/verification-notification"),
				disabled: form.processing,
				className: "min-h-11 flex-1 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60",
				children: "Resend verification"
			}), /* @__PURE__ */ jsx("button", {
				onClick: () => router.post("/logout"),
				className: "min-h-11 flex-1 rounded-lg border border-line px-4 text-sm font-semibold text-ink",
				children: "Sign out"
			})]
		})
	] });
}
//#endregion
export { VerifyEmail as default };

//# sourceMappingURL=verify-email-C6mOrVW3.js.map