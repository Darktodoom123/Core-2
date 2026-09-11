import { t as AuthShell } from "./auth-shell-Cu5-fe_S.js";
import { Head, Link, useForm } from "@inertiajs/react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region resources/js/pages/auth/forgot-password.tsx
function ForgotPassword({ status }) {
	const form = useForm({ email: "" });
	return /* @__PURE__ */ jsxs(AuthShell, { children: [
		/* @__PURE__ */ jsx(Head, { title: "Reset password" }),
		/* @__PURE__ */ jsx("h1", {
			id: "auth-title",
			className: "text-2xl font-semibold text-ink",
			children: "Reset your password"
		}),
		/* @__PURE__ */ jsx("p", {
			className: "mt-2 text-sm leading-6 text-ink-soft",
			children: "Enter your company email and we’ll send a time-limited reset link."
		}),
		status && /* @__PURE__ */ jsx("p", {
			role: "status",
			className: "mt-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-green-800",
			children: status
		}),
		/* @__PURE__ */ jsxs("form", {
			onSubmit: (event) => {
				event.preventDefault();
				form.post("/forgot-password");
			},
			className: "mt-6 space-y-4",
			children: [/* @__PURE__ */ jsxs("label", {
				className: "block text-sm font-medium text-ink",
				children: [
					"Email",
					/* @__PURE__ */ jsx("input", {
						type: "email",
						value: form.data.email,
						onChange: (e) => form.setData("email", e.target.value),
						autoComplete: "email",
						autoFocus: true,
						className: "mt-1 h-11 w-full rounded-lg border border-line px-3"
					}),
					form.errors.email && /* @__PURE__ */ jsx("span", {
						className: "mt-1 block text-sm text-red-700",
						children: form.errors.email
					})
				]
			}), /* @__PURE__ */ jsx("button", {
				disabled: form.processing,
				className: "h-11 w-full rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60",
				children: "Send reset link"
			})]
		}),
		/* @__PURE__ */ jsx(Link, {
			href: "/login",
			className: "mt-5 inline-flex min-h-11 items-center text-sm font-medium text-brand-strong",
			children: "Return to sign in"
		})
	] });
}
//#endregion
export { ForgotPassword as default };

//# sourceMappingURL=forgot-password-DPLe0dnN.js.map